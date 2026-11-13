import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ReportInput } from "./gateway";
import { preparationGroups } from "./preparation";

/** Created on the user's device; exporting sends no document text to a server. */
export async function createReport(input: ReportInput): Promise<Blob> {
  if (!input.analysis) throw new Error("No analysis to export");
  const response = await fetch("/fonts/Geist-Regular.ttf");
  if (!response.ok) throw new Error("Report font unavailable");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await response.arrayBuffer(), {
    subset: true,
  });
  const supported = new Set(font.getCharacterSet());
  const clean = (text: string) =>
    Array.from(text)
      .map((c) => (c === "\n" || supported.has(c.codePointAt(0)!) ? c : "?"))
      .join("");
  const en = input.language === "en";
  const ink = rgb(24 / 255, 50 / 255, 75 / 255),
    teal = rgb(20 / 255, 125 / 255, 115 / 255);
  let page = doc.addPage([595.28, 841.89]);
  let y = 790;
  function line(text: string, size: number, accent: boolean) {
    if (y < 65) {
      page = doc.addPage([595.28, 841.89]);
      y = 790;
    }
    page.drawText(text, { x: 44, y, font, size, color: accent ? teal : ink });
    y -= size * 1.5;
  }
  function paragraph(text: string, size = 11, accent = false) {
    for (const para of clean(text).split("\n")) {
      let current = "";
      // Break long unspaced tokens as well as ordinary paragraphs.
      for (const word of para.split(/\s+/)) {
        if (
          current &&
          font.widthOfTextAtSize(current + " " + word, size) > 507
        ) {
          line(current, size, accent);
          current = "";
        }
        for (const char of (current ? " " : "") + word) {
          if (font.widthOfTextAtSize(current + char, size) > 507) {
            line(current, size, accent);
            current = "";
          }
          current += char;
        }
      }
      line(current, size, accent);
    }
    y -= 8;
  }
  doc.setTitle("LegaLinaw — Preparation summary");
  paragraph("LegaLinaw", 24, true);
  paragraph(en ? "Preparation summary" : "Buod sa paghahanda", 17);
  paragraph(
    en
      ? "Legal information, not legal advice. Check the original notice and consult qualified human help."
      : "Impormasyon, hindi legal advice. Suriin ang orihinal na notice at kumonsulta sa kwalipikadong tao.",
  );
  if (input.sample)
    paragraph(en ? "FICTIONAL SAMPLE" : "KATHANG-ISIP NA HALIMBAWA", 11, true);
  const a = input.analysis;
  paragraph(a.type, 15, true);
  paragraph(a.summary);
  paragraph(
    `${en ? "Stated date / time" : "Nakasulat na petsa / oras"}: ${a.date} · ${a.time}`,
  );
  paragraph(`${en ? "Sender" : "Nagpadala"}: ${a.sender}`);
  paragraph(
    en ? "Questions for a consultation" : "Mga tanong para sa konsultasyon",
    15,
    true,
  );
  for (const [i, q] of input.questions.entries()) paragraph(`${i + 1}. ${q}`);
  if (!input.questions.length)
    paragraph(en ? "No questions added." : "Wala pang idinagdag na tanong.");
  paragraph(en ? "Preparation checklist" : "Checklist sa paghahanda", 15, true);
  for (const group of preparationGroups(en)) {
    paragraph(group.title, 12, true);
    for (const [id, label] of group.items)
      paragraph(`${input.checked.includes(id) ? "[x]" : "[ ]"} ${label}`);
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`LegaLinaw  |  ${i + 1} / ${pages.length}`, {
      x: 44,
      y: 30,
      font,
      size: 9,
      color: ink,
    }),
  );
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });
}
