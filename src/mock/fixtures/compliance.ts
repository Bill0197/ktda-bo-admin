import type { SubFundCode } from "./fund";

/** Compliance & KYC domain — the Investcent SOP checklist made concrete:
 * client lifecycle (onboard → documents → identity/UBO → screen → risk rate →
 * EDD → Compliance approval → activate → ongoing monitoring), unified case
 * management (AML / fraud / ABC / SAR), complaints, and the
 * Customer → Wallet → Token → Transaction chain. Key control: nothing
 * activates or transacts until the whole pipeline is complete and approved. */

// ---- Client compliance profile (joins CLIENTS by clientId) ----

export type RiskRating = "low" | "medium" | "high";

/** Client KYC status reads as three states per Compliance review:
 * Active / Inactive / Pending Activation. */
export const KYC_STATUS_LABELS: Record<string, string> = {
  not_started: "Inactive",
  in_progress: "Pending Activation",
  pending_review: "Pending Activation",
  verified: "Active",
  rejected: "Inactive",
  suitability_exception: "Pending Activation",
};

/** Risk-factor catalogue — the selectable factors on a customer risk rating.
 * Managed in BO Admin (Platform Settings → Risk factors); "Geography" added
 * on Compliance review. */
export type RiskFactorDef = { id: string; label: string; description: string; enabled: boolean };

export const RISK_FACTORS: RiskFactorDef[] = [
  { id: "rf_geography", label: "Geography", description: "Residence, nationality or transaction links to higher-risk jurisdictions.", enabled: true },
  { id: "rf_pep", label: "Adverse media / PEP association", description: "Screening surfaced a PEP link or adverse-media coverage.", enabled: true },
  { id: "rf_channel", label: "Acquisition channel", description: "Channel-driven risk — e.g. third-party (IFA) referral requiring reliance checks.", enabled: true },
  { id: "rf_behaviour", label: "Transaction behaviour", description: "Monitoring alerts — structuring, velocity or activity outside the expected profile.", enabled: true },
  { id: "rf_suitability", label: "Below-threshold suitability score", description: "Scored under the configured pass mark at onboarding.", enabled: true },
  { id: "rf_source_of_funds", label: "Source of funds", description: "Unclear or unverifiable origin of invested funds.", enabled: true },
  { id: "rf_occupation", label: "High-risk occupation / industry", description: "Cash-intensive or higher-ML-risk business exposure.", enabled: true },
];

export type ClientLifecycleStatus =
  | "onboarding" | "docs_pending" | "screening" | "edd_required"
  | "pending_activation" | "active" | "suspended" | "closed";

export const LIFECYCLE_LABELS: Record<ClientLifecycleStatus, string> = {
  onboarding: "Onboarding",
  docs_pending: "Documents pending",
  screening: "Screening",
  edd_required: "EDD required",
  pending_activation: "Pending activation",
  active: "Active",
  suspended: "Suspended",
  closed: "Closed",
};

export type ClientComplianceProfile = {
  clientId: string;
  lifecycleStatus: ClientLifecycleStatus;
  riskRating: RiskRating | null;
  riskFactors: string[];
  pepFlag: boolean;
  eddRequired: boolean;
  eddCompletedAt?: string;
  uboVerified: boolean;
  activationApprovalId?: string;
  lastScreenedAt?: string;
  nextScreeningDue?: string;
  lastKycRefreshAt?: string;
  nextKycRefreshDue?: string;
};

/** Screening runs DAILY for every customer (Compliance requirement) — the
 * nightly batch job re-screens the whole register; nextScreeningDue is
 * always the next day. uboVerified is true for individuals (no UBO records
 * needed) and reflects the register for entity clients. */
