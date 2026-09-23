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

// ---- Institutional clients ----

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

export const INSTITUTIONAL_CLIENTS: InstitutionalClient[] = [
  { id: "ic_ktps", name: "Kenya Teachers Pension Scheme", type: "pension_scheme", mandateRef: "IMA-2026-001", aum: 1_249_900_000, currency: "KES", relationshipManager: "Anthony Mwenda", onboardedAt: "2026-05-20", status: "active", clientRegulator: "RBA" },
  { id: "ic_sanlam", name: "Sanlam Life Assurance", type: "insurer", mandateRef: "IMA-2026-002", aum: 640_200_000, currency: "KES", relationshipManager: "Anthony Mwenda", onboardedAt: "2026-06-02", status: "active", clientRegulator: "IRA" },
  { id: "ic_stima", name: "Stima SACCO", type: "sacco", mandateRef: "IMA-2026-003", aum: 320_000_000, currency: "KES", relationshipManager: "Faith Kamau", onboardedAt: "2026-07-14", status: "active", clientRegulator: "SASRA" },
  { id: "ic_britam", name: "Britam Asset Managers", type: "insurer", mandateRef: "IMA-2026-004", aum: 1_240_000, currency: "USD", relationshipManager: "Anthony Mwenda", onboardedAt: "2026-06-28", status: "notice_period", clientRegulator: "IRA", note: "Served 90 days' notice on 2026-08-25 after two gated USD redemptions. Termination portfolio to be realised in an orderly wind-down, not a fire sale." },
  { id: "ic_uon", name: "University of Nairobi Endowment", type: "endowment", mandateRef: "IMA-2026-005", aum: 185_000_000, currency: "KES", relationshipManager: "Faith Kamau", onboardedAt: "2026-08-11", status: "active", clientRegulator: "None — charitable trust" },
  { id: "ic_kcb", name: "KCB Group Treasury", type: "corporate", mandateRef: null, aum: 0, currency: "KES", relationshipManager: "Anthony Mwenda", onboardedAt: "2026-09-01", status: "onboarding", clientRegulator: "CBK", note: "IMA drafted; awaiting board resolution and UBO documentation before funding." },
  { id: "ic_afdb", name: "AfDB Local Currency Facility", type: "dfi", mandateRef: null, aum: 0, currency: "USD", relationshipManager: "Anthony Mwenda", onboardedAt: "2026-04-30", status: "terminated", clientRegulator: "Supranational", note: "Prospect closed — the facility's own procurement selected a different manager. Retained for the audit trail." },
];

// ---- Mandates & restrictions ----

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

export const MANDATE_RESTRICTIONS: MandateRestriction[] = [
  { id: "mr_1", mandateRef: "IMA-2026-001", clientName: "Kenya Teachers Pension Scheme", type: "issuer_concentration", rule: "No single government issue above 25% of portfolio value", limitValue: "25.00%", currentValue: "24.66%", headroomPct: 1.4, state: "near", preTradeChecked: true, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_2", mandateRef: "IMA-2026-001", clientName: "Kenya Teachers Pension Scheme", type: "asset_class", rule: "Corporate bonds not permitted", limitValue: "0.00%", currentValue: "0.00%", headroomPct: 100, state: "within", preTradeChecked: true, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_3", mandateRef: "IMA-2026-001", clientName: "Kenya Teachers Pension Scheme", type: "duration", rule: "Modified duration between 4.0 and 8.0 years", limitValue: "4.00 – 8.00 yrs", currentValue: "5.71 yrs", headroomPct: 28.6, state: "within", preTradeChecked: false, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_4", mandateRef: "IMA-2026-002", clientName: "Sanlam Life Assurance", type: "duration", rule: "Modified duration not above 7.50 years", limitValue: "7.50 yrs", currentValue: "7.62 yrs", headroomPct: -1.6, state: "breach", preTradeChecked: false, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_5", mandateRef: "IMA-2026-002", clientName: "Sanlam Life Assurance", type: "liquidity", rule: "At least 5% in instruments realisable within 5 business days", limitValue: "≥ 5.00%", currentValue: "6.80%", headroomPct: 36, state: "within", preTradeChecked: false, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_6", mandateRef: "IMA-2026-003", clientName: "Stima SACCO", type: "credit_quality", rule: "Government and government-guaranteed paper only", limitValue: "100% sovereign", currentValue: "100.00%", headroomPct: 100, state: "within", preTradeChecked: true, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_7", mandateRef: "IMA-2026-003", clientName: "Stima SACCO", type: "prohibited", rule: "No derivatives or structured products of any kind", limitValue: "Prohibited", currentValue: "None held", headroomPct: 100, state: "within", preTradeChecked: true, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_8", mandateRef: "IMA-2026-004", clientName: "Britam Asset Managers", type: "currency", rule: "USD exposure only — no KES-denominated instruments", limitValue: "100% USD", currentValue: "100.00%", headroomPct: 100, state: "within", preTradeChecked: true, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_9", mandateRef: "IMA-2026-005", clientName: "University of Nairobi Endowment", type: "issuer_concentration", rule: "No single issue above 30% of portfolio value", limitValue: "30.00%", currentValue: "29.40%", headroomPct: 2, state: "near", preTradeChecked: true, lastChecked: "2026-09-03T06:00:00Z" },
  { id: "mr_10", mandateRef: "IMA-2026-005", clientName: "University of Nairobi Endowment", type: "liquidity", rule: "At least 10% realisable within 2 business days for grant drawdowns", limitValue: "≥ 10.00%", currentValue: "9.20%", headroomPct: -8, state: "breach", preTradeChecked: false, lastChecked: "2026-09-03T06:00:00Z" },
];

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

