export type Language = "fil" | "en";
export type Analysis = {
  language: Language;
  type: string;
  summary: string;
  quote: string;
  explanation: string;
  date: string;
  time: string;
  sender: string;
};
export const SAMPLE_TEXT = `HALIMBAWA LAMANG — HINDI TUNAY NA DOKUMENTO

BARANGAY MALINAW
PAANYAYA SA PAG-UUSAP

Para kay: [PANGALAN]

Inaanyayahan kayong dumalo sa isang pag-uusap sa tanggapan ng barangay sa ika-20 ng Nobyembre 2026, alas-9:00 ng umaga, tungkol sa isang usapin sa inyong kapitbahay.

Mangyaring dalhin ang liham na ito.

Para sa mga katanungan, makipag-ugnayan sa tanggapan ng barangay.

Mula sa: Tanggapan ng Barangay Malinaw

Kathang-isip na halimbawa para sa demonstrasyon.`;
export const SAMPLE_QUOTE =
  "Inaanyayahan kayong dumalo sa isang pag-uusap sa tanggapan ng barangay sa ika-20 ng Nobyembre 2026, alas-9:00 ng umaga, tungkol sa isang usapin sa inyong kapitbahay.";
export const sampleAnalysis = (language: Language): Analysis => ({
  language,
  type:
    language === "fil" ? "Paanyaya mula sa barangay" : "Barangay invitation",
  summary:
    language === "fil"
      ? "Iniimbitahan kang makipag-usap sa barangay tungkol sa isang usapin sa kapitbahay mo. Nasa notice ang petsa, oras, at lugar."
      : "You are invited to a conversation at the barangay about a matter involving a neighbor. The letter states a date, time, and location.",
  quote: SAMPLE_QUOTE,
  explanation:
    language === "fil"
      ? "Ito ang bahagi ng liham na nagsasabi kung para saan ang pag-uusap at kung kailan ito nakatakda."
      : "This passage describes the purpose of the conversation and when it is scheduled.",
  date: language === "fil" ? "20 Nobyembre 2026" : "20 November 2026",
  time: "9:00 AM · Philippine time",
  sender: "Tanggapan ng Barangay Malinaw",
});
export const sampleQuestions = [
  "Ano ang ibig sabihin ng notice na ito?",
  "Anong mga dokumento ang dapat kong ihanda?",
  "May deadline ba na kailangan kong malaman?",
  "Ano ang puwede kong gawin pagkatapos nito?",
  "May bayad ba ang konsultasyon?",
];
export const suggestions = {
  fil: [
    "Tungkol saan ang notice?",
    "Kailan ang pag-uusap?",
    "Ano ang kailangan kong dalhin?",
  ],
  en: [
    "What is the letter about?",
    "When is the conversation?",
    "What does it say to bring?",
  ],
};
export function sampleAnswer(
  question: string,
  language: Language,
): { text: string; quote?: string } {
  const index = suggestions[language].indexOf(question);
  if (index === 0)
    return { text: sampleAnalysis(language).summary, quote: SAMPLE_QUOTE };
  if (index === 1)
    return {
      text:
        language === "fil"
          ? "Ayon sa halimbawa: 20 Nobyembre 2026, 9:00 AM, sa tanggapan ng barangay."
          : "The example states 20 November 2026, 9:00 AM, at the barangay office.",
      quote: SAMPLE_QUOTE,
    };
  if (index === 2)
    return {
      text:
        language === "fil"
          ? "Nakasaad sa liham na dalhin ang liham mismo."
          : "The letter says to bring the letter itself.",
      quote: "Mangyaring dalhin ang liham na ito.",
    };
  return {
    text:
      language === "fil"
        ? "Demo lang ito: may nakahandang sagot lang sa mga tanong sa ibaba. Hindi pa nakakonekta ang live chat."
        : "This sample has prepared answers only for the suggested questions. Live document chat is not connected yet.",
  };
}