export const COMPLIANCE_PROFILES: ClientComplianceProfile[] = [
  { clientId: "inv_2891", lifecycleStatus: "active", riskRating: "low", riskFactors: [], pepFlag: false, eddRequired: false, uboVerified: true, lastScreenedAt: "2026-08-11T05:00:00Z", nextScreeningDue: "2026-08-12", lastKycRefreshAt: "2026-03-14T10:00:00Z", nextKycRefreshDue: "2028-03-14" },
  { clientId: "inv_3350", lifecycleStatus: "edd_required", riskRating: "high", riskFactors: ["Transaction behaviour", "Below-threshold suitability score"], pepFlag: false, eddRequired: true, uboVerified: true, lastScreenedAt: "2026-08-11T05:00:00Z", nextScreeningDue: "2026-08-12" },
  { clientId: "inv_3122", lifecycleStatus: "active", riskRating: "medium", riskFactors: ["Acquisition channel", "Adverse media / PEP association"], pepFlag: false, eddRequired: false, uboVerified: true, lastScreenedAt: "2026-08-11T05:00:00Z", nextScreeningDue: "2026-08-12", lastKycRefreshAt: "2026-05-02T09:00:00Z", nextKycRefreshDue: "2028-05-02" },
  { clientId: "inv_2765", lifecycleStatus: "screening", riskRating: null, riskFactors: [], pepFlag: false, eddRequired: false, uboVerified: true, lastScreenedAt: "2026-08-11T05:00:00Z", nextScreeningDue: "2026-08-12" },
  { clientId: "inv_2601", lifecycleStatus: "active", riskRating: "low", riskFactors: [], pepFlag: false, eddRequired: false, uboVerified: true, lastScreenedAt: "2026-08-10T05:00:00Z", nextScreeningDue: "2026-08-11", lastKycRefreshAt: "2026-02-11T09:00:00Z", nextKycRefreshDue: "2028-02-11" },
];

// ---- Documents (metadata register — uploads live with Smile Identity) ----

export type DocumentType = "national_id" | "selfie" | "kra_pin" | "proof_of_address" | "source_of_funds" | "ubo_declaration" | "edd_questionnaire";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  national_id: "National ID",
  selfie: "Selfie / liveness",
  kra_pin: "KRA PIN certificate",
  proof_of_address: "Proof of address",
  source_of_funds: "Source of funds",
  ubo_declaration: "UBO declaration",
  edd_questionnaire: "EDD questionnaire",
};

export type ClientDocument = {
  id: string;
  clientId: string;
  type: DocumentType;
  status: "missing" | "submitted" | "verified" | "rejected" | "expired";
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  note?: string;
  /** Expiry of the underlying document (System Requirements CR-003 — capture
   * issue/expiry date, and trigger review or block when expired). Absent for
   * document types that do not expire, such as a KRA PIN certificate. */
  expiresAt?: string;
};

/** Which document types carry an expiry the customer has to keep current.
 * A national ID or passport expires; a source-of-funds statement is a
 * point-in-time evidence file and does not. */
export const EXPIRING_DOCUMENT_TYPES: DocumentType[] = ["national_id", "proof_of_address"];

export const CLIENT_DOCUMENTS: ClientDocument[] = [
  { id: "doc_1", clientId: "inv_2891", type: "national_id", status: "verified", submittedAt: "2026-03-14T09:00:00Z", reviewedAt: "2026-03-14T09:40:00Z", reviewedBy: "Peter Otieno", expiresAt: "2031-03-13" },
  { id: "doc_2", clientId: "inv_2891", type: "selfie", status: "verified", submittedAt: "2026-03-14T09:02:00Z", reviewedAt: "2026-03-14T09:40:00Z", reviewedBy: "Peter Otieno" },
  { id: "doc_3", clientId: "inv_2891", type: "kra_pin", status: "verified", submittedAt: "2026-03-14T09:05:00Z", reviewedAt: "2026-03-14T09:41:00Z", reviewedBy: "Peter Otieno" },
  { id: "doc_4", clientId: "inv_2765", type: "national_id", status: "verified", submittedAt: "2026-08-05T11:00:00Z", reviewedAt: "2026-08-05T11:30:00Z", reviewedBy: "Peter Otieno" },
  { id: "doc_5", clientId: "inv_2765", type: "selfie", status: "verified", submittedAt: "2026-08-05T11:02:00Z", reviewedAt: "2026-08-05T11:30:00Z", reviewedBy: "Peter Otieno" },
  { id: "doc_6", clientId: "inv_2765", type: "kra_pin", status: "submitted", submittedAt: "2026-08-05T11:10:00Z" },
  { id: "doc_7", clientId: "inv_2765", type: "proof_of_address", status: "missing" },
  { id: "doc_8", clientId: "inv_3350", type: "national_id", status: "verified", submittedAt: "2026-08-06T09:00:00Z", reviewedAt: "2026-08-06T09:30:00Z", reviewedBy: "Peter Otieno" },
  { id: "doc_9", clientId: "inv_3350", type: "selfie", status: "verified", submittedAt: "2026-08-06T09:01:00Z", reviewedAt: "2026-08-06T09:30:00Z", reviewedBy: "Peter Otieno" },
  { id: "doc_10", clientId: "inv_3350", type: "source_of_funds", status: "submitted", submittedAt: "2026-08-07T14:00:00Z", note: "Requested as part of EDD — payslips provided, employer verification pending." },
  { id: "doc_11", clientId: "inv_3350", type: "edd_questionnaire", status: "submitted", submittedAt: "2026-08-07T14:05:00Z" },
  { id: "doc_12", clientId: "inv_3122", type: "national_id", status: "verified", submittedAt: "2026-05-02T08:00:00Z", reviewedAt: "2026-05-02T08:30:00Z", reviewedBy: "Peter Otieno" },
  { id: "doc_13", clientId: "inv_3122", type: "ubo_declaration", status: "verified", submittedAt: "2026-05-02T08:10:00Z", reviewedAt: "2026-05-03T10:00:00Z", reviewedBy: "Peter Otieno", note: "Family trust structure — secondary UBO verified separately." },
  { id: "doc_14", clientId: "inv_2601", type: "national_id", status: "verified", submittedAt: "2026-02-11T08:00:00Z", reviewedAt: "2026-02-11T08:30:00Z", reviewedBy: "Peter Otieno", expiresAt: "2026-09-30" },
];

