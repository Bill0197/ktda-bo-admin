/** Institutional funds domain — the segregated-mandate side of the business,
 * and its compliance mirror.
 *
 * Retail investors buy units in a pooled fund; institutions appoint the firm
 * under an Investment Management Agreement and hold their own portfolio. That
 * difference drives everything here: a mandate document with client-specific
 * restrictions, a fee schedule negotiated per client, client-specific
 * reporting obligations, and a breach register — because breaching a client's
 * own IMA is a contractual failure, not just an internal limit excursion.
 *
 * One shared spine, two audiences. The Investment Manager works the funds side
 * (clients, mandates, portfolios, fees, reporting); the Compliance Analyst
 * works the control side (breaches, restrictions, counterparties, client
 * compliance) off the same records. */

export type InstitutionalClientType = "pension_scheme" | "insurer" | "sacco" | "corporate" | "endowment" | "dfi";

export const INSTITUTIONAL_TYPE_LABELS: Record<InstitutionalClientType, string> = {
  pension_scheme: "Pension scheme",
  insurer: "Insurer",
  sacco: "SACCO",
  corporate: "Corporate treasury",
  endowment: "Endowment / foundation",
  dfi: "Development finance institution",
};

export type InstitutionalClientStatus = "active" | "onboarding" | "notice_period" | "terminated";

export const INSTITUTIONAL_STATUS_LABELS: Record<InstitutionalClientStatus, string> = {
  active: "Active",
  onboarding: "Onboarding",
  notice_period: "In notice period",
  terminated: "Terminated",
};

export type InstitutionalClient = {
  id: string;
  name: string;
  type: InstitutionalClientType;
  /** The mandate reference; every active client has exactly one live IMA. */
  mandateRef: string | null;
  aum: number;
  currency: "KES" | "USD";
  relationshipManager: string;
  onboardedAt: string;
  status: InstitutionalClientStatus;
  /** Regulator of the client itself, which drives their reporting demands —
   * an RBA-regulated scheme needs different returns from an IRA-regulated
   * insurer, and the reporting page is built off this. */
  clientRegulator: string;
  note?: string;
};

export type RestrictionType = "asset_class" | "issuer_concentration" | "duration" | "credit_quality" | "liquidity" | "prohibited" | "currency";

export const RESTRICTION_TYPE_LABELS: Record<RestrictionType, string> = {
  asset_class: "Asset class limit",
  issuer_concentration: "Issuer concentration",
  duration: "Duration",
  credit_quality: "Credit quality",
  liquidity: "Liquidity",
  prohibited: "Prohibited investment",
  currency: "Currency exposure",
};

export type RestrictionState = "within" | "near" | "breach";

export type MandateRestriction = {
  id: string;
  mandateRef: string;
  clientName: string;
  type: RestrictionType;
  rule: string;
  limitValue: string;
  currentValue: string;
  /** Headroom as a percentage of the limit. Negative means through it. */
  headroomPct: number;
  state: RestrictionState;
  /** Whether the rule is checked before a trade can be booked, or only
   * measured after the fact. A post-trade-only rule is how passive breaches
   * happen, so it belongs on the face of the register. */
  preTradeChecked: boolean;
  lastChecked: string;
};

export type InstitutionalMandate = {
  id: string;
  ref: string;
  clientId: string;
  clientName: string;
  strategy: string;
  benchmark: string;
  inceptionDate: string;
  aum: number;
  currency: "KES" | "USD";
  reviewDue: string;
  status: "active" | "under_amendment" | "terminating" | "draft";
  signedBy: string;
  note?: string;
};

export type SegregatedPortfolio = {
  id: string;
  name: string;
  clientName: string;
  mandateRef: string;
  marketValue: number;
  cash: number;
  currency: "KES" | "USD";
  ytdReturnPct: number;
  benchmarkReturnPct: number;
  durationYears: number;
  holdingsCount: number;
  lastValuedAt: string;
  custodian: string;
  /** Live restriction breaches on this portfolio, counted from
   * MANDATE_RESTRICTIONS so the two screens can never disagree. */
  openBreaches: number;
};

export type FeeStructure = "flat_amc" | "tiered_amc" | "amc_plus_performance";

export const FEE_STRUCTURE_LABELS: Record<FeeStructure, string> = {
  flat_amc: "Flat AMC",
  tiered_amc: "Tiered AMC",
  amc_plus_performance: "AMC + performance fee",
};

