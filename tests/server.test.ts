import { describe, expect, it } from "vitest";
import {
  computeDeadline,
  daysBetween,
  eventUrgency,
  parseDate,
  todayPH,
  urgencyFor,
} from "../src/lib/server/deadline";
import { countPdfPages, sniff } from "../src/lib/server/upload";
import { rateLimit } from "../src/lib/server/ratelimit";
import { memoryShareStore } from "../src/lib/server/share-store";

// 2026-11-13 is a Friday. 04:00 UTC = 12:00 in Manila.
const NOW = new Date("2026-11-13T04:00:00Z");

describe("deadline math", () => {
  it("uses Philippine date, not UTC", () => {
    expect(todayPH(new Date("2026-11-13T17:00:00Z"))).toBe("2026-11-14");
  });
  it("rejects impossible dates", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("13/11/2026")).toBeNull();
    expect(parseDate("2026-11-13")).not.toBeNull();
  });
  it("adds calendar days", () => {
    const r = computeDeadline({ startDate: "2026-11-13", days: 5 }, NOW)!;
    expect(r.dueDate).toBe("2026-11-18");
    expect(r.daysRemaining).toBe(5);
    expect(r.urgency).toBe("soon");
  });
  it("rolls a weekend due date forward when asked", () => {
    const r = computeDeadline(
      { startDate: "2026-11-13", days: 1, rollForward: true },
      NOW,
    )!;
    expect(r.dueDate).toBe("2026-11-16"); // Sat -> Mon
  });
  it("skips weekends and holidays for working days", () => {
    const r = computeDeadline(
      {
        startDate: "2026-11-13",
        days: 3,
        dayType: "working",
        holidays: ["2026-11-17"],
      },
      NOW,
    )!;
    // Mon 16, (Tue 17 holiday), Wed 18, Thu 19
    expect(r.dueDate).toBe("2026-11-19");
  });
  it("marks past deadlines overdue", () => {
    const r = computeDeadline({ startDate: "2026-11-01", days: 5 }, NOW)!;
    expect(r.urgency).toBe("overdue");
    expect(r.daysRemaining).toBeLessThan(0);
  });
  it("returns null for bad input instead of guessing", () => {
    expect(computeDeadline({ startDate: "nope", days: 5 }, NOW)).toBeNull();
    expect(computeDeadline({ startDate: "2026-11-13", days: -1 }, NOW)).toBeNull();
    expect(computeDeadline({ startDate: "2026-11-13", days: 1.5 }, NOW)).toBeNull();
  });
  it("keeps missing event dates explicitly unknown", () => {
    expect(eventUrgency(null, NOW).urgency).toBe("unknown");
    expect(eventUrgency("garbage", NOW).urgency).toBe("unknown");
    expect(eventUrgency("2026-11-20", NOW)).toEqual({
      daysRemaining: 7,
      urgency: "soon",
    });
  });
  it("buckets urgency", () => {
    expect(urgencyFor(-1)).toBe("overdue");
    expect(urgencyFor(0)).toBe("critical");
    expect(urgencyFor(7)).toBe("soon");
    expect(urgencyFor(8)).toBe("upcoming");
    expect(daysBetween("2026-11-13", "2026-11-20")).toBe(7);
  });
});

describe("upload sniffing", () => {
  it("identifies types by content", () => {
    expect(sniff(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(
      sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("png");
    const heic = new Uint8Array(12);
    heic.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4);
    expect(sniff(heic)).toBe("heic");
  });
  it("rejects disguised files and short buffers", () => {
    expect(sniff(new TextEncoder().encode("MZ executable"))).toBeNull();
    expect(sniff(new Uint8Array([0xff]))).toBeNull();
    expect(sniff(new Uint8Array(0))).toBeNull();
  });
  it("counts pages, ignoring /Pages", () => {
    const pdf = "%PDF-1.4 /Type /Pages /Type /Page /Type/Page";
    expect(countPdfPages(new TextEncoder().encode(pdf))).toBe(2);
  });
});

describe("rate limit", () => {
  it("blocks after the limit and reopens after the window", async () => {
    const rule = { limit: 2, windowSec: 10 };
    const t = 1_000_000;
    expect((await rateLimit("k", rule, t)).allowed).toBe(true);
    expect((await rateLimit("k", rule, t)).allowed).toBe(true);
    const blocked = await rateLimit("k", rule, t + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(9);
    expect((await rateLimit("k", rule, t + 10_001)).allowed).toBe(true);
  });
});

describe("share store", () => {
  const payload = {
    language: "en" as const,
    type: "Barangay invitation",
    dates: ["20 November 2026"],
    nextSteps: ["What should I bring?"],
  };
  it("only the owner can revoke, and expiry is enforced", async () => {
    const rec = await memoryShareStore.create("owner", payload, 1);
    expect(await memoryShareStore.revoke(rec.id, "other")).toBe(false);
    expect(await memoryShareStore.get(rec.id)).not.toBeNull();
    expect(await memoryShareStore.revoke(rec.id, "owner")).toBe(true);
    expect(await memoryShareStore.get(rec.id)).toBeNull();

    const expired = await memoryShareStore.create("owner", payload, -1);
    expect(await memoryShareStore.get(expired.id)).toBeNull();
  });
  it("revokeAll removes only that owner's links", async () => {
    const a = await memoryShareStore.create("a", payload, 1);
    const b = await memoryShareStore.create("b", payload, 1);
    expect(await memoryShareStore.revokeAll("a")).toBeGreaterThanOrEqual(1);
    expect(await memoryShareStore.get(a.id)).toBeNull();
    expect(await memoryShareStore.get(b.id)).not.toBeNull();
  });
});
