import type { SubFundCode } from "./fund";

/** Compliance & KYC domain — the Investcent SOP checklist made concrete:
 * client lifecycle (onboard → documents → identity/UBO → screen → risk rate →
 * EDD → Compliance approval → activate → ongoing monitoring), unified case
 * management (AML / fraud / ABC / SAR), complaints, and the
 * Customer → Wallet → Token → Transaction chain. Key control: nothing
 * activates or transacts until the whole pipeline is complete and approved. */

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

export type TokenHolding = {
  id: string;
  walletId: string;
  product: SubFundCode;
  quantity: number;
  issuer: string;
  restrictions: WalletRestriction[];
};

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
