import { COMPLIANCE_PROFILES, type RiskRating } from "./compliance";

/** Classifiers, per data spec §8 and the proposal's §4.6.
 *
 * Risk tier, KYC status, jurisdiction and preferred payment channel are NOT
 * columns on the investor row. They are typed, versioned assignments with a
 * validity window, so a status change never erases what was true before it and
 * "what was this investor's risk tier on 4 June, and why did it change" has a
 * direct answer instead of requiring someone to read a narrative audit trail.
 *
 * The proposal names this specifically as a Phase 1 gap to close: on the live
 * system the intended `investor_risk_history` table has **zero rows** and the
 * real history lives only in the classifier-assignment table. Anyone querying
 * the audit table for it would find it empty and have to know to look
 * elsewhere. Here there is one place: assignments below. `riskTierAsOf` is the
 * query that gap made impossible.
 *
 * Product eligibility is meant to be expressed as a rule against classifier
 * values (`eligibleForProduct`) rather than as hardcoded checks scattered
 * through application code. */

export type ClassifierTypeId = "risk_tier" | "kyc_status" | "jurisdiction" | "payment_channel";

export type ClassifierType = {
  id: ClassifierTypeId;
  label: string;
  description: string;
  /** Values that satisfy a product-eligibility rule. A value absent from this
   * list does not block by accident — it blocks by configuration. */
  eligibleValues: string[];
  values: { value: string; label: string; note?: string }[];
};

export const CLASSIFIER_TYPES: ClassifierType[] = [
  {
    id: "risk_tier",
    label: "Risk tier",
    description: "AML customer risk rating. Drives EDD, screening cadence and monitoring thresholds.",
    eligibleValues: ["low", "medium"],
    values: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High", note: "EDD must complete before activation (KYC §12)." },
    ],
  },
  {
    id: "kyc_status",
    label: "KYC status",
    description: "Whether identity verification has been completed and accepted.",
    eligibleValues: ["verified"],
    values: [
      { value: "verified", label: "Verified" },
      { value: "pending", label: "Pending" },
      { value: "rejected", label: "Rejected" },
    ],
  },
  {
    id: "jurisdiction",
    label: "Jurisdiction",
    description:
      "Where the investor is resident for distribution purposes. The list reflects the institution's documented investor base: Kenyan residents plus Kenyan diaspora.",
    // CONFLICT, unresolved on purpose: the data spec reads US-diaspora-KE as an
    // approved value on the live database, while `platform.ts` marks the US
    // segment `excluded` (SEC jurisdiction; Reg S / Reg D structuring needed).
    // One of the two is wrong and it is a Compliance call, not an engineering
    // one — so US is seeded as a value but NOT as an eligible one, which is the
    // safe direction to be wrong in. See CLAUDE.md, "Where the apps and the
    // docs diverge".
    eligibleValues: ["KE", "UK-diaspora-KE", "UAE-diaspora-KE"],
    values: [
      { value: "KE", label: "Kenya (resident)" },
      { value: "UK-diaspora-KE", label: "Kenyan diaspora — UK" },
      { value: "UAE-diaspora-KE", label: "Kenyan diaspora — UAE" },
      { value: "US-diaspora-KE", label: "Kenyan diaspora — US", note: "Seeded but not eligible — the data spec and Platform Settings disagree on this one. Compliance to confirm." },
    ],
  },
  {
    id: "payment_channel",
    label: "Preferred payment channel",
    description: "Where subscriptions are collected and payouts sent by default.",
    eligibleValues: ["mpesa", "airtel_money", "pesalink", "bank_wire", "equity_direct"],
    values: [
      { value: "mpesa", label: "M-Pesa" },
      { value: "airtel_money", label: "Airtel Money" },
      { value: "pesalink", label: "Pesalink" },
      { value: "bank_wire", label: "Bank wire" },
      { value: "equity_direct", label: "Equity — account-linked" },
    ],
  },
];

export function classifierType(id: ClassifierTypeId): ClassifierType {
  return CLASSIFIER_TYPES.find((t) => t.id === id)!;
}

/** One dated assignment. `validTo === null` means current. Closing a window
 * and opening the next is the only way a value changes — nothing is updated
 * in place, which is what preserves the history. */
