/** Market conduct domain — the three registers a CMA-licensed fund manager has
 * to be able to produce on demand: market abuse surveillance, the conflicts of
 * interest register, and personal account (employee) dealing.
 *
 * These sit apart from AML monitoring on purpose. AML asks "is this money
 * clean?"; market conduct asks "did our own people, or someone using our
 * order flow, behave properly?" Same investigative shape, different subject —
 * which is why the subject of a market-abuse alert can be an employee. */

// ---- Market abuse surveillance ----

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

export const MARKET_ABUSE_ALERTS: MarketAbuseAlert[] = [
  { id: "ma_1", ref: "MA-2026-014", typology: "front_running", subject: "Samuel Kariuki", subjectType: "employee", instrument: "IFB1/2023/6.5Yr", detail: "Personal account purchase of the same issue 41 minutes before the fund's own KES 180m block trade printed. Pre-clearance was granted the previous day; the fund order was raised after.", severity: "high", status: "escalated", detectedAt: "2026-09-01T14:12:00Z", assignee: "Peter Otieno" },
  { id: "ma_2", ref: "MA-2026-013", typology: "insider_dealing", subject: "Anthony Mwenda", subjectType: "employee", instrument: "FXD2/2019/15Yr", detail: "Dealt within the closed window ahead of the August NAV publication. Employee holds a seat on the valuation review call, so the closed-period restriction applies.", severity: "high", status: "under_review", detectedAt: "2026-08-28T08:30:00Z", assignee: "Peter Otieno" },
  { id: "ma_3", ref: "MA-2026-012", typology: "unusual_timing", subject: "Cynthia Njeri", subjectType: "client", instrument: "KES Fixed Income units", detail: "Large subscription 20 minutes before the dealing cut-off on three consecutive strike days, each reversed by a redemption the following week — forward-pricing arbitrage pattern.", severity: "medium", status: "under_review", detectedAt: "2026-08-26T15:05:00Z", assignee: "Peter Otieno" },
  { id: "ma_4", ref: "MA-2026-011", typology: "wash_trading", subject: "Genghis Capital (broker)", subjectType: "counterparty", instrument: "IFB1/2022/14Yr", detail: "Two crossings between accounts under common control on the same day at materially the same price, with no change in beneficial ownership.", severity: "medium", status: "open", detectedAt: "2026-08-21T11:48:00Z" },
  { id: "ma_5", ref: "MA-2026-010", typology: "market_manipulation", subject: "Faith Kamau", subjectType: "employee", instrument: "FXD1/2021/10Yr", detail: "Flagged by the price-impact rule; review found the trade was a routine ladder roll executed at the mid. No indication of intent to move the price.", severity: "low", status: "closed_no_action", detectedAt: "2026-08-11T09:00:00Z", assignee: "Peter Otieno" },
  { id: "ma_6", ref: "MA-2026-009", typology: "insider_dealing", subject: "Former dealer (contract ended)", subjectType: "employee", instrument: "IFB1/2023/6.5Yr", detail: "Dealt ahead of the fund's participation in the primary auction. Substantiated on review; employment terminated and the matter notified.", severity: "high", status: "closed_substantiated", detectedAt: "2026-06-14T10:20:00Z", assignee: "Josephine Muthoni", reportedToCma: "2026-06-26" },
  { id: "ma_7", ref: "MA-2026-008", typology: "spoofing", subject: "Dyer & Blair (broker)", subjectType: "counterparty", instrument: "FXD2/2018/20Yr", detail: "Repeated large bids cancelled within seconds on the opposite side of the fund's working order.", severity: "medium", status: "open", detectedAt: "2026-08-19T13:10:00Z" },
];

// ---- Conflicts of interest register ----

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

export const CONFLICT_DECLARATIONS: ConflictDeclaration[] = [
  { id: "cf_1", ref: "COI-2026-021", declaredBy: "Anthony Mwenda", roleLabel: "Head of Business Development", category: "directorship", description: "Non-executive director of a SACCO that is also a prospective institutional client of the fund.", relatedParty: "Mwalimu National SACCO", declaredAt: "2026-08-30", status: "under_review", reviewDue: "2026-09-12" },
  { id: "cf_2", ref: "COI-2026-020", declaredBy: "Ruth Nyambura", roleLabel: "Investment Manager", category: "personal_relationship", description: "Spouse is a fixed-income dealer at an approved broker on the fund's counterparty list.", relatedParty: "Sterling Capital", declaredAt: "2026-08-18", status: "approved_with_controls", mitigation: "Excluded from broker allocation decisions and from the annual counterparty review for this firm. Order routing to Sterling requires a second dealer's sign-off.", reviewedBy: "Peter Otieno", reviewDue: "2027-08-18" },
  { id: "cf_3", ref: "COI-2026-019", declaredBy: "Grace Mumbi", roleLabel: "Operations", category: "gift_hospitality", description: "Two tickets to a corporate hospitality box from a settlement-services vendor under active contract renewal.", relatedParty: "Custodian Services Ltd", valueKes: 48_000, declaredAt: "2026-08-14", status: "prohibited", mitigation: "Above the KES 25,000 acceptance threshold and offered during a live tender. Declined and returned; vendor advised in writing.", reviewedBy: "Peter Otieno" },
  { id: "cf_4", ref: "COI-2026-018", declaredBy: "Daniel Kiptoo", roleLabel: "Head of Finance", category: "gift_hospitality", description: "Branded desk items and a working lunch at an auditor's year-end briefing.", relatedParty: "Audit partner firm", valueKes: 6_500, declaredAt: "2026-08-06", status: "approved_with_controls", mitigation: "Below threshold; recorded in the register, no further action.", reviewedBy: "Peter Otieno" },
  { id: "cf_5", ref: "COI-2026-017", declaredBy: "Faith Kamau", roleLabel: "BD Officer / RM", category: "outside_business", description: "Weekend financial-literacy training business, some attendees are prospective retail investors.", relatedParty: "Self-employed", declaredAt: "2026-05-22", status: "lapsed", mitigation: "Permitted on condition the business never markets the fund's products. Annual re-declaration was due 2026-08-22 and has not been filed.", reviewedBy: "Peter Otieno", reviewDue: "2026-08-22" },
  { id: "cf_6", ref: "COI-2026-016", declaredBy: "Susan Achieng", roleLabel: "Investment Committee", category: "political_exposure", description: "Immediate family member appointed to a county public finance committee — creates a PEP association affecting issuer engagement.", relatedParty: "County Government", declaredAt: "2026-07-30", status: "approved_with_controls", mitigation: "Recused from any discussion of county-issued paper. Screening profile updated to reflect the PEP link.", reviewedBy: "Josephine Muthoni", reviewDue: "2027-07-30" },
  { id: "cf_7", ref: "COI-2026-015", declaredBy: "Mercy Wanjala", roleLabel: "Client Services", category: "supplier_interest", description: "Shareholding in a call-centre technology supplier shortlisted for the servicing platform.", relatedParty: "Shortlisted vendor", declaredAt: "2026-09-01", status: "declared", reviewDue: "2026-09-15" },
];