export const INSTITUTIONAL_MANDATES: InstitutionalMandate[] = [
  { id: "md_1", ref: "IMA-2026-001", clientId: "ic_ktps", clientName: "Kenya Teachers Pension Scheme", strategy: "Kenya government fixed income — long duration", benchmark: "FTSE Kenya Govt Bond Index", inceptionDate: "2026-05-20", aum: 1_249_900_000, currency: "KES", reviewDue: "2027-05-20", status: "under_amendment", signedBy: "Scheme trustees, 2026-05-18", note: "Amendment to permit up to 10% corporate bonds was withdrawn at IC-2026-0069 — the trustees had not executed the amended IMA. Original terms remain in force." },
  { id: "md_2", ref: "IMA-2026-002", clientId: "ic_sanlam", clientName: "Sanlam Life Assurance", strategy: "Kenya government fixed income — liability matching", benchmark: "FTSE Kenya Govt Bond Index", inceptionDate: "2026-06-02", aum: 640_200_000, currency: "KES", reviewDue: "2027-06-02", status: "active", signedBy: "Chief Investment Officer, 2026-05-30" },
  { id: "md_3", ref: "IMA-2026-003", clientId: "ic_stima", clientName: "Stima SACCO", strategy: "Kenya government fixed income — capital preservation", benchmark: "91-day T-Bill + 150bps", inceptionDate: "2026-07-14", aum: 320_000_000, currency: "KES", reviewDue: "2027-07-14", status: "active", signedBy: "Board of Directors, 2026-07-10" },
  { id: "md_4", ref: "IMA-2026-004", clientId: "ic_britam", clientName: "Britam Asset Managers", strategy: "Kenya sovereign eurobonds — hard currency income", benchmark: "US 2Y Treasury + 300bps", inceptionDate: "2026-06-28", aum: 1_240_000, currency: "USD", reviewDue: "2026-11-23", status: "terminating", signedBy: "Head of Investments, 2026-06-25", note: "90 days' notice served 2026-08-25. Orderly realisation, final valuation and closing report due within 30 days of termination." },
  { id: "md_5", ref: "IMA-2026-005", clientId: "ic_uon", clientName: "University of Nairobi Endowment", strategy: "Kenya government fixed income — income with grant liquidity", benchmark: "91-day T-Bill + 200bps", inceptionDate: "2026-08-11", aum: 185_000_000, currency: "KES", reviewDue: "2027-08-11", status: "active", signedBy: "Endowment Board, 2026-08-08" },
  { id: "md_6", ref: "IMA-2026-006", clientId: "ic_kcb", clientName: "KCB Group Treasury", strategy: "Short-dated government paper — treasury liquidity", benchmark: "91-day T-Bill", inceptionDate: "—", aum: 0, currency: "KES", reviewDue: "—", status: "draft", signedBy: "Unsigned", note: "Cannot be funded until the board resolution and UBO pack are received." },
];

// ---- Segregated portfolios ----

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