export type ClassifierAssignment = {
  id: string;
  entityType: "investor";
  entityId: string;
  typeId: ClassifierTypeId;
  value: string;
  validFrom: string;
  validTo: string | null;
  assignedBy: string;
  /** Why it changed. The half of an audit trail that a bare value loses, and
   * the half a regulator actually asks about. */
  reason?: string;
  /** What it changed from, denormalised for readability — derivable from the
   * previous window, kept so a single row reads as a complete event. */
  previousValue?: string;
};

let assignmentSeq = 1;

function assignment(
  entityId: string, typeId: ClassifierTypeId, value: string,
  validFrom: string, validTo: string | null, assignedBy: string,
  reason?: string, previousValue?: string,
): ClassifierAssignment {
  return {
    id: `CA-${String(assignmentSeq++).padStart(5, "0")}`,
    entityType: "investor", entityId, typeId, value, validFrom, validTo, assignedBy,
    ...(reason ? { reason } : {}),
    ...(previousValue ? { previousValue } : {}),
  };
}

/** Seeded so the history is genuinely a history — a client whose only row is
 * "current" proves nothing about whether the model preserves anything. */
export const CLASSIFIER_ASSIGNMENTS: ClassifierAssignment[] = [
  // inv_2891 — the demo investor. Onboarded low, briefly raised on a
  // monitoring alert, returned to low once the case closed. That middle window
  // is exactly what a mutable column would have destroyed.
  assignment("inv_2891", "risk_tier", "low", "2026-03-14", "2026-06-02", "System (Onboarding)", "Initial rating at onboarding — screening clear, no EDD."),
  assignment("inv_2891", "risk_tier", "medium", "2026-06-02", "2026-07-19", "Peter Otieno", "Velocity alert AML-2261 — three subscriptions in one day against a 90-day average of 0.4.", "low"),
  assignment("inv_2891", "risk_tier", "low", "2026-07-19", null, "Peter Otieno", "Case AML-2261 closed, no suspicion. Behaviour explained by a bonus payment.", "medium"),
  assignment("inv_2891", "kyc_status", "pending", "2026-03-14", "2026-03-14", "System (Onboarding)"),
  assignment("inv_2891", "kyc_status", "verified", "2026-03-14", null, "System (Smile Identity)", "ID, liveness and KRA PIN all matched.", "pending"),
  assignment("inv_2891", "jurisdiction", "KE", "2026-03-14", null, "System (Onboarding)"),
  assignment("inv_2891", "payment_channel", "mpesa", "2026-03-14", null, "Amina Wanjiru"),

  // inv_3350 — rated high, EDD outstanding. One window, still open.
  assignment("inv_3350", "risk_tier", "medium", "2026-08-06", "2026-08-08", "System (Onboarding)", "Initial rating at onboarding."),
  assignment("inv_3350", "risk_tier", "high", "2026-08-08", null, "Peter Otieno", "Transaction behaviour and an unclear source of funds. EDD required before activation.", "medium"),
  assignment("inv_3350", "kyc_status", "pending", "2026-08-06", null, "System (Onboarding)"),
  assignment("inv_3350", "jurisdiction", "KE", "2026-08-06", null, "System (Onboarding)"),

  // inv_3122 — diaspora, so the jurisdiction classifier is doing real work.
  assignment("inv_3122", "risk_tier", "medium", "2026-05-03", null, "Peter Otieno", "Acquisition channel (IFA referral) and adverse-media association."),
  assignment("inv_3122", "kyc_status", "verified", "2026-05-03", null, "System (Smile Identity)"),
  assignment("inv_3122", "jurisdiction", "UK-diaspora-KE", "2026-05-03", null, "Peter Otieno", "Residence confirmed at screening."),
  assignment("inv_3122", "payment_channel", "bank_wire", "2026-05-03", null, "Grace Mumbi"),

  assignment("inv_2765", "kyc_status", "pending", "2026-08-05", null, "System (Onboarding)"),
  assignment("inv_2765", "jurisdiction", "KE", "2026-08-05", null, "System (Onboarding)"),

  assignment("inv_2601", "risk_tier", "low", "2026-02-11", null, "System (Onboarding)"),
  assignment("inv_2601", "kyc_status", "verified", "2026-02-11", null, "System (Smile Identity)"),
  assignment("inv_2601", "jurisdiction", "KE", "2026-02-11", null, "System (Onboarding)"),
  assignment("inv_2601", "payment_channel", "mpesa", "2026-02-11", null, "Esther Chebet"),
];

