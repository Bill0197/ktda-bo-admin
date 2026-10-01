/* KYC decisions against the tokenization service — shared by the console's
 * KYC desk and BO Admin's KYC Onboarding queue, so both make the same two
 * writes in the same order.
 *
 * Two separate facts are settled by one decision, and the API keeps them apart:
 *   the REVIEW      clear/reject — moves the investor's lifecycle, which is
 *                   what the investor app reads as "can invest"
 *   the CLASSIFIER  KYC_STATUS — what the register says about the applicant
 * Clearing a review alone leaves the register saying KYC PENDING on someone
 * already transacting, so a decision always writes both. */
import { tokenConsole } from "../api.tokenConsole";
import type { ComplianceReviewItem, InvestorView } from "./types.gen";

export type KycDecision = "verify" | "reject";

/** The review queue is shared with any rule that needs a human; KYC decides
 *  only the items about KYC. Anything else stays with Compliance. */
export const isKycReview = (r: ComplianceReviewItem) => (r.reason ?? "").toUpperCase().includes("KYC");

/** The three statuses the queue answers, one call each (it defaults to OPEN). */
export async function allReviews(): Promise<ComplianceReviewItem[]> {
  const [open, cleared, rejected] = await Promise.all([
    tokenConsole.complianceReviews("OPEN"),
    tokenConsole.complianceReviews("CLEARED"),
    tokenConsole.complianceReviews("REJECTED"),
  ]);
  return [...open, ...cleared, ...rejected];
}

export function currentClassifier(v: InvestorView | null | undefined, typeId: string) {
  return v?.classifiers?.find((c) => c.typeId === typeId && c.current);
}

/** A closed review can still leave the register saying PENDING (the two are
 *  written separately) — unfinished work, not a closed item. */
export function classifierOutstanding(v: InvestorView | null | undefined) {
  const kyc = currentClassifier(v, "KYC_STATUS");
  return !!kyc && kyc.code !== "VERIFIED" && kyc.code !== "REJECTED";
}

export async function decideKyc({
  investorId, queueId, reviewOpen, decision, note,
}: {
  investorId: string;
  queueId?: string;
  reviewOpen: boolean;
  decision: KycDecision;
  note?: string;
}): Promise<true> {
  const verifying = decision === "verify";
  // The review first. The engine decides a review once (409 if someone else
  // already did) and only for ADMIN or COMPLIANCE (403), so it is the gate:
  // a refusal there must stop before the register is touched — writing the
  // register first could mark verified someone another reviewer had just
  // rejected. If the register write then fails, the review is decided and the
  // desk shows "the register still says …" with a button to record it; KYC
  // on the register, not the review, is what lets anyone invest.
  if (reviewOpen && queueId) {
    const body = { note: note?.trim() || undefined };
    if (verifying) await tokenConsole.clearReview(queueId, body);
    else await tokenConsole.rejectReview(queueId, body);
  }
  await tokenConsole.assignClassifier(investorId, { valueId: verifying ? "KYC_STATUS:VERIFIED" : "KYC_STATUS:REJECTED" });
  // A resolved value, so callers going through useAction can tell success
  // from failure (which resolves to undefined there).
  return true;
}

/** The engine lets only these roles clear or reject a KYC review; every
 *  signed-in role can read the queue. The engine is the authority — this only
 *  decides whether to offer the buttons. */
export const KYC_DECIDER_ROLES = ["ADMIN", "COMPLIANCE"] as const;

export function canDecideKyc(roles: readonly string[] | undefined): boolean {
  return !!roles?.some((r) => (KYC_DECIDER_ROLES as readonly string[]).includes(r.toUpperCase()));
}
