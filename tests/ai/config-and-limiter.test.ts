import { describe, expect, it } from "vitest";
import { parseOrigin, readLumenConfig } from "../../src/server/ai/config";
import {
  RateLimitError,
  RateLimiter,
  clientKey,
} from "../../src/server/ai/rate-limit";

describe("parseOrigin: credentials only go to a bare https origin", () => {
  it.each([
    ["https://api.example.com", "https://api.example.com"],
    ["https://api.example.com/", "https://api.example.com"],
    ["  https://api.example.com  ", "https://api.example.com"],
    ["https://api.example.com:8443", "https://api.example.com:8443"],
  ])("accepts %j", (input, expected) =>
    expect(parseOrigin(input)).toBe(expected),
  );

  it.each([
    "http://api.example.com", // not encrypted
    "https://user:pw@api.example.com", // embedded credentials
    "https://api.example.com/ocr", // path
    "https://api.example.com?x=1", // query
    "https://api.example.com#frag", // fragment
    "api.example.com", // no scheme
    "ftp://api.example.com",
    "",
    "not a url",
  ])("rejects %j", (input) => expect(parseOrigin(input)).toBeNull());
});

describe("readLumenConfig", () => {
  const good = {
    LUMEN_API_KEY: "k",
    LUMEN_API_SECRET: "s",
    LUMEN_API_ORIGIN: "https://api.example.com/",
  };
  it("builds a live config with a normalized origin", () => {
    expect(readLumenConfig(good)).toEqual({
      mode: "live",
      apiKey: "k",
      apiSecret: "s",
      origin: "https://api.example.com",
    });
  });
  it("carries an optional instance id", () => {
    expect(
      readLumenConfig({ ...good, LUMEN_AI_CHAT_INSTANCE_ID: " inst-9 " }),
    ).toMatchObject({ instanceId: "inst-9" });
  });
  it("needs every required variable", () => {
    for (const missing of [
      "LUMEN_API_KEY",
      "LUMEN_API_SECRET",
      "LUMEN_API_ORIGIN",
    ])
      expect(() =>
        readLumenConfig({ ...good, [missing]: undefined }),
      ).toThrow();
  });
  it("mock mode ignores credentials entirely", () => {
    expect(readLumenConfig({ ...good, LUMEN_MODE: "mock" })).toEqual({
      mode: "mock",
    });
  });
});

describe("RateLimiter (sliding window)", () => {
  const make = (max: number, windowMs: number) => {
    let now = 0;
    return {
      limiter: new RateLimiter(max, windowMs, () => now),
      at: (t: number) => (now = t),
    };
  };
  const deny = (limiter: RateLimiter, key: string) => {
    try {
      limiter.check(key);
    } catch (error) {
      return error as RateLimitError;
    }
    return null;
  };

  it("allows up to the max, then denies with a rounded-up retry time", () => {
    const { limiter, at } = make(3, 10_000);
    at(0);
    limiter.check("a");
    at(1000);
    limiter.check("a");
    at(2000);
    limiter.check("a");
    at(2500);
    const denied = deny(limiter, "a")!;
    expect(denied).toBeInstanceOf(RateLimitError);
    expect(denied.code).toBe("rate_limited");
    expect(denied.retryAfterSeconds).toBe(8); // oldest hit expires at t=10000
  });
  it("frees a slot as old requests leave the window", () => {
    const { limiter, at } = make(2, 10_000);
    at(0);
    limiter.check("a");
    at(5000);
    limiter.check("a");
    at(9999);
    expect(deny(limiter, "a")).not.toBeNull();
    at(10_000); // the first hit has just expired
    expect(deny(limiter, "a")).toBeNull();
  });
  it("does not count denied requests, so waiting restores access", () => {
    const { limiter, at } = make(1, 10_000);
    at(0);
    limiter.check("a");
    for (let t = 1; t < 10; t += 1) {
      at(t * 100);
      expect(deny(limiter, "a")).not.toBeNull();
    }
    at(10_000);
    expect(deny(limiter, "a")).toBeNull();
  });
  it("tracks keys independently", () => {
    const { limiter, at } = make(1, 10_000);
    at(0);
    limiter.check("a");
    expect(deny(limiter, "b")).toBeNull();
    expect(deny(limiter, "a")).not.toBeNull();
  });
  it("derives the client key from the first forwarded address", () => {
    const req = (headers: Record<string, string>) =>
      new Request("http://x", { headers });
    expect(clientKey(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe(
      "9.9.9.9",
    );
    expect(clientKey(req({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientKey(req({}))).toBe("unknown");
  });
});
