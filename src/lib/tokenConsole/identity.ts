import type { DocumentType, IdentityResult } from "../omniApi";

/* What the KYC desk shows about an applicant's identity checks, from
   omnichannel: the population-registry result of the application, and the
   selfie and ID photos the customer sent. */

export const DOC_LABEL: Record<DocumentType, string> = { SELFIE: "Selfie", ID_FRONT: "ID front", ID_BACK: "ID back" };
export const DOC_ORDER: DocumentType[] = ["SELFIE", "ID_FRONT", "ID_BACK"];

export const REGISTRY_RESULT: Record<IdentityResult, { tone: "success" | "danger" | "warning"; text: string }> = {
  MATCH: { tone: "success", text: "Matches registry" },
  MISMATCH: { tone: "danger", text: "Registry mismatch" },
  UNCHECKED: { tone: "warning", text: "Not checked" },
};

const ID_SIDES: DocumentType[] = ["ID_FRONT", "ID_BACK"];
const ALL_PHOTOS: DocumentType[] = ["SELFIE", ...ID_SIDES];

/** Ready-made reasons, in the customer's words: the note is sent to them.
 *  `short` labels the chip; `text` is what is sent. */
export const TURN_DOWN_REASONS: { short: string; text: string; for: DocumentType[] }[] = [
  { short: "Face not visible", text: "Your face is not fully visible. Please retake the selfie in good light.", for: ["SELFIE"] },
  { short: "Blurry", text: "The photo is blurry. Please retake it holding the phone steady.", for: ALL_PHOTOS },
  { short: "Glare", text: "Glare covers part of the ID. Please retake it away from direct light.", for: ID_SIDES },
  { short: "Cut off", text: "Part of the ID is cut off. Please fit all four corners in the frame.", for: ID_SIDES },
  { short: "Not their ID", text: "The ID in the photo doesn't match the details you applied with. Please photograph your own ID.", for: ID_SIDES },
  { short: "Not the same person", text: "The selfie doesn't match the photo on your ID. Please retake the selfie yourself.", for: ["SELFIE"] },
];

/** "name" -> "name", "date_of_birth" -> "date of birth": a differing field as words. */
export const fieldWords = (f: string) => f.toLowerCase().replace(/_/g, " ");