/** The query the empty `investor_risk_history` table made impossible. A date
 * inside a closed window returns what was true then, not what is true now. */
export function classifierAsOf(
  entityId: string, typeId: ClassifierTypeId, asOf: string = new Date().toISOString().slice(0, 10),
): ClassifierAssignment | undefined {
  return CLASSIFIER_ASSIGNMENTS.find((a) =>
    a.entityId === entityId && a.typeId === typeId &&
    a.validFrom <= asOf && (a.validTo === null || a.validTo > asOf));
}

export function currentClassifier(entityId: string, typeId: ClassifierTypeId): ClassifierAssignment | undefined {
  return CLASSIFIER_ASSIGNMENTS.find((a) => a.entityId === entityId && a.typeId === typeId && a.validTo === null);
}

export function classifierHistory(entityId: string, typeId?: ClassifierTypeId): ClassifierAssignment[] {
  return CLASSIFIER_ASSIGNMENTS
    .filter((a) => a.entityId === entityId && (!typeId || a.typeId === typeId))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom) || b.id.localeCompare(a.id));
}

export function riskTierAsOf(entityId: string, asOf: string): RiskRating | null {
  const found = classifierAsOf(entityId, "risk_tier", asOf);
  return (found?.value as RiskRating) ?? null;
}

/** Closes the open window and opens a new one. The only writer — there is no
 * path that edits an assignment's value in place, by design.
 *
 * Re-assigning the same value is a no-op rather than a new window: a nightly
 * job that re-derives an unchanged rating should not manufacture history. */
export function assignClassifier(
  entityId: string, typeId: ClassifierTypeId, value: string, assignedBy: string, reason?: string,
  effectiveFrom: string = new Date().toISOString().slice(0, 10),
): ClassifierAssignment | null {
  const type = classifierType(typeId);
  if (!type.values.some((v) => v.value === value)) {
    throw new Error(`"${value}" is not a configured value for ${type.label}`);
  }
  const open = currentClassifier(entityId, typeId);
  if (open?.value === value) return null;

  // Closing a window before it opened would produce validTo < validFrom, and
  // `classifierAsOf` would then return nothing for the period in between.
  if (open && effectiveFrom < open.validFrom) {
    throw new Error(`Cannot backdate to ${effectiveFrom}: the current ${classifierType(typeId).label} window opened ${open.validFrom}`);
  }

  if (open) open.validTo = effectiveFrom;
  const next = assignment(entityId, typeId, value, effectiveFrom, null, assignedBy, reason, open?.value);
  CLASSIFIER_ASSIGNMENTS.push(next);
  return next;
}

/** Eligibility expressed against classifier values rather than re-implemented
 * per module — the same classifier read in three places gives one answer, not
 * three. Returns every failing reason, not just the first, so a client file
 * shows the whole picture instead of one blocker at a time. */
export function eligibleForProduct(entityId: string, asOf?: string): { eligible: boolean; failing: { typeId: ClassifierTypeId; label: string; value: string | null }[] } {
  const failing: { typeId: ClassifierTypeId; label: string; value: string | null }[] = [];
  for (const type of CLASSIFIER_TYPES) {
    // Preferred payment channel is a routing preference, not a gate.
    if (type.id === "payment_channel") continue;
    const found = classifierAsOf(entityId, type.id, asOf);
    if (!found || !type.eligibleValues.includes(found.value)) {
      failing.push({ typeId: type.id, label: type.label, value: found?.value ?? null });
    }
  }
  return { eligible: failing.length === 0, failing };
}

/** Coverage report — how much of the register actually carries each
 * classifier. The proposal's complaint about `investor_risk_history` was
 * precisely that nobody could see it was empty; a count that can be read is
 * the cheapest guard against the same thing recurring here. */
export function classifierCoverage(): { typeId: ClassifierTypeId; label: string; covered: number; total: number }[] {
  const clients = COMPLIANCE_PROFILES.map((p) => p.clientId);
  return CLASSIFIER_TYPES.map((t) => ({
    typeId: t.id,
    label: t.label,
    covered: clients.filter((id) => currentClassifier(id, t.id)).length,
    total: clients.length,
  }));
}