// ---- Attempted-activity monitoring feed ----

/** Why a monitoring event was raised from the investor apps.
 *
 * Kenyan law and the Transaction Monitoring procedure both cover **attempted**
 * transactions, not just completed ones: POCAMLA requires monitoring of
 * complex, unusual, suspicious and large transactions "including attempted
 * transactions" (TM §4), §3 puts completed, pending, failed *and attempted*
 * activity in scope, and §15 requires attempted transactions to be considered
 * for reporting. AML/CFT Appendix II lists "repeated failed KYC / screening /
 * payment attempts" as a red flag in its own right.
 *
 * A subscription that a control stopped, a payment the customer abandoned, or
 * a run of failed verification attempts therefore all have to reach the
 * monitoring feed. Before this existed the investor apps emitted nothing at
 * all, so the KES 100 channel — the one most exposed to structuring — was the
 * one the engine could see least. */
export type AttemptKind =
  | "subscription_blocked"
  | "redemption_blocked"
  | "subscription_failed"
  | "redemption_failed"
  | "subscription_abandoned"
  | "redemption_abandoned"
  | "otp_failed"
  | "screening_unavailable"
  | "payout_name_mismatch";

export const ATTEMPT_KIND_LABELS: Record<AttemptKind, string> = {
  subscription_blocked: "Subscription blocked by control",
  redemption_blocked: "Redemption blocked by control",
  subscription_failed: "Subscription failed",
  redemption_failed: "Redemption failed",
  subscription_abandoned: "Subscription abandoned",
  redemption_abandoned: "Redemption abandoned",
  otp_failed: "Failed OTP attempt",
  screening_unavailable: "Screening provider unavailable",
  payout_name_mismatch: "Payout account name mismatch",
};

export type AttemptEvent = {
  id: string;
  clientId: string | null;
  kind: AttemptKind;
  at: string;
  /** Where it happened — "investor-web" or "investor-mobile". */
  surface: string;
  subFund?: SubFundCode;
  amount?: number;
  currency?: "KES" | "USD";
  /** Operator-facing detail. Internal only. */
  detail?: string;
};

export const ATTEMPT_EVENTS: AttemptEvent[] = [];

// ---- Requests for Information (RFI) ----

/** A Compliance request for supporting information.
 *
 * Transaction Monitoring §12: where activity is inconsistent with the
 * customer's profile, Compliance obtains evidence to understand it. §12.1 is
 * explicit that the request must be in **neutral language** and must not state
 * that the customer has been flagged, reported or is under investigation — so
 * `subject` and `message` are drafted copy, never a case summary, and this
 * type deliberately carries no link back to the case that raised it.
 *
 * §12.2 sets the operating targets this models: individuals 5 calendar days
 * to respond, reminder at day 7, escalation by day 10. */
export type RfiStatus = "open" | "responded" | "closed";

export const RFI_STATUS_LABELS: Record<RfiStatus, string> = {
  open: "Awaiting your reply",
  responded: "Reply received",
  closed: "Closed",
};

export type Rfi = {
  id: string;
  clientId: string;
  /** Neutral subject line. */
  subject: string;
  /** Neutral body. Reviewed by Compliance before sending. */
  message: string;
  /** What the customer can usefully attach, in plain words. */
  examples: string[];
  requestedAt: string;
  /** Response target — individuals get 5 calendar days (TM §12.2). */
  dueAt: string;
  status: RfiStatus;
  response?: { text: string; at: string; attachments: number };
};

