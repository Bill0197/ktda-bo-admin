/** Investment management domain — the Investment Manager's own workbench.
 *
 * The split against existing screens is deliberate. `/nav` is Finance's
 * publication queue and `/bond-ladder` is the Investment Committee's view of
 * the ladder; these screens are the manager's working record of *how the book
 * got there* — products, client order flow, trades, positions against limits,
 * the valuation run before it reaches Finance, redemptions, corporate actions,
 * what is waiting on the Committee, and the mandate that constrains all of it.
 *
 * The manager proposes; the Committee decides. Nothing here approves itself. */

export type ProductStatus = "live" | "pending_launch" | "soft_closed" | "closed";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  live: "Live",
  pending_launch: "Pending launch",
  soft_closed: "Soft closed",
  closed: "Closed",
};

export type InvestmentProduct = {
  id: string;
  code: string;
  name: string;
  assetClass: string;
  currency: "KES" | "USD";
  status: ProductStatus;
  aum: number;
  minInvestment: number;
  managementFeeBps: number;
  benchmark: string;
  launchedAt: string;
  /** Distribution channels the product is actually approved for. A product
   * live on the platform but not approved for the IFA channel is a common
   * source of mis-selling, so it is a field rather than an assumption. */
  channels: string[];
  cmaApproval: string;
  note?: string;
};

export type OrderStatus = "received" | "pending_pricing" | "priced" | "settled" | "rejected" | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  pending_pricing: "Awaiting dealing price",
  priced: "Priced — settling",
  settled: "Settled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export type InvestmentOrder = {
  id: string;
  ref: string;
  clientName: string;
  clientType: "retail" | "institutional";
  product: string;
  side: "subscription" | "redemption" | "switch";
  amount: number;
  currency: "KES" | "USD";
  /** Null until the order is priced — a unit count before the dealing price
   * is set would be a guess, and this app does not present guesses as data. */
  units: number | null;
  dealingPrice: number | null;
  placedAt: string;
  dealingDate: string;
  status: OrderStatus;
  channel: string;
  note?: string;
};

export type TradeStatus = "proposed" | "ic_pending" | "executed" | "settled" | "failed";

export const TRADE_STATUS_LABELS: Record<TradeStatus, string> = {
  proposed: "Proposed",
  ic_pending: "With Investment Committee",
  executed: "Executed",
  settled: "Settled",
  failed: "Failed settlement",
};

export type PortfolioTrade = {
  id: string;
  ref: string;
  portfolio: string;
  instrument: string;
  isin: string;
  side: "buy" | "sell";
  nominal: number;
  currency: "KES" | "USD";
  price: number;
  yieldPct: number;
  tradeDate: string;
  settlementDate: string;
  broker: string;
  status: TradeStatus;
  rationale: string;
};

export type BookHolding = {
  id: string;
  portfolio: string;
  instrument: string;
  isin: string;
  assetClass: string;
  nominal: number;
  marketValue: number;
  currency: "KES" | "USD";
  weightPct: number;
  /** The mandate limit this weight is measured against. `null` means the
   * position is not itself limit-bearing (cash). */
  limitPct: number | null;
  durationYears: number;
  yieldPct: number;
  maturity: string;
};

export type ValuationStatus = "draft" | "priced" | "reviewed" | "released_to_finance" | "published";

export const VALUATION_STATUS_LABELS: Record<ValuationStatus, string> = {
  draft: "Draft",
  priced: "Priced",
  reviewed: "Independently reviewed",
  released_to_finance: "Released to Finance",
  published: "Published",
};

export type ValuationRun = {
  id: string;
  portfolio: string;
  valuationDate: string;
  currency: "KES" | "USD";
  netAssets: number;
  unitsInIssue: number;
  navPerUnit: number;
  /** Movement against the previously published price, in percent. The
   * tolerance is what turns a move into a query, so both travel together. */
  movePct: number;
  tolerancePct: number;
  pricesSourced: number;
  pricesTotal: number;
  status: ValuationStatus;
  reviewer?: string;
  note?: string;
};

export type RedemptionStatus = "requested" | "pending_liquidity" | "approved" | "gated" | "settled" | "rejected";

export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  requested: "Requested",
  pending_liquidity: "Awaiting liquidity",
  approved: "Approved",
  gated: "Gated — deferred",
  settled: "Settled",
  rejected: "Rejected",
};

export type RedemptionRequest = {
  id: string;
  ref: string;
  clientName: string;
  clientType: "retail" | "institutional";
  product: string;
  units: number;
  amount: number;
  currency: "KES" | "USD";
  requestedAt: string;
  settlementTier: string;
  dueAt: string;
  status: RedemptionStatus;
  /** Whether the fund had to raise cash by selling rather than paying from
   * the cash buffer. It is the number that tells you if redemptions are
   * starting to drive the book. */
  fundedBySale: boolean;
  note?: string;
};

export type CorporateActionType = "coupon" | "maturity" | "call" | "partial_redemption" | "reopening" | "tax_change" | "restructure";

export const CORPORATE_ACTION_LABELS: Record<CorporateActionType, string> = {
  coupon: "Coupon payment",
  maturity: "Maturity",
  call: "Issuer call",
  partial_redemption: "Partial redemption",
  reopening: "Tap / reopening",
  tax_change: "Tax treatment change",
  restructure: "Restructure",
};

export type CorporateActionStatus = "announced" | "confirmed" | "processed" | "disputed";

export const CORPORATE_ACTION_STATUS_LABELS: Record<CorporateActionStatus, string> = {
  announced: "Announced",
  confirmed: "Confirmed with custodian",
  processed: "Processed",
  disputed: "Disputed",
};

export type CorporateAction = {
  id: string;
  ref: string;
  instrument: string;
  isin: string;
  type: CorporateActionType;
  exDate: string;
  payDate: string;
  grossAmount: number;
  currency: "KES" | "USD";
  withholdingTax: number;
  status: CorporateActionStatus;
  /** Whether the election window needs an instruction from the manager.
   * Calls and reopenings do; coupons do not. */
  electionRequired: boolean;
  electionDue?: string;
  note?: string;
};

export type IcDecisionKind = "trade_authority" | "new_issue" | "limit_ratification" | "counterparty" | "strategy_change" | "mandate_change";

export const IC_KIND_LABELS: Record<IcDecisionKind, string> = {
  trade_authority: "Trade above dealer authority",
  new_issue: "New issue participation",
  limit_ratification: "Limit breach ratification",
  counterparty: "Counterparty addition",
  strategy_change: "Strategy change",
  mandate_change: "Mandate change",
};

export type IcVote = { member: string; vote: "for" | "against" | "abstain"; at: string; comment?: string };

export type IcApprovalItem = {
  id: string;
  ref: string;
  kind: IcDecisionKind;
  title: string;
  detail: string;
  portfolio: string;
  amount: number | null;
  currency: "KES" | "USD";
  proposedBy: string;
  proposedAt: string;
  /** Committee decisions carry a quorum, not a single checker. Below quorum
   * the item is not "pending someone", it is undecidable. */
  quorum: number;
  votes: IcVote[];
  status: "pending" | "approved" | "rejected" | "withdrawn";
  decidedAt?: string;
  dueBy?: string;
};

export type MandateLimit = {
  label: string;
  limit: string;
  current: string;
  status: "within" | "near" | "breach";
};

export type InvestmentMandate = {
  id: string;
  ref: string;
  fund: string;
  objective: string;
  benchmark: string;
  version: string;
  approvedAt: string;
  reviewDue: string;
  owner: string;
  status: "active" | "under_review" | "superseded";
  limits: MandateLimit[];
};