export const SEGREGATED_PORTFOLIOS: SegregatedPortfolio[] = [
  { id: "sp_1", name: "BRF Institutional — KTPS", clientName: "Kenya Teachers Pension Scheme", mandateRef: "IMA-2026-001", marketValue: 1_249_900_000, cash: 22_400_000, currency: "KES", ytdReturnPct: 11.42, benchmarkReturnPct: 10.86, durationYears: 5.71, holdingsCount: 4, lastValuedAt: "2026-09-02", custodian: "Stanbic Bank Kenya", openBreaches: 0 },
  { id: "sp_2", name: "BRF Institutional — Sanlam", clientName: "Sanlam Life Assurance", mandateRef: "IMA-2026-002", marketValue: 640_200_000, cash: 8_900_000, currency: "KES", ytdReturnPct: 11.05, benchmarkReturnPct: 10.86, durationYears: 7.62, holdingsCount: 3, lastValuedAt: "2026-09-02", custodian: "Stanbic Bank Kenya", openBreaches: 1 },
  { id: "sp_3", name: "BRF Institutional — Stima", clientName: "Stima SACCO", mandateRef: "IMA-2026-003", marketValue: 320_000_000, cash: 6_100_000, currency: "KES", ytdReturnPct: 10.64, benchmarkReturnPct: 10.20, durationYears: 2.85, holdingsCount: 3, lastValuedAt: "2026-09-02", custodian: "Co-operative Bank", openBreaches: 0 },
  { id: "sp_4", name: "BRF Institutional — Britam USD", clientName: "Britam Asset Managers", mandateRef: "IMA-2026-004", marketValue: 1_240_000, cash: 96_000, currency: "USD", ytdReturnPct: 8.12, benchmarkReturnPct: 8.40, durationYears: 3.10, holdingsCount: 2, lastValuedAt: "2026-09-02", custodian: "Standard Chartered", openBreaches: 0 },
  { id: "sp_5", name: "BRF Institutional — UoN Endowment", clientName: "University of Nairobi Endowment", mandateRef: "IMA-2026-005", marketValue: 185_000_000, cash: 3_200_000, currency: "KES", ytdReturnPct: 4.18, benchmarkReturnPct: 4.05, durationYears: 4.40, holdingsCount: 3, lastValuedAt: "2026-09-02", custodian: "Co-operative Bank", openBreaches: 1 },
];

// ---- Fee schedules ----

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

export const FEE_SCHEDULES: FeeSchedule[] = [
  { id: "fs_1", clientName: "Kenya Teachers Pension Scheme", mandateRef: "IMA-2026-001", structure: "tiered_amc", rateDescription: "75bps to KES 500m · 60bps KES 500m–1bn · 45bps above KES 1bn", effectiveBps: 58, performanceFeePct: null, hurdle: null, highWaterMark: false, billingFrequency: "quarterly", accruedAmount: 1_812_000, currency: "KES", lastInvoicedAt: "2026-06-30", nextInvoiceDue: "2026-09-30" },
  { id: "fs_2", clientName: "Sanlam Life Assurance", mandateRef: "IMA-2026-002", structure: "amc_plus_performance", rateDescription: "50bps AMC plus 10% of return above benchmark", effectiveBps: 50, performanceFeePct: 10, hurdle: "FTSE Kenya Govt Bond Index", highWaterMark: true, billingFrequency: "quarterly", accruedAmount: 800_250, currency: "KES", lastInvoicedAt: "2026-06-30", nextInvoiceDue: "2026-09-30", note: "Outperformance is 19bps YTD. Performance fee accrues but only crystallises above the high-water mark at year end." },
  { id: "fs_3", clientName: "Stima SACCO", mandateRef: "IMA-2026-003", structure: "flat_amc", rateDescription: "65bps flat", effectiveBps: 65, performanceFeePct: null, hurdle: null, highWaterMark: false, billingFrequency: "quarterly", accruedAmount: 520_000, currency: "KES", lastInvoicedAt: "2026-06-30", nextInvoiceDue: "2026-09-30" },
  { id: "fs_4", clientName: "Britam Asset Managers", mandateRef: "IMA-2026-004", structure: "flat_amc", rateDescription: "80bps flat", effectiveBps: 80, performanceFeePct: null, hurdle: null, highWaterMark: false, billingFrequency: "quarterly", accruedAmount: 2_480, currency: "USD", lastInvoicedAt: "2026-06-30", nextInvoiceDue: "2026-09-30", note: "Fees stop accruing on the termination date, not on the notice date — accrual continues to 2026-11-23." },
  { id: "fs_5", clientName: "University of Nairobi Endowment", mandateRef: "IMA-2026-005", structure: "flat_amc", rateDescription: "55bps flat — charitable rate", effectiveBps: 55, performanceFeePct: null, hurdle: null, highWaterMark: false, billingFrequency: "monthly", accruedAmount: 84_800, currency: "KES", lastInvoicedAt: "2026-08-31", nextInvoiceDue: "2026-09-30" },
];