export const RFIS: Rfi[] = [
  {
    id: "rfi_2891_1",
    clientId: "inv_2891",
    subject: "A quick question about a recent deposit",
    message:
      "As part of our routine account checks, we'd like to understand a little more about the funds you " +
      "recently added. Could you share where they came from? Anything that shows the source is helpful.",
    examples: ["A payslip or employment letter", "A bank statement showing the transfer", "A sale agreement or invoice"],
    requestedAt: "2026-08-14T09:00:00Z",
    dueAt: "2026-08-19",
    status: "open",
  },
];

// ---- UBO register ----

export type UboRecord = {
  id: string;
  clientId: string;
  name: string;
  relationship: string;
  ownershipPct: number | null;
  status: "unverified" | "verified" | "flagged";
  verifiedAt?: string;
  verifiedBy?: string;
};

/** UBO verification applies to entity clients only (trusts, companies) —
 * individual clients carry no UBO records, per Compliance review. */
export const UBO_RECORDS: UboRecord[] = [
  { id: "ubo_3", clientId: "inv_3122", name: "Cynthia Njeri", relationship: "Self / trust settlor", ownershipPct: 75, status: "verified", verifiedAt: "2026-05-03T10:00:00Z", verifiedBy: "Peter Otieno" },
  { id: "ubo_4", clientId: "inv_3122", name: "Njeri Family Trust", relationship: "Trust — 25% beneficial interest", ownershipPct: 25, status: "verified", verifiedAt: "2026-05-03T10:05:00Z", verifiedBy: "Peter Otieno" },
];

// ---- Screening results (full history retained) ----

export type ScreeningOutcome = "clear" | "potential_match" | "match";

export type ScreeningResult = {
  id: string;
  clientId: string;
  runAt: string;
  runBy: string;
  trigger: "onboarding" | "periodic" | "on_demand" | "edd";
  sanctions: ScreeningOutcome;
  pep: ScreeningOutcome;
  adverseMedia: "clear" | "potential_match";
  matchDetail?: string;
  resolution?: { outcome: "false_positive" | "true_match_accepted" | "true_match_rejected"; note: string; by: string; at: string };
};

export const SCREENING_RESULTS: ScreeningResult[] = [
  { id: "scr_1", clientId: "inv_2891", runAt: "2026-03-14T09:10:00Z", runBy: "System (Smile Identity)", trigger: "onboarding", sanctions: "clear", pep: "clear", adverseMedia: "clear" },
  { id: "scr_2", clientId: "inv_3122", runAt: "2026-05-02T08:20:00Z", runBy: "System (Smile Identity)", trigger: "onboarding", sanctions: "clear", pep: "potential_match", adverseMedia: "clear", matchDetail: "Name similarity with a county assembly member — 71% match confidence.", resolution: { outcome: "false_positive", note: "Different DOB and ID number; assembly member is C. Njeri Kamande. Documented and cleared.", by: "Peter Otieno", at: "2026-05-02T15:00:00Z" } },
  { id: "scr_3", clientId: "inv_3122", runAt: "2026-08-01T08:00:00Z", runBy: "System (scheduled)", trigger: "periodic", sanctions: "clear", pep: "clear", adverseMedia: "clear" },
  { id: "scr_4", clientId: "inv_2765", runAt: "2026-08-05T12:00:00Z", runBy: "System (Smile Identity)", trigger: "onboarding", sanctions: "clear", pep: "clear", adverseMedia: "clear" },
  { id: "scr_5", clientId: "inv_3350", runAt: "2026-08-06T09:20:00Z", runBy: "System (Smile Identity)", trigger: "onboarding", sanctions: "clear", pep: "clear", adverseMedia: "potential_match", matchDetail: "Local news mention in a 2024 betting-syndicate story — same name, unconfirmed identity." },
  { id: "scr_6", clientId: "inv_2601", runAt: "2026-02-11T08:10:00Z", runBy: "System (Smile Identity)", trigger: "onboarding", sanctions: "clear", pep: "clear", adverseMedia: "clear" },
];

// ---- Wallets & token holdings (Customer → Wallet → Token → Transaction) ----

// "Jurisdiction locked" removed on Compliance review — the product is
// Kenya-only until the Phase 2 tokenization whitelist opens other markets.
export type WalletRestriction = "no_transfers" | "redemptions_only";

export const WALLET_RESTRICTION_LABELS: Record<WalletRestriction, string> = {
  no_transfers: "No transfers",
  redemptions_only: "Redemptions only",
};

export type Wallet = {
  id: string;
  clientId: string;
  ownership: string;
  status: "pending_activation" | "active" | "frozen" | "closed";
  restrictions: WalletRestriction[];
  createdAt: string;
  activatedAt?: string;
  statusReason?: string;
};

