import { describe, expect, it } from "vitest";
import {
  MIN_QUOTE_CHARS,
  groundClaim,
  groundClaims,
  groundDates,
  groundSender,
  isStillValid,
  locateQuote,
  markOutdated,
} from "../../src/server/ai/source-checker";
import type { RawClaim, RawDate } from "../../src/lib/ai-types";
import { BARANGAY_FIL, DEMAND_EN } from "../fixtures/notices";

const DATE_SENTENCE =
  "Inaanyayahan kayong dumalo sa isang pag-uusap sa tanggapan ng barangay sa ika-20 ng Nobyembre 2026, alas-9:00 ng umaga, tungkol sa isang usapin sa inyong kapitbahay.";

describe("locateQuote", () => {
  it("accepts an exact substring and returns its real offsets", () => {
    const ev = locateQuote(BARANGAY_FIL, DATE_SENTENCE)!;
    expect(ev).not.toBeNull();
    expect(BARANGAY_FIL.slice(ev.start, ev.end)).toBe(DATE_SENTENCE);
  });
  it("rejects near misses: case, ellipsis, paraphrase, changed words", () => {
    expect(locateQuote(BARANGAY_FIL, DATE_SENTENCE.toUpperCase())).toBeNull();
    expect(
      locateQuote(BARANGAY_FIL, DATE_SENTENCE.replace("sa isang", "saisang")),
    ).toBeNull();
    expect(
      locateQuote(BARANGAY_FIL, DATE_SENTENCE.replace("2026", "2027")),
    ).toBeNull();
    expect(
      locateQuote(BARANGAY_FIL, "Inaanyayahan kayong dumalo ... kapitbahay."),
    ).toBeNull();
    expect(
      locateQuote(BARANGAY_FIL, "You are invited to a meeting on Nov 20."),
    ).toBeNull();
  });
  it("rejects empty, tiny, non-string quotes", () => {
    for (const q of [
      "",
      "   ",
      "a".repeat(MIN_QUOTE_CHARS - 1),
      null,
      5,
      undefined,
    ])
      expect(locateQuote(BARANGAY_FIL, q)).toBeNull();
  });
});

describe("locateQuote tolerates whitespace only, and always returns an exact slice", () => {
  // OCR output is hard-wrapped; models join the lines with a single space.
  const WRAPPED =
    "Inaanyayahan kayong dumalo sa isang pag-uusap sa\ntanggapan ng barangay sa ika-20 ng Nobyembre 2026,\nalas-9:00 ng umaga.\n\nMangyaring dalhin ang liham na ito.";
  const JOINED =
    "tanggapan ng barangay sa ika-20 ng Nobyembre 2026, alas-9:00 ng umaga";

  it("matches a quote that joins hard-wrapped lines with spaces", () => {
    const ev = locateQuote(WRAPPED, JOINED)!;
    expect(ev).not.toBeNull();
    // The evidence is the ORIGINAL text, including its line breaks.
    expect(ev.quote).toBe(
      "tanggapan ng barangay sa ika-20 ng Nobyembre 2026,\nalas-9:00 ng umaga",
    );
    expect(WRAPPED.slice(ev.start, ev.end)).toBe(ev.quote);
    // So the frontend's own indexOf-based check still passes.
    expect(WRAPPED.indexOf(ev.quote)).toBe(ev.start);
  });
  it("tolerates extra spaces, tabs and non-breaking spaces", () => {
    const messy = "Mula  sa:\t\u00a0Tanggapan ng   Barangay Halimbawa";
    const ev = locateQuote(messy, "Mula sa: Tanggapan ng Barangay Halimbawa")!;
    expect(ev.quote).toBe(messy);
    expect(messy.slice(ev.start, ev.end)).toBe(ev.quote);
  });
  it("prefers an exact match and keeps the model's text when it is exact", () => {
    const ev = locateQuote(WRAPPED, "Mangyaring dalhin ang liham na ito.")!;
    expect(ev.quote).toBe("Mangyaring dalhin ang liham na ito.");
  });
  it("still rejects anything that differs beyond whitespace", () => {
    expect(locateQuote(WRAPPED, JOINED.replace("20", "21"))).toBeNull();
    expect(locateQuote(WRAPPED, JOINED.toUpperCase())).toBeNull();
    expect(
      locateQuote(WRAPPED, "tanggapan ng barangay ... alas-9:00"),
    ).toBeNull();
    expect(locateQuote(WRAPPED, JOINED.replace(" ", ""))).toBeNull();
  });
  it("still refuses tiny or whitespace-only quotes", () => {
    expect(locateQuote(WRAPPED, " \n \t ")).toBeNull();
    expect(locateQuote(WRAPPED, "a  b")).toBeNull();
  });
  it("grounds a date that spans a line break", () => {
    const text = "Dumalo kayo sa ika-20 ng\nNobyembre 2026 sa barangay hall.";
    const { dates } = groundDates(text, [
      {
        kind: "appearance",
        label: "x",
        dateText: "ika-20 ng Nobyembre 2026",
        timeText: null,
        quote: "Dumalo kayo sa ika-20 ng Nobyembre 2026 sa barangay hall.",
      },
    ]);
    expect(dates).toHaveLength(1);
    expect(text.slice(dates[0].evidence.start, dates[0].evidence.end)).toBe(
      dates[0].evidence.quote,
    );
  });
});