// ---- Institutional reporting ----

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

export const INSTITUTIONAL_REPORTS: InstitutionalReport[] = [
  { id: "ir_1", name: "RBA quarterly scheme investment return", clientName: "Kenya Teachers Pension Scheme", obligation: "regulatory", frequency: "Quarterly", format: "XLSX", dueDate: "2026-09-15", lastSentAt: "2026-06-14", delivery: "due", owner: "Ruth Nyambura" },
  { id: "ir_2", name: "Monthly portfolio valuation & performance", clientName: "Kenya Teachers Pension Scheme", obligation: "contractual", frequency: "Monthly", format: "PDF", dueDate: "2026-09-07", lastSentAt: "2026-08-06", delivery: "scheduled", owner: "Ruth Nyambura" },
  { id: "ir_3", name: "IRA solvency asset schedule", clientName: "Sanlam Life Assurance", obligation: "regulatory", frequency: "Quarterly", format: "XLSX", dueDate: "2026-08-31", lastSentAt: "2026-05-30", delivery: "overdue", owner: "Ruth Nyambura", note: "Held pending the duration breach resolution — the schedule would otherwise report a position the client's own regulator would query." },
  { id: "ir_4", name: "Monthly portfolio valuation & performance", clientName: "Sanlam Life Assurance", obligation: "contractual", frequency: "Monthly", format: "PDF", dueDate: "2026-09-07", lastSentAt: "2026-08-06", delivery: "scheduled", owner: "Ruth Nyambura" },
  { id: "ir_5", name: "SASRA investment compliance certificate", clientName: "Stima SACCO", obligation: "regulatory", frequency: "Quarterly", format: "PDF", dueDate: "2026-09-30", lastSentAt: "2026-06-28", delivery: "scheduled", owner: "Kevin Baraka" },
  { id: "ir_6", name: "Termination & realisation report", clientName: "Britam Asset Managers", obligation: "contractual", frequency: "One-off", format: "PDF", dueDate: "2026-12-23", lastSentAt: null, delivery: "scheduled", owner: "Ruth Nyambura", note: "Due within 30 days of the 2026-11-23 termination date." },
  { id: "ir_7", name: "Endowment board investment pack", clientName: "University of Nairobi Endowment", obligation: "contractual", frequency: "Quarterly", format: "PDF", dueDate: "2026-09-10", lastSentAt: "2026-08-25", delivery: "on_time", owner: "Faith Kamau", note: "August pack delivered early at the board's request." },
  { id: "ir_8", name: "Monthly fee accrual statement", clientName: "University of Nairobi Endowment", obligation: "service", frequency: "Monthly", format: "XLSX", dueDate: "2026-09-05", lastSentAt: "2026-08-04", delivery: "due", owner: "Daniel Kiptoo" },
];

// ---- Mandate breaches (compliance side) ----

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