export const WALLETS: Wallet[] = [
  { id: "wal_2891", clientId: "inv_2891", ownership: "Self — individual", status: "active", restrictions: [], createdAt: "2026-03-14T10:00:00Z", activatedAt: "2026-03-14T10:00:00Z" },
  { id: "wal_3350", clientId: "inv_3350", ownership: "Self — individual", status: "pending_activation", restrictions: ["no_transfers"], createdAt: "2026-08-06T09:30:00Z", statusReason: "Held pending EDD sign-off and Compliance activation approval." },
  { id: "wal_3122", clientId: "inv_3122", ownership: "Self + family trust (75/25)", status: "active", restrictions: [], createdAt: "2026-05-03T10:10:00Z", activatedAt: "2026-05-03T10:10:00Z" },
  { id: "wal_2765", clientId: "inv_2765", ownership: "Self — individual", status: "pending_activation", restrictions: [], createdAt: "2026-08-05T12:30:00Z" },
  { id: "wal_2601", clientId: "inv_2601", ownership: "Self — individual", status: "active", restrictions: [], createdAt: "2026-02-11T09:00:00Z", activatedAt: "2026-02-11T09:00:00Z" },
];

// ---- Investor-facing projection of all of the above ----

/** Customer-safe notice codes.
 *
 * TIPPING-OFF CONTROL (Transaction Monitoring §17, STR §14, Customer Exit
 * §14/15): this code is derived **only** from the account's control status —
 * never from the reason a restriction was applied, never from a case, alert,
 * screening match or STR. `Wallet.statusReason` and `ComplianceCase` fields
 * are BO-Admin-only and must never reach the investor apps. The copy each
 * code maps to is CMS-editable per app; the code itself is the contract.
 *
 * Adding a code that encodes *why* (e.g. `sanctions_hit`) would be a
 * regulatory breach, not just a design smell. */
export type InvestorNotice =
  | "pending_activation"
  | "under_review"
  | "suitability_call"
  | "rejected"
  | "restricted_no_subscriptions"
  | "restricted_no_transactions"
  | "suspended"
  | "closed";

/** Everything the investor apps need to decide what the customer may do.
 *
 * One object, computed server-side (mocked here), so entitlement is never
 * re-derived from loose flags at the call site — the investor app asks "may
 * I?", it does not reason about lifecycle or wallet state itself. */
export type InvestorComplianceState = {
  lifecycleStatus: ClientLifecycleStatus;
  walletStatus: Wallet["status"] | null;
  restrictions: WalletRestriction[];
  /** May the customer place a new subscription right now? */
  canSubscribe: boolean;
  /** May the customer place a redemption right now? Deliberately separate:
   * `redemptions_only` withholds one and not the other. */
  canRedeem: boolean;
  /** Null when the account is fully active and unrestricted. */
  notice: InvestorNotice | null;
};

export type TokenHolding = {
  id: string;
  walletId: string;
  product: SubFundCode;
  quantity: number;
  issuer: string;
  restrictions: WalletRestriction[];
};

export const TOKEN_HOLDINGS: TokenHolding[] = [
  { id: "tok_1", walletId: "wal_2891", product: "KES_FIXED_INCOME", quantity: 40128.6203, issuer: "Investcent — Bond Retail Fund", restrictions: [] },
  { id: "tok_2", walletId: "wal_2891", product: "USD_EUROBOND", quantity: 412.885, issuer: "Investcent — Bond Retail Fund", restrictions: [] },
  { id: "tok_3", walletId: "wal_3122", product: "KES_FIXED_INCOME", quantity: 99327.41, issuer: "Investcent — Bond Retail Fund", restrictions: [] },
  { id: "tok_4", walletId: "wal_2601", product: "USD_EUROBOND", quantity: 769.62, issuer: "Investcent — Bond Retail Fund", restrictions: [] },
];

// ---- Case management (unified AML / fraud / ABC / SAR) ----

export type CaseType = "aml" | "fraud" | "abc" | "sar";

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  aml: "AML",
  fraud: "Fraud",
  abc: "Anti-bribery & corruption",
  sar: "SAR",
};

export type CaseStatus = "open" | "investigating" | "pending_approval" | "escalated_mlro" | "closed_cleared" | "closed_reported";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  pending_approval: "Pending approval",
  escalated_mlro: "Escalated to MLRO",
  closed_cleared: "Closed — cleared",
  closed_reported: "Closed — reported",
};