describe("groundClaim", () => {
  const claim = (over: Partial<RawClaim>): RawClaim => ({
    text: "Ang pag-uusap ay sa 20 Nobyembre.",
    kind: "date",
    basis: "document",
    quote: DATE_SENTENCE,
    ...over,
  });
  it("marks a verified document claim as supported", () => {
    const g = groundClaim(BARANGAY_FIL, claim({}));
    expect(g.status).toBe("supported");
    expect(g.evidence?.quote).toBe(DATE_SENTENCE);
  });
  it("never fabricates: a made-up quote becomes not_stated with no evidence", () => {
    const g = groundClaim(
      BARANGAY_FIL,
      claim({
        quote: "Dapat kayong magbayad ng PHP 5,000 bago mag-Disyembre.",
      }),
    );
    expect(g.status).toBe("not_stated");
    expect(g.evidence).toBeNull();
  });
  it("a document claim with no quote is not_stated", () => {
    expect(groundClaim(BARANGAY_FIL, claim({ quote: null })).status).toBe(
      "not_stated",
    );
  });
  it("keeps general information labeled general, never supported", () => {
    const g = groundClaim(
      BARANGAY_FIL,
      claim({ kind: "other", basis: "general", quote: null }),
    );
    expect(g.status).toBe("general");
    expect(g.evidence).toBeNull();
  });
  it("a date, amount or party can never be 'general information'", () => {
    for (const kind of ["date", "amount", "party"] as const)
      expect(
        groundClaim(
          BARANGAY_FIL,
          claim({ kind, basis: "general", quote: null }),
        ).status,
      ).toBe("not_stated");
  });
  it("groundClaims keeps order and length", () => {
    const out = groundClaims(BARANGAY_FIL, [claim({}), claim({ quote: null })]);
    expect(out.map((c) => c.status)).toEqual(["supported", "not_stated"]);
  });
});

describe("groundDates (date and deadline extraction)", () => {
  const date = (over: Partial<RawDate>): RawDate => ({
    kind: "appearance",
    label: "Pag-uusap",
    dateText: "ika-20 ng Nobyembre 2026",
    timeText: "alas-9:00 ng umaga",
    quote: DATE_SENTENCE,
    ...over,
  });
  it("keeps a date and time that appear inside the verified quote", () => {
    const { dates, rejected } = groundDates(BARANGAY_FIL, [date({})]);
    expect(rejected).toBe(0);
    expect(dates[0].dateText).toBe("ika-20 ng Nobyembre 2026");
    expect(dates[0].timeText).toBe("alas-9:00 ng umaga");
    expect(dates[0].evidence.quote).toBe(DATE_SENTENCE);
  });
  it("rejects a date that is not written in its quote", () => {
    const { dates, rejected } = groundDates(BARANGAY_FIL, [
      date({ dateText: "ika-25 ng Nobyembre 2026" }),
    ]);
    expect(dates).toEqual([]);
    expect(rejected).toBe(1);
  });
  it("rejects a date that appears nowhere in the document, whatever its quote says", () => {
    const { dates, rejected } = groundDates(BARANGAY_FIL, [
      date({
        dateText: "December 1, 2026",
        quote: "Hearing on December 1, 2026 at the Hall of Justice.",
      }),
    ]);
    expect(dates).toEqual([]);
    expect(rejected).toBe(1);
  });
  it("when the model's quote is wrong but the date text IS in the document, the code finds the evidence itself", () => {
    const { dates, rejected } = groundDates(BARANGAY_FIL, [
      date({ quote: "Dumalo kayo sa pulong sa ika-20 ng Nobyembre 2026 po." }),
    ]);
    expect(rejected).toBe(0);
    expect(dates).toHaveLength(1);
    const ev = dates[0].evidence;
    // Built from the real text, as an exact slice, around the real date.
    expect(BARANGAY_FIL.slice(ev.start, ev.end)).toBe(ev.quote);
    expect(ev.quote).toContain("ika-20 ng Nobyembre 2026");
    expect(ev.quote).toBe(DATE_SENTENCE);
    // The time sits in the same sentence, so it is kept.
    expect(dates[0].timeText).toBe("alas-9:00 ng umaga");
  });
  it("builds sentence evidence across hard-wrapped lines", () => {
    const wrapped =
      "BARANGAY HALIMBAWA\nPAANYAYA SA PAG-UUSAP\nInaanyayahan kayong dumalo sa isang pag-uusap sa\ntanggapan ng barangay sa ika-20 ng Nobyembre 2026,\nalas-9:00 ng umaga.\nMangyaring dalhin ang liham na ito.";
    const { dates } = groundDates(wrapped, [
      date({ quote: "totally unrelated words that are not present" }),
    ]);
    expect(dates[0].evidence.quote).toBe(
      "Inaanyayahan kayong dumalo sa isang pag-uusap sa\ntanggapan ng barangay sa ika-20 ng Nobyembre 2026,\nalas-9:00 ng umaga.",
    );
    expect(dates[0].timeText).toBe("alas-9:00 ng umaga");
  });
  it("does not invent a time that is not near the date", () => {
    const { dates } = groundDates(BARANGAY_FIL, [
      date({
        quote: "wrong quote entirely, not in doc",
        timeText: "alas-3:00 ng hapon",
      }),
    ]);
    expect(dates[0].timeText).toBeNull();
  });
  it("lists a date only once even if the model repeats it", () => {
    const { dates } = groundDates(BARANGAY_FIL, [
      date({}),
      date({ quote: null }),
    ]);
    expect(dates).toHaveLength(1);
  });
  it("refuses date text that is too short to be evidence", () => {
    expect(
      groundDates(BARANGAY_FIL, [date({ dateText: "20", quote: null })]).dates,
    ).toEqual([]);
  });
  it("drops an unverifiable time but keeps the date", () => {
    const { dates } = groundDates(BARANGAY_FIL, [
      date({ timeText: "alas-3:00 ng hapon" }),
    ]);
    expect(dates).toHaveLength(1);
    expect(dates[0].timeText).toBeNull();
  });
  it("never invents a deadline from 'within N days'", () => {
    const { dates } = groundDates(DEMAND_EN, [
      date({
        dateText: "5 days from receipt",
        quote: "Failure to pay may result in a civil case being filed.",
      }),
    ]);
    expect(dates).toEqual([]);
  });
  it("caps results at 5", () => {
    const months = [
      "Enero",
      "Pebrero",
      "Marso",
      "Abril",
      "Mayo",
      "Hunyo",
      "Hulyo",
      "Agosto",
    ];
    const text = months.map((m) => `Dumalo sa 1 ${m} 2027 po.`).join("\n");
    const many = months.map((m) =>
      date({
        dateText: `1 ${m} 2027`,
        timeText: null,
        quote: `Dumalo sa 1 ${m} 2027 po.`,
      }),
    );
    expect(groundDates(text, many).dates).toHaveLength(5);
  });
  it("an English date is found when stated", () => {
    const q = "demands payment of PHP 12,500.00 on or before December 5, 2026.";
    const { dates } = groundDates(DEMAND_EN, [
      date({
        kind: "deadline",
        dateText: "December 5, 2026",
        timeText: null,
        quote: q,
      }),
    ]);
    expect(dates[0].dateText).toBe("December 5, 2026");
    expect(dates[0].timeText).toBeNull();
  });
});