export const MANDATE_BREACHES: MandateBreach[] = [
  { id: "mb_1", ref: "BR-2026-018", clientName: "Sanlam Life Assurance", mandateRef: "IMA-2026-002", restrictionId: "mr_4", rule: "Modified duration not above 7.50 years", type: "passive", detectedAt: "2026-08-31", magnitude: "7.62 yrs against a 7.50 ceiling (+0.12)", status: "escalated", owner: "Kevin Baraka", cureDueBy: "2026-09-28", clientNotifiedAt: "2026-09-01", note: "Market rally, no trade. IC-2026-0072 proposes a 20-business-day cure rather than forcing a sale into a thin long end." },
  { id: "mb_2", ref: "BR-2026-017", clientName: "University of Nairobi Endowment", mandateRef: "IMA-2026-005", restrictionId: "mr_10", rule: "At least 10% realisable within 2 business days", type: "passive", detectedAt: "2026-09-02", magnitude: "9.20% against a 10.00% floor (−0.80pp)", status: "remediating", owner: "Kevin Baraka", cureDueBy: "2026-09-09", clientNotifiedAt: null, note: "Caused by an unscheduled KES 8m grant drawdown. Cash being rebuilt from the September coupon; client notification due within 5 business days of detection." },
  { id: "mb_3", ref: "BR-2026-016", clientName: "Kenya Teachers Pension Scheme", mandateRef: "IMA-2026-001", restrictionId: "mr_1", rule: "No single government issue above 25% of portfolio value", type: "active", detectedAt: "2026-08-29", magnitude: "25.30% against a 25.00% cap (+0.30pp)", status: "cured", owner: "Kevin Baraka", cureDueBy: "2026-09-02", clientNotifiedAt: "2026-08-29", note: "Caused by TRD-2026-0910 sizing against a stale portfolio value. Partial sale on 2026-08-30 brought it to 24.66%. Pre-trade check now runs on live valuation, not the previous close." },
  { id: "mb_4", ref: "BR-2026-015", clientName: "Britam Asset Managers", mandateRef: "IMA-2026-004", restrictionId: "mr_8", rule: "USD exposure only — no KES-denominated instruments", type: "active", detectedAt: "2026-07-18", magnitude: "KES 4.2m position booked to the wrong portfolio", status: "cured", owner: "Kevin Baraka", cureDueBy: "2026-07-19", clientNotifiedAt: "2026-07-18", note: "Booking error, corrected same day at no cost to the client. Contributed to the client's decision to serve notice." },
  { id: "mb_5", ref: "BR-2026-014", clientName: "Stima SACCO", mandateRef: "IMA-2026-003", restrictionId: "mr_6", rule: "Government and government-guaranteed paper only", type: "active", detectedAt: "2026-08-05", magnitude: "Corporate bond order rejected pre-trade — no exposure taken", status: "cured", owner: "Kevin Baraka", cureDueBy: "2026-08-05", clientNotifiedAt: null, note: "Blocked by the pre-trade check, so no breach reached the portfolio. Logged because a near miss on a prohibited asset class is a control event worth counting." },
];

// ---- Counterparty due diligence ----

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

export const COUNTERPARTIES: Counterparty[] = [
  { id: "cp_1", name: "Sterling Capital", type: "broker", jurisdiction: "Kenya", regulator: "CMA", ddStatus: "approved", riskRating: "low", lastReviewedAt: "2026-03-14", nextReviewDue: "2027-03-14", exposureKes: 180_000_000, sanctionsScreenedAt: "2026-09-01", sanctionsClear: true, note: "Investment Manager's spouse is a dealer here — conflict COI-2026-020 applies, allocation decisions require a second sign-off." },
  { id: "cp_2", name: "Genghis Capital", type: "broker", jurisdiction: "Kenya", regulator: "CMA", ddStatus: "under_review", riskRating: "medium", lastReviewedAt: "2025-09-02", nextReviewDue: "2026-09-02", exposureKes: 90_000_000, sanctionsScreenedAt: "2026-09-01", sanctionsClear: true, note: "Annual review opened after market-abuse alert MA-2026-011 (crossings between related accounts). Exposure capped at KES 100m until it closes." },
  { id: "cp_3", name: "Dyer & Blair", type: "broker", jurisdiction: "Kenya", regulator: "CMA", ddStatus: "conditional", riskRating: "medium", lastReviewedAt: "2026-05-20", nextReviewDue: "2027-05-20", exposureKes: 60_000_000, sanctionsScreenedAt: "2026-09-01", sanctionsClear: true, note: "Approved on condition that no single trade exceeds KES 75m, following spoofing alert MA-2026-008." },
  { id: "cp_4", name: "Stanbic Bank Kenya", type: "custodian", jurisdiction: "Kenya", regulator: "CBK / CMA", ddStatus: "approved", riskRating: "low", lastReviewedAt: "2026-02-10", nextReviewDue: "2027-02-10", exposureKes: 1_890_100_000, sanctionsScreenedAt: "2026-09-01", sanctionsClear: true },
  { id: "cp_5", name: "Standard Chartered", type: "custodian", jurisdiction: "Kenya / UK", regulator: "CBK / FCA", ddStatus: "expired", riskRating: "low", lastReviewedAt: "2025-08-15", nextReviewDue: "2026-08-15", exposureKes: 160_000_000, sanctionsScreenedAt: "2026-09-01", sanctionsClear: true, note: "Review 19 days overdue with live USD custody exposure. Escalated to the Compliance Manager — a lapsed review is a finding whether or not anything is wrong." },
  { id: "cp_6", name: "Co-operative Bank", type: "custodian", jurisdiction: "Kenya", regulator: "CBK", ddStatus: "approved", riskRating: "low", lastReviewedAt: "2026-06-01", nextReviewDue: "2027-06-01", exposureKes: 505_000_000, sanctionsScreenedAt: "2026-09-01", sanctionsClear: true },
  { id: "cp_7", name: "Faida Investment Bank", type: "broker", jurisdiction: "Kenya", regulator: "CMA", ddStatus: "approved", riskRating: "low", lastReviewedAt: "2026-08-28", nextReviewDue: "2027-08-28", exposureKes: 0, sanctionsScreenedAt: "2026-09-01", sanctionsClear: true, note: "Newly approved at IC-2026-0071. No exposure taken yet." },
  { id: "cp_8", name: "Offshore Prime Services Ltd", type: "fund_administrator", jurisdiction: "Mauritius", regulator: "FSC Mauritius", ddStatus: "rejected", riskRating: "high", lastReviewedAt: "2026-04-22", nextReviewDue: "—", exposureKes: 0, sanctionsScreenedAt: "2026-04-22", sanctionsClear: false, note: "Rejected — beneficial ownership could not be established past two intermediate holding companies, and one director returned an adverse-media match." },
];