export type CaseNote = { id: string; at: string; by: string; byRole: string; text: string; kind: "note" | "decision" | "status_change" | "escalation" };
export type CaseEvidence = { id: string; label: string; type: "transaction_ref" | "screening_ref" | "document_ref" | "external"; ref?: string; addedAt: string; addedBy: string };

export type ComplianceCase = {
  id: string;
  type: CaseType;
  title: string;
  summary: string;
  clientId?: string;
  clientName: string;
  linkedAlertIds: string[];
  severity: "low" | "medium" | "high";
  status: CaseStatus;
  assignee?: string;
  openedAt: string;
  openedBy: string;
  dueAt?: string;
  notes: CaseNote[];
  evidence: CaseEvidence[];
  sar?: { escalatedAt: string; escalatedBy: string; mlroDecision?: "file_str" | "no_filing"; strReference?: string; decidedAt?: string; approvalId?: string };
  closedAt?: string;
  closedBy?: string;
  closeRationale?: string;
};

export const COMPLIANCE_CASES: ComplianceCase[] = [
  {
    id: "cs_1", type: "aml", title: "Structuring pattern — Brian Otieno", summary: "Four deposits of KES 9,800–9,950 inside 48 hours, each just under the review threshold. Pattern consistent with deliberate structuring.",
    clientId: "inv_3350", clientName: "Brian Otieno", linkedAlertIds: ["aml_1"], severity: "high", status: "investigating", assignee: "Peter Otieno",
    openedAt: "2026-08-06T11:30:00Z", openedBy: "Peter Otieno", dueAt: "2026-08-13",
    notes: [
      { id: "cn_1", at: "2026-08-06T11:30:00Z", by: "Peter Otieno", byRole: "Compliance", text: "Case opened from alert aml_1. Deposit timing clusters around 21:00–23:00 — requesting device and session logs.", kind: "note" },
      { id: "cn_2", at: "2026-08-07T09:15:00Z", by: "Peter Otieno", byRole: "Compliance", text: "Source-of-funds documents requested from client as part of parallel EDD.", kind: "note" },
    ],
    evidence: [
      { id: "ce_1", label: "Alert aml_1 — structuring pattern", type: "external", ref: "aml_1", addedAt: "2026-08-06T11:30:00Z", addedBy: "Peter Otieno" },
      { id: "ce_2", label: "EDD questionnaire (submitted)", type: "document_ref", ref: "doc_11", addedAt: "2026-08-07T14:10:00Z", addedBy: "Peter Otieno" },
    ],
  },
  {
    id: "cs_2", type: "fraud", title: "Duplicate STK charge — Amina Wanjiru", summary: "Investor charged twice by a duplicated Daraja callback for one subscription. Refund proposed via payment release ap_8; investigating whether the duplication was exploitable rather than accidental.",
    clientId: "inv_2891", clientName: "Amina Wanjiru", linkedAlertIds: ["fr_5"], severity: "medium", status: "investigating", assignee: "Peter Otieno",
    openedAt: "2026-08-08T08:30:00Z", openedBy: "Grace Mumbi (Operations)", dueAt: "2026-08-15",
    notes: [
      { id: "cn_3", at: "2026-08-08T08:30:00Z", by: "Grace Mumbi", byRole: "Operations", text: "Referred from payment ops — duplicate callback signature matches a known Daraja retry edge case, but flagging for fraud review per SOP.", kind: "note" },
    ],
    evidence: [
      { id: "ce_3", label: "Refund payment release ap_8", type: "transaction_ref", ref: "ap_8", addedAt: "2026-08-08T08:30:00Z", addedBy: "Grace Mumbi" },
      { id: "ce_4", label: "Subscription tx_9001 (original charge)", type: "transaction_ref", ref: "tx_9001", addedAt: "2026-08-08T08:32:00Z", addedBy: "Grace Mumbi" },
    ],
  },
  {
    id: "cs_5", type: "fraud", title: "Payout name mismatch — Cynthia Njeri", summary: "Redemption payout account is registered to 'C. NJERI ENTERPRISES' rather than the client. Third-party payment indicator (TM-005): payout held pending proof the account is the client's own.",
    clientId: "inv_3122", clientName: "Cynthia Njeri", linkedAlertIds: ["fr_1"], severity: "high", status: "open", assignee: "Kevin Baraka",
    openedAt: "2026-08-17T09:05:00Z", openedBy: "Kevin Baraka", dueAt: "2026-08-24",
    notes: [
      { id: "cn_8", at: "2026-08-17T09:05:00Z", by: "Kevin Baraka", byRole: "Institutional Funds Compliance Manager", text: "Payout suspended and the client asked for a bank letter in their own name. No funds have left the collection account.", kind: "note" },
    ],
    evidence: [
      { id: "ce_7", label: "Alert fr_1 — payout name mismatch", type: "external", ref: "fr_1", addedAt: "2026-08-17T09:05:00Z", addedBy: "Kevin Baraka" },
    ],
  },
  {
    id: "cs_6", type: "fraud", title: "Account-takeover indicators — Brian Otieno", summary: "New device and SIM registered 14 minutes before a full redemption request. Session and device logs pulled; redemption held until the client is re-verified on a known channel.",
    clientId: "inv_3350", clientName: "Brian Otieno", linkedAlertIds: ["fr_2"], severity: "high", status: "investigating", assignee: "Kevin Baraka",
    openedAt: "2026-08-16T19:40:00Z", openedBy: "Kevin Baraka", dueAt: "2026-08-21",
    notes: [
      { id: "cn_9", at: "2026-08-16T19:40:00Z", by: "Kevin Baraka", byRole: "Institutional Funds Compliance Manager", text: "Redemption held. Client callback attempted on the registered number — no answer; second attempt scheduled.", kind: "note" },
      { id: "cn_10", at: "2026-08-17T11:20:00Z", by: "Peter Otieno", byRole: "Compliance", text: "Device fingerprint does not match any prior session for this file. Keep the hold until voice verification completes.", kind: "decision" },
    ],
    evidence: [
      { id: "ce_8", label: "Alert fr_2 — device change before withdrawal", type: "external", ref: "fr_2", addedAt: "2026-08-16T19:40:00Z", addedBy: "Kevin Baraka" },
    ],
  },
  {
    id: "cs_3", type: "abc", title: "Gift declaration — IFA introduction dinner", summary: "IFA-hosted client dinner exceeding the gift & hospitality threshold declared by a BD Officer. Reviewed against the ABC register.",
    clientName: "— (internal)", linkedAlertIds: [], severity: "low", status: "closed_cleared", assignee: "Peter Otieno",
    openedAt: "2026-07-20T10:00:00Z", openedBy: "Faith Kamau (BD)",
    notes: [
      { id: "cn_4", at: "2026-07-20T10:00:00Z", by: "Faith Kamau", byRole: "BD Officer", text: "Declared KES 24,000 hospitality from Mutuku Wealth Advisors — above the register threshold.", kind: "note" },
      { id: "cn_5", at: "2026-07-22T16:00:00Z", by: "Peter Otieno", byRole: "Compliance", text: "No procurement or referral decision pending with this IFA in the period. Recorded in the gift register; no further action.", kind: "decision" },
    ],
    evidence: [{ id: "ce_5", label: "Gift register entry GR-2026-014", type: "external", addedAt: "2026-07-20T10:05:00Z", addedBy: "Faith Kamau" }],
    closedAt: "2026-07-22T16:00:00Z", closedBy: "Peter Otieno", closeRationale: "Register entry sufficient; below corruption-risk bar once context reviewed.",
  },
  {
    id: "cs_4", type: "sar", title: "Suspected smurfing network — Brian Otieno", summary: "Structuring case cs_1 escalated: deposit sources trace to three distinct M-Pesa lines cycling similar amounts. Awaiting MLRO decision on STR filing.",
    clientId: "inv_3350", clientName: "Brian Otieno", linkedAlertIds: ["aml_1"], severity: "high", status: "escalated_mlro", assignee: "Josephine Muthoni",
    openedAt: "2026-08-08T10:00:00Z", openedBy: "Peter Otieno", dueAt: "2026-08-14",
    notes: [
      { id: "cn_6", at: "2026-08-08T10:00:00Z", by: "Peter Otieno", byRole: "Compliance", text: "Escalating to MLRO — multi-line deposit pattern goes beyond single-client structuring.", kind: "escalation" },
      { id: "cn_7", at: "2026-08-08T15:40:00Z", by: "Josephine Muthoni", byRole: "MLRO", text: "Reviewing session logs and the three source lines. Decision within SLA.", kind: "note" },
    ],
    evidence: [
      { id: "ce_6", label: "Case cs_1 investigation file", type: "external", ref: "cs_1", addedAt: "2026-08-08T10:00:00Z", addedBy: "Peter Otieno" },
      { id: "ce_7", label: "M-Pesa source-line analysis", type: "external", addedAt: "2026-08-08T15:30:00Z", addedBy: "Josephine Muthoni" },
    ],
    sar: { escalatedAt: "2026-08-08T10:00:00Z", escalatedBy: "Peter Otieno" },
  },
];