describe("groundSender", () => {
  it("accepts a sender whose name is inside a verified quote", () => {
    const s = groundSender(BARANGAY_FIL, {
      name: "Tanggapan ng Barangay Malinaw",
      quote: "Mula sa: Tanggapan ng Barangay Malinaw",
    });
    expect(s?.name).toBe("Tanggapan ng Barangay Malinaw");
  });
  it("rejects an invented sender or a name not in its quote", () => {
    expect(
      groundSender(BARANGAY_FIL, {
        name: "Office of the Mayor",
        quote: "Mula sa: Office of the Mayor",
      }),
    ).toBeNull();
    expect(
      groundSender(BARANGAY_FIL, {
        name: "Office of the Mayor",
        quote: "Mula sa: Tanggapan ng Barangay Malinaw",
      }),
    ).toBeNull();
    expect(groundSender(BARANGAY_FIL, null)).toBeNull();
  });
});

describe("groundSender fallback", () => {
  it("finds the sender itself when the model's quote does not verify", () => {
    const s = groundSender(BARANGAY_FIL, {
      name: "Tanggapan ng Barangay Malinaw",
      quote: "Ipinadala ng Tanggapan ng Barangay Malinaw noong Lunes",
    })!;
    expect(s.name).toBe("Tanggapan ng Barangay Malinaw");
    expect(s.evidence?.quote).toBe("Mula sa: Tanggapan ng Barangay Malinaw");
    expect(BARANGAY_FIL.slice(s.evidence!.start, s.evidence!.end)).toBe(
      s.evidence!.quote,
    );
  });
  it("still rejects a sender that is not in the document at all", () => {
    expect(
      groundSender(BARANGAY_FIL, {
        name: "Department of Justice",
        quote: null,
      }),
    ).toBeNull();
  });
});

describe("markOutdated after the user edits the text", () => {
  it("flags evidence that no longer matches and keeps the rest", () => {
    const ev = locateQuote(BARANGAY_FIL, DATE_SENTENCE)!;
    const edited = BARANGAY_FIL.replace("20 ng Nobyembre", "27 ng Nobyembre");
    expect(markOutdated([ev], BARANGAY_FIL)[0].outdated).toBe(false);
    expect(markOutdated([ev], edited)[0].outdated).toBe(true);
    expect(isStillValid(edited, ev)).toBe(false);
  });
});