// ---- Institutional client compliance ----

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

export const INSTITUTIONAL_CLIENT_COMPLIANCE: InstitutionalClientCompliance[] = [
  { id: "icc_1", clientName: "Kenya Teachers Pension Scheme", clientType: "pension_scheme", kycTier: "standard", uboVerified: true, uboCount: 0, sanctionsClear: true, riskRating: "low", authorityOnFile: true, lastReviewedAt: "2026-05-18", nextReviewDue: "2027-05-18", outstandingItems: [] },
  { id: "icc_2", clientName: "Sanlam Life Assurance", clientType: "insurer", kycTier: "standard", uboVerified: true, uboCount: 3, sanctionsClear: true, riskRating: "low", authorityOnFile: true, lastReviewedAt: "2026-05-30", nextReviewDue: "2027-05-30", outstandingItems: [] },
  { id: "icc_3", clientName: "Stima SACCO", clientType: "sacco", kycTier: "standard", uboVerified: true, uboCount: 0, sanctionsClear: true, riskRating: "low", authorityOnFile: true, lastReviewedAt: "2026-07-10", nextReviewDue: "2027-07-10", outstandingItems: ["Updated SASRA licence certificate — current copy expires 2026-10-31"] },
  { id: "icc_4", clientName: "Britam Asset Managers", clientType: "insurer", kycTier: "standard", uboVerified: true, uboCount: 4, sanctionsClear: true, riskRating: "low", authorityOnFile: true, lastReviewedAt: "2026-06-25", nextReviewDue: "2027-06-25", outstandingItems: ["Exit screening before final settlement (Customer Exit §7)"] },
  { id: "icc_5", clientName: "University of Nairobi Endowment", clientType: "endowment", kycTier: "standard", uboVerified: true, uboCount: 0, sanctionsClear: true, riskRating: "low", authorityOnFile: true, lastReviewedAt: "2026-08-08", nextReviewDue: "2027-08-08", outstandingItems: [] },
  { id: "icc_6", clientName: "KCB Group Treasury", clientType: "corporate", kycTier: "enhanced", uboVerified: false, uboCount: 2, sanctionsClear: true, riskRating: "medium", authorityOnFile: false, lastReviewedAt: null, nextReviewDue: "2026-09-20", outstandingItems: ["Board resolution authorising the appointment", "UBO identification for two shareholders above 10%", "Certified copy of the CBK licence", "Source of funds for the initial KES 400m tranche"] },
  { id: "icc_7", clientName: "AfDB Local Currency Facility", clientType: "dfi", kycTier: "enhanced", uboVerified: true, uboCount: 0, sanctionsClear: true, riskRating: "low", authorityOnFile: false, lastReviewedAt: "2026-04-30", nextReviewDue: "—", outstandingItems: ["File retained for the statutory period — no further action, prospect closed"] },
];
