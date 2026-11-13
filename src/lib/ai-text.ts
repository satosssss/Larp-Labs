import type { Language } from "./sample";
import type { NoticeType, UncertaintyCode } from "./ai-types";

/** Fixed user-facing strings for AI results. Filipino first. */

export const NOT_STATED: Record<Language, string> = {
  fil: "Hindi ito nakasaad sa dokumento.",
  en: "This is not stated in the document.",
};
export const NOT_STATED_SHORT: Record<Language, string> = {
  fil: "Hindi nakasaad sa dokumento",
  en: "Not stated in the document",
};
export const GENERAL_INFO: Record<Language, string> = {
  fil: "Pangkalahatang impormasyon",
  en: "General information",
};
export const DISCLAIMER: Record<Language, string> = {
  fil: "Hindi ito legal advice. Hindi abogado ang LegaLinaw. Kumonsulta sa abogado o sa Public Attorney's Office para sa payo tungkol sa sitwasyon mo.",
  en: "This is not legal advice. LegaLinaw is not a lawyer. Consult a lawyer or the Public Attorney's Office for advice about your situation.",
};
export const GUARDRAIL_WITHHELD: Record<Language, string> = {
  fil: "Hindi maipapakita ang sagot na ito dahil hindi nagbibigay ng legal na payo ang LegaLinaw. Humanap ng libreng legal na tulong.",
  en: "This response could not be shown because LegaLinaw does not give legal advice. Please look for free legal help.",
};
export const ADVICE_DECLINED: Record<Language, string> = {
  fil: "Hindi abogado ang LegaLinaw, kaya hindi namin masasabi kung ano ang dapat mong gawin o kung ano ang kalalabasan ng kaso. Makakatulong ang libreng legal na tulong sa Help page.",
  en: "LegaLinaw is not a lawyer, so we cannot tell you what to do or how a case will turn out. Free legal help is available on the Help page.",
};

export const NOTICE_TYPE_LABEL: Record<NoticeType, Record<Language, string>> = {
  subpoena: { fil: "Subpoena", en: "Subpoena" },
  court_notice: { fil: "Paunawa mula sa korte", en: "Court notice" },
  barangay_notice: {
    fil: "Paunawa mula sa barangay",
    en: "Barangay notice",
  },
  demand_letter: { fil: "Demand letter", en: "Demand letter" },
  lending_app_collection: {
    fil: "Paniningil mula sa lending app",
    en: "Lending-app collection notice",
  },
  government_agency: {
    fil: "Paunawa mula sa ahensya ng gobyerno",
    en: "Government agency notice",
  },
  legal_agreement: { fil: "Legal na kasunduan", en: "Legal agreement" },
  unrecognized: {
    fil: "Hindi matukoy ang uri",
    en: "Document type could not be determined",
  },
};

export const UNCERTAINTY_MESSAGE: Record<
  UncertaintyCode,
  Record<Language, string>
> = {
  low_confidence: {
    fil: "Hindi sigurado ang AI sa uri ng dokumento kaya hindi ito itinakda.",
    en: "The AI was not confident about the document type, so none was assigned.",
  },
  unsupported_classification: {
    fil: "Walang matibay na bahagi ng dokumento na sumusuporta sa uri na iminungkahi, kaya hindi ito itinakda.",
    en: "No passage of the document supported the suggested type, so none was assigned.",
  },
  invalid_type: {
    fil: "Hindi balidong uri ang ibinalik ng AI kaya hindi ito itinakda.",
    en: "The AI returned an unrecognized type, so none was assigned.",
  },
  user_override: {
    fil: "Ikaw ang pumili ng uri ng dokumento.",
    en: "You chose the document type.",
  },
  unsupported_claims_removed: {
    fil: "May mga pahayag na hindi masuportahan ng dokumento kaya minarkahan ang mga ito.",
    en: "Some statements could not be supported by the document and are marked.",
  },
  unsupported_dates_removed: {
    fil: "May mga petsang inalis dahil hindi ito makita sa dokumento.",
    en: "Some dates were removed because they could not be found in the document.",
  },
  no_dates_found: {
    fil: "Walang petsang nakasaad sa dokumento.",
    en: "No date is stated in the document.",
  },
};