// ---- Complaints ----

export type ComplaintStatus = "new" | "acknowledged" | "investigating" | "resolved" | "closed";

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
};

export type ComplaintCategory = "transaction" | "service" | "fees" | "onboarding" | "data_privacy" | "other";

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  transaction: "Transaction",
  service: "Service",
  fees: "Fees & charges",
  onboarding: "Onboarding",
  data_privacy: "Data & privacy",
  other: "Other",
};

export type Complaint = {
  id: string;
  clientId?: string;
  clientName: string;
  channel: "app" | "email" | "phone" | "branch";
  category: ComplaintCategory;
  subject: string;
  description: string;
  status: ComplaintStatus;
  assignee?: string;
  submittedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolution?: string;
  history: { at: string; by: string; action: string; note?: string }[];
};

export const COMPLAINTS: Complaint[] = [
  {
    id: "cp_1", clientId: "inv_2891", clientName: "Amina Wanjiru", channel: "app", category: "transaction",
    subject: "Charged twice for one investment", description: "I invested KES 50,000 on 1 August and M-Pesa deducted it twice. Only one investment shows in my account.",
    status: "investigating", assignee: "Grace Mumbi", submittedAt: "2026-08-08T07:50:00Z", acknowledgedAt: "2026-08-08T08:20:00Z",
    history: [
      { at: "2026-08-08T07:50:00Z", by: "Amina Wanjiru", action: "Submitted via app" },
      { at: "2026-08-08T08:20:00Z", by: "Faith Kamau", action: "Acknowledged", note: "Within 1-business-day SLA." },
      { at: "2026-08-08T08:35:00Z", by: "Grace Mumbi", action: "Assigned to Operations", note: "Linked to duplicate-STK refund ap_8 and fraud case review." },
    ],
  },
  {
    id: "cp_2", clientId: "inv_2601", clientName: "Esther Chebet", channel: "email", category: "service",
    subject: "July statement not received", description: "My July statement email never arrived; I need it for my records.",
    status: "resolved", assignee: "Faith Kamau", submittedAt: "2026-08-04T10:00:00Z", acknowledgedAt: "2026-08-04T10:30:00Z", resolvedAt: "2026-08-04T15:00:00Z",
    resolution: "Statement re-sent and email address typo corrected in the register (maker-checker amendment).",
    history: [
      { at: "2026-08-04T10:00:00Z", by: "Esther Chebet", action: "Submitted via email" },
      { at: "2026-08-04T10:30:00Z", by: "Faith Kamau", action: "Acknowledged" },
      { at: "2026-08-04T15:00:00Z", by: "Faith Kamau", action: "Resolved", note: "Static-data amendment approved same day." },
    ],
  },
  {
    id: "cp_3", clientName: "Walk-in enquirer", channel: "branch", category: "onboarding",
    subject: "Onboarding stuck at document upload", description: "Branch visitor reports the app rejects their proof of address photo repeatedly.",
    status: "new", submittedAt: "2026-08-09T08:40:00Z",
    history: [{ at: "2026-08-09T08:40:00Z", by: "Branch — Westlands", action: "Recorded at branch" }],
  },
];