// ---- Employee (personal account) dealing ----

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

export const EMPLOYEE_TRADES: EmployeeTrade[] = [
  { id: "et_1", ref: "PAD-2026-058", employee: "Samuel Kariuki", roleLabel: "Payment Ops", instrument: "IFB1/2023/6.5Yr", side: "buy", quantity: 500_000, valueKes: 512_000, requestedAt: "2026-08-31T09:00:00Z", preClearance: "approved", executedAt: "2026-09-01T13:31:00Z", blackoutClear: true, minHoldClear: true, conflictClear: false, decidedBy: "Peter Otieno", note: "Cleared before the fund's own order existed. Front-running alert MA-2026-014 raised on execution timing — under investigation." },
  { id: "et_2", ref: "PAD-2026-057", employee: "Anthony Mwenda", roleLabel: "Head of Business Development", instrument: "FXD2/2019/15Yr", side: "buy", quantity: 250_000, valueKes: 243_500, requestedAt: "2026-08-27T16:20:00Z", preClearance: "declined", blackoutClear: false, minHoldClear: true, conflictClear: true, decidedBy: "Peter Otieno", note: "Declined — falls inside the NAV closed period. Alert MA-2026-013 opened because the trade appears to have been placed anyway." },
  { id: "et_3", ref: "PAD-2026-056", employee: "Ruth Nyambura", roleLabel: "Investment Manager", instrument: "Safaricom PLC ordinary shares", side: "buy", quantity: 4_000, valueKes: 68_000, requestedAt: "2026-08-25T07:45:00Z", preClearance: "approved", executedAt: "2026-08-25T11:02:00Z", blackoutClear: true, minHoldClear: true, conflictClear: true, decidedBy: "Peter Otieno", note: "Equity outside the fund's investable universe — no overlap with the mandate." },
  { id: "et_4", ref: "PAD-2026-055", employee: "Grace Mumbi", roleLabel: "Operations", instrument: "FXD1/2021/10Yr", side: "sell", quantity: 100_000, valueKes: 97_200, requestedAt: "2026-08-20T10:10:00Z", preClearance: "approved", executedAt: "2026-08-20T14:40:00Z", blackoutClear: true, minHoldClear: false, conflictClear: true, decidedBy: "Peter Otieno", note: "Sold 22 days after purchase, inside the 30-day minimum holding period. Breach recorded; profit disgorged to charity per the PA dealing policy." },
  { id: "et_5", ref: "PAD-2026-054", employee: "Kevin Baraka", roleLabel: "Institutional Funds Compliance Manager", instrument: "Money market fund units (third party)", side: "buy", quantity: 1, valueKes: 200_000, requestedAt: "2026-08-15T08:00:00Z", preClearance: "approved", executedAt: "2026-08-16T09:15:00Z", blackoutClear: true, minHoldClear: true, conflictClear: true, decidedBy: "Josephine Muthoni" },
  { id: "et_6", ref: "PAD-2026-053", employee: "Daniel Kiptoo", roleLabel: "Head of Finance", instrument: "IFB1/2022/14Yr", side: "buy", quantity: 300_000, valueKes: 306_000, requestedAt: "2026-08-08T12:30:00Z", preClearance: "expired", blackoutClear: true, minHoldClear: true, conflictClear: true, decidedBy: "Peter Otieno", note: "Approval lapsed after the 5-day validity window; not executed." },
  { id: "et_7", ref: "PAD-2026-052", employee: "Susan Achieng", roleLabel: "Investment Committee", instrument: "FXD2/2018/20Yr", side: "buy", quantity: 150_000, valueKes: 141_000, requestedAt: "2026-09-02T15:40:00Z", preClearance: "pending", blackoutClear: true, minHoldClear: true, conflictClear: true },
];
