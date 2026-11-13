import { describe, expect, it } from "vitest";
import {
  declineText,
  evaluate,
  evaluateAll,
  isAdviceRequest,
  withheldText,
} from "../../src/server/ai/guardrail";

const blocked = (text: string, rule?: "outcome" | "directive") => {
  const v = evaluate(text);
  expect(v.ok, text).toBe(false);
  if (rule && !v.ok) expect(v.rule, text).toBe(rule);
};
const allowed = (text: string) => expect(evaluate(text).ok, text).toBe(true);

describe("outcome predictions are blocked (English and Filipino)", () => {
  it.each([
    "You will win this case.",
    "You'll lose in court.",
    "You will probably be convicted.",
    "You will be jailed if you do not respond.",
    "You won't go to jail.",
    "The court will rule in your favor.",
    "Mananalo ka dito.",
    "Matatalo ka sa kaso.",
    "Makukulong ka kapag hindi ka sumipot.",
    "Hindi ka makukulong.",
    "Ikaw ay mananalo.",
  ])("%s", (t) => blocked(t, "outcome"));
});

describe("directives are blocked (English and Filipino)", () => {
  it.each([
    "You should pay the amount now.",
    "You must sign the agreement.",
    "I recommend that you settle this.",
    "You can safely ignore this notice.",
    "Do not attend the hearing.",
    "Plead guilty to end this quickly.",
    "Sign here and send it back.",
    "Pay the amount today.",
    "Dapat kang magbayad ngayon.",
    "Kailangan mong pumirma sa kasunduan.",
    "Magbayad ka na.",
    "Huwag mong pansinin ang liham.",
    "Huwag kang dumalo.",
  ])("%s", (t) => blocked(t, "directive"));
});

describe("legitimate explanations are not over-blocked", () => {
  it.each([
    "The letter asks you to pay PHP 12,500 by December 5, 2026.",
    "According to the notice, you should appear at the barangay hall.",
    "Ayon sa liham, kailangan mong magbayad bago ang Disyembre 5.",
    "Hinihingi ng liham na magbayad ka ng PHP 12,500.",
    "Nakasaad sa liham na dumalo kayo sa ika-20 ng Nobyembre.",
    "Pay attention to the date written in the notice.",
    "If you do not respond, you will lose the right to appeal, if the notice is accurate.",
    "You may want to ask the Public Attorney's Office for free help.",
    "Do not share your OTP or password with anyone.",
    "Hindi ko masasabi kung mananalo ka sa kaso.",
    "I cannot predict whether you will win. Please ask a lawyer.",
    "I can't tell you if you will be jailed or not.",
    "Ang paanyaya ay para sa isang pag-uusap sa barangay.",
  ])("%s", allowed);

  it("a decline phrase does not excuse a prediction made elsewhere", () => {
    blocked("I can't say much, but you will win.", "outcome");
    blocked("Mananalo ka. Hindi ko masasabi kung kailan.", "outcome");
  });
  it("attribution does not excuse an outcome prediction", () => {
    blocked("According to the letter, you will lose.", "outcome");
  });
});

describe("evaluateAll", () => {
  it("fails if any one string fails and passes when all are clean", () => {
    expect(evaluateAll(["Maayos ito.", "You will win."]).ok).toBe(false);
    expect(evaluateAll(["Maayos ito.", "May petsa sa liham."]).ok).toBe(true);
    expect(evaluateAll([]).ok).toBe(true);
  });
});

describe("isAdviceRequest", () => {
  it.each([
    "Should I pay this?",
    "Should I ignore the letter?",
    "What should I do?",
    "Will I win?",
    "Can I just ignore it?",
    "Do I need to sign anything?",
    "Dapat ba akong magbayad?",
    "Ano ang dapat kong gawin?",
    "Mananalo ba ako?",
    "Makukulong ba ako?",
    "Kailangan ko bang dumalo?",
  ])("%s", (q) => expect(isAdviceRequest(q)).toBe(true));
  it.each([
    "What is the letter about?",
    "When is the conversation?",
    "What does it say to bring?",
    "Tungkol saan ang notice?",
    "Kailan ang pag-uusap?",
    "Should I bring an ID?",
  ])("%s is a normal question", (q) => expect(isAdviceRequest(q)).toBe(false));
});

describe("fixed messages", () => {
  it("are non-empty in both languages and say it is not a lawyer / not advice", () => {
    expect(declineText("en")).toMatch(/not a lawyer/i);
    expect(declineText("fil")).toMatch(/abogado/i);
    expect(withheldText("en")).toMatch(/legal advice/i);
    expect(withheldText("fil")).toMatch(/legal/i);
  });
});