// ---- Monitoring rules register (parameters live in PLATFORM_SETTINGS) ----

export type MonitoringRule = {
  id: string;
  name: string;
  description: string;
  appliesTo: ("subscription" | "redemption" | "transfer" | "deposit")[];
  settingKeys: string[];
  enabled: boolean;
};

export const MONITORING_RULES: MonitoringRule[] = [
  { id: "mr_structuring", name: "Structuring / smurfing", description: "Clusters of deposits just under the review threshold inside the rolling window. High-risk customers use the tighter threshold.", appliesTo: ["deposit", "subscription"], settingKeys: ["aml_review_threshold", "aml_review_threshold_high_risk", "aml_structuring_window"], enabled: true },
  { id: "mr_velocity", name: "Velocity", description: "Daily transaction count above the band limit versus the customer's 90-day average.", appliesTo: ["subscription", "redemption"], settingKeys: ["aml_velocity_max_tx", "aml_velocity_max_tx_high_risk"], enabled: true },
  { id: "mr_geo", name: "Geo / device mismatch", description: "New device or location shortly before a large redemption or transfer.", appliesTo: ["redemption", "transfer"], settingKeys: [], enabled: true },
  { id: "mr_large_redemption", name: "Large redemption vs profile", description: "Redemption materially above the customer's expected activity for their risk band.", appliesTo: ["redemption"], settingKeys: ["risk_band_low_max", "risk_band_medium_max"], enabled: true },
];
