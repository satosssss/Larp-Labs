import { NOTICE_TYPES } from "../../lib/ai-types";

/** Prompt 2: document classification (a section of the combined analysis message). */
export const CLASSIFY_RULES = `type is one of ${NOTICE_TYPES.join(", ")}; use "unrecognized" if unclear, do not force one. typeEvidence is a sentence copied from the document that shows the type.`;