export type FeeSchedule = {
  id: string;
  clientName: string;
  mandateRef: string;
  structure: FeeStructure;
  /** Human-readable tier ladder for tiered schedules; a single rate otherwise. */
  rateDescription: string;
  /** Effective rate on the current AUM, in basis points — the one number that
   * makes flat and tiered schedules comparable across clients. */
  effectiveBps: number;
  performanceFeePct: number | null;
  hurdle: string | null;
  highWaterMark: boolean;
  billingFrequency: "monthly" | "quarterly";
  accruedAmount: number;
  currency: "KES" | "USD";
  lastInvoicedAt: string | null;
  nextInvoiceDue: string;
  note?: string;
};

export type ReportDelivery = "on_time" | "due" | "overdue" | "scheduled";

export const REPORT_DELIVERY_LABELS: Record<ReportDelivery, string> = {
  on_time: "Delivered on time",
  due: "Due",
  overdue: "Overdue",
  scheduled: "Scheduled",
};

export type InstitutionalReport = {
  id: string;
  name: string;
  clientName: string;
  /** What obliges the report: the client's own regulator, the IMA, or an
   * internal service standard. Overdue means something different for each. */
  obligation: "regulatory" | "contractual" | "service";
  frequency: string;
  format: "PDF" | "XLSX" | "Portal";
  dueDate: string;
  lastSentAt: string | null;
  delivery: ReportDelivery;
  owner: string;
  note?: string;
};

export type BreachType = "active" | "passive";

export type BreachStatus = "open" | "remediating" | "cured" | "escalated" | "client_notified";

export const BREACH_STATUS_LABELS: Record<BreachStatus, string> = {
  open: "Open",
  remediating: "Remediating",
  cured: "Cured",
  escalated: "Escalated to IC",
  client_notified: "Client notified",
};

export type MandateBreach = {
  id: string;
  ref: string;
  clientName: string;
  mandateRef: string;
  restrictionId: string;
  rule: string;
  /** Active = caused by a trade. Passive = caused by market movement or a
   * flow. The distinction decides whether anyone did anything wrong, and it
   * decides the cure period, so it is never inferred at render time. */
  type: BreachType;
  detectedAt: string;
  magnitude: string;
  status: BreachStatus;
  owner: string;
  cureDueBy: string;
  /** Notifying the client is a contractual obligation with its own clock,
   * separate from curing the breach. */
  clientNotifiedAt: string | null;
  note?: string;
};

export type CounterpartyType = "broker" | "custodian" | "bank" | "issuer_agent" | "fund_administrator";

export const COUNTERPARTY_TYPE_LABELS: Record<CounterpartyType, string> = {
  broker: "Broker / dealer",
  custodian: "Custodian",
  bank: "Bank",
  issuer_agent: "Issuing & paying agent",
  fund_administrator: "Fund administrator",
};

export type DueDiligenceStatus = "approved" | "under_review" | "expired" | "conditional" | "rejected";

export const DD_STATUS_LABELS: Record<DueDiligenceStatus, string> = {
  approved: "Approved",
  under_review: "Under review",
  expired: "Review expired",
  conditional: "Approved with conditions",
  rejected: "Rejected",
};

export type Counterparty = {
  id: string;
  name: string;
  type: CounterpartyType;
  jurisdiction: string;
  regulator: string;
  ddStatus: DueDiligenceStatus;
  riskRating: "low" | "medium" | "high";
  lastReviewedAt: string | null;
  nextReviewDue: string;
  /** Current exposure, KES-equivalent — unsettled trades plus cash and assets
   * held. A counterparty with an expired review and live exposure is the
   * combination this register exists to surface. */
  exposureKes: number;
  sanctionsScreenedAt: string;
  sanctionsClear: boolean;
  note?: string;
};

export type InstitutionalClientCompliance = {
  id: string;
  clientName: string;
  clientType: InstitutionalClientType;
  kycTier: "standard" | "enhanced";
  uboVerified: boolean;
  uboCount: number;
  sanctionsClear: boolean;
  riskRating: "low" | "medium" | "high";
  /** Whether the client's own governing body has authorised the appointment —
   * a board resolution or trustee minute. Funding an institutional mandate
   * without it is the single most common institutional onboarding gap. */
  authorityOnFile: boolean;
  lastReviewedAt: string | null;
  nextReviewDue: string;
  outstandingItems: string[];
};
