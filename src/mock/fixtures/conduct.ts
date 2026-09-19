/** Market conduct domain — the three registers a CMA-licensed fund manager has
 * to be able to produce on demand: market abuse surveillance, the conflicts of
 * interest register, and personal account (employee) dealing.
 *
 * These sit apart from AML monitoring on purpose. AML asks "is this money
 * clean?"; market conduct asks "did our own people, or someone using our
 * order flow, behave properly?" Same investigative shape, different subject —
 * which is why the subject of a market-abuse alert can be an employee. */

export type AbuseTypology = "insider_dealing" | "front_running" | "wash_trading" | "market_manipulation" | "spoofing" | "unusual_timing";

export const ABUSE_TYPOLOGY_LABELS: Record<AbuseTypology, string> = {
  insider_dealing: "Insider dealing",
  front_running: "Front running",
  wash_trading: "Wash trading",
  market_manipulation: "Price manipulation",
  spoofing: "Spoofing / layering",
  unusual_timing: "Unusual trade timing",
};

export type ConductStatus = "open" | "under_review" | "escalated" | "closed_no_action" | "closed_substantiated";

export const CONDUCT_STATUS_LABELS: Record<ConductStatus, string> = {
  open: "Open",
  under_review: "Under review",
  escalated: "Escalated",
  closed_no_action: "Closed — no action",
  closed_substantiated: "Closed — substantiated",
};

export type MarketAbuseAlert = {
  id: string;
  ref: string;
  typology: AbuseTypology;
  subject: string;
  subjectType: "employee" | "client" | "counterparty";
  instrument: string;
  detail: string;
  severity: "low" | "medium" | "high";
  status: ConductStatus;
  detectedAt: string;
  assignee?: string;
  /** Set once a matter has been reported to the regulator — a substantiated
   * insider-dealing finding is notifiable, and the register must show when. */
  reportedToCma?: string;
};

export type ConflictCategory = "outside_business" | "directorship" | "gift_hospitality" | "personal_relationship" | "political_exposure" | "supplier_interest";

export const CONFLICT_CATEGORY_LABELS: Record<ConflictCategory, string> = {
  outside_business: "Outside business interest",
  directorship: "Directorship",
  gift_hospitality: "Gift / hospitality",
  personal_relationship: "Personal relationship",
  political_exposure: "Political exposure",
  supplier_interest: "Supplier / vendor interest",
};

export type ConflictStatus = "declared" | "under_review" | "approved_with_controls" | "prohibited" | "lapsed";

export const CONFLICT_STATUS_LABELS: Record<ConflictStatus, string> = {
  declared: "Declared — not yet reviewed",
  under_review: "Under review",
  approved_with_controls: "Permitted with controls",
  prohibited: "Prohibited",
  lapsed: "Lapsed — re-declaration due",
};

export type ConflictDeclaration = {
  id: string;
  ref: string;
  declaredBy: string;
  roleLabel: string;
  category: ConflictCategory;
  description: string;
  relatedParty: string;
  /** Present for gifts and hospitality only — the register is worthless
   * without the value, since the threshold is what triggers escalation. */
  valueKes?: number;
  declaredAt: string;
  status: ConflictStatus;
  mitigation?: string;
  reviewedBy?: string;
  reviewDue?: string;
};

export type PreClearanceStatus = "pending" | "approved" | "declined" | "expired";

export const PRECLEARANCE_LABELS: Record<PreClearanceStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  expired: "Expired unused",
};

export type EmployeeTrade = {
  id: string;
  ref: string;
  employee: string;
  roleLabel: string;
  instrument: string;
  side: "buy" | "sell";
  quantity: number;
  valueKes: number;
  requestedAt: string;
  preClearance: PreClearanceStatus;
  /** Whether the trade actually executed — an approved request that was never
   * used is not a breach, and the register has to be able to tell them apart. */
  executedAt?: string;
  /** The three standing rules on personal account dealing. Each is recorded
   * as its own outcome so a breach names which rule broke, not just "breach". */
  blackoutClear: boolean;
  minHoldClear: boolean;
  conflictClear: boolean;
  decidedBy?: string;
  note?: string;
};
