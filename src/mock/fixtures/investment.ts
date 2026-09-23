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

// ---- Products & funds ----

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

export const INVESTMENT_PRODUCTS: InvestmentProduct[] = [
  { id: "pr_1", code: "BRF-KES", name: "BRF — KES Fixed Income Fund", assetClass: "Government fixed income (KES)", currency: "KES", status: "live", aum: 878_744_000, minInvestment: 100, managementFeeBps: 150, benchmark: "91-day T-Bill + 200bps", launchedAt: "2026-04-01", channels: ["Mobile app", "Web", "IFA", "Branch"], cmaApproval: "CMA/CIS/2026/014" },
  { id: "pr_2", code: "BRF-USD", name: "BRF — USD Eurobond Fund", assetClass: "Sovereign hard currency (USD)", currency: "USD", status: "live", aum: 3_203_350, minInvestment: 10, managementFeeBps: 175, benchmark: "US 2Y Treasury + 300bps", launchedAt: "2026-04-01", channels: ["Mobile app", "Web", "IFA"], cmaApproval: "CMA/CIS/2026/015" },
  { id: "pr_3", code: "BRF-INST-KES", name: "BRF Institutional — KES Segregated", assetClass: "Government fixed income (KES)", currency: "KES", status: "live", aum: 2_410_000_000, minInvestment: 50_000_000, managementFeeBps: 65, benchmark: "FTSE Kenya Govt Bond Index", launchedAt: "2026-05-15", channels: ["Direct institutional"], cmaApproval: "CMA/CIS/2026/019", note: "Segregated mandates, not a pooled fund — each client holds its own portfolio under the same house strategy." },
  { id: "pr_4", code: "BRF-MMF", name: "BRF Money Market Fund", assetClass: "Short-dated money market (KES)", currency: "KES", status: "pending_launch", aum: 0, minInvestment: 500, managementFeeBps: 120, benchmark: "91-day T-Bill", launchedAt: "2026-11-01", channels: ["Mobile app", "Web"], cmaApproval: "CMA/CIS/2026/031 — filed, awaiting approval", note: "Cannot be marketed or shown in the investor apps until the CMA approval lands." },
  { id: "pr_5", code: "BRF-PILOT", name: "BRF Tokenized Pilot Cohort", assetClass: "Government fixed income (KES)", currency: "KES", status: "closed", aum: 0, minInvestment: 100, managementFeeBps: 150, benchmark: "91-day T-Bill + 200bps", launchedAt: "2026-01-22", channels: ["Direct"], cmaApproval: "CMA/CIS/2026/003", note: "Closed 2026-04-20; holdings migrated into BRF-KES with the v2 token contract." },
];

// ---- Orders & subscriptions ----

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

export const INVESTMENT_ORDERS: InvestmentOrder[] = [
  { id: "or_1", ref: "ORD-2026-4471", clientName: "Kenya Teachers Pension Scheme", clientType: "institutional", product: "BRF-INST-KES", side: "subscription", amount: 250_000_000, currency: "KES", units: null, dealingPrice: null, placedAt: "2026-09-03T06:05:00Z", dealingDate: "2026-09-03", status: "pending_pricing", channel: "Direct institutional", note: "Above the KES 100m single-order threshold — cash flow notified to the dealer before the strike." },
  { id: "or_2", ref: "ORD-2026-4470", clientName: "Amina Wanjiru", clientType: "retail", product: "BRF-KES", side: "subscription", amount: 50_000, currency: "KES", units: null, dealingPrice: null, placedAt: "2026-09-03T05:40:00Z", dealingDate: "2026-09-03", status: "received", channel: "Mobile app" },
  { id: "or_3", ref: "ORD-2026-4469", clientName: "Sanlam Life Assurance", clientType: "institutional", product: "BRF-INST-KES", side: "redemption", amount: 80_000_000, currency: "KES", units: 6_405_128, dealingPrice: 12.4899, placedAt: "2026-09-02T11:20:00Z", dealingDate: "2026-09-02", status: "priced", channel: "Direct institutional" },
  { id: "or_4", ref: "ORD-2026-4468", clientName: "Cynthia Njeri", clientType: "retail", product: "BRF-KES", side: "switch", amount: 400_000, currency: "KES", units: 32_026, dealingPrice: 12.4899, placedAt: "2026-09-02T09:10:00Z", dealingDate: "2026-09-02", status: "settled", channel: "Web", note: "Switch from BRF-KES into BRF-USD at the same strike — no cash leaves the fund." },
  { id: "or_5", ref: "ORD-2026-4467", clientName: "Esther Chebet", clientType: "retail", product: "BRF-USD", side: "subscription", amount: 2_000, currency: "USD", units: 183.2, dealingPrice: 10.9170, placedAt: "2026-09-01T14:00:00Z", dealingDate: "2026-09-01", status: "settled", channel: "Web" },
  { id: "or_6", ref: "ORD-2026-4466", clientName: "Brian Otieno", clientType: "retail", product: "BRF-KES", side: "subscription", amount: 9_900, currency: "KES", units: null, dealingPrice: null, placedAt: "2026-09-01T08:30:00Z", dealingDate: "2026-09-01", status: "rejected", channel: "Mobile app", note: "Rejected at dealing — account frozen under AML case cs_1. Cash returned to source." },
  { id: "or_7", ref: "ORD-2026-4465", clientName: "Stima SACCO", clientType: "institutional", product: "BRF-INST-KES", side: "subscription", amount: 120_000_000, currency: "KES", units: 9_611_282, dealingPrice: 12.4854, placedAt: "2026-08-29T10:00:00Z", dealingDate: "2026-08-29", status: "settled", channel: "Direct institutional" },
  { id: "or_8", ref: "ORD-2026-4464", clientName: "David Mwangi", clientType: "retail", product: "BRF-KES", side: "redemption", amount: 25_000, currency: "KES", units: 2_002, dealingPrice: 12.4854, placedAt: "2026-08-28T17:50:00Z", dealingDate: "2026-08-29", status: "settled", channel: "Mobile app", note: "Placed after the 16:00 cut-off, so it dealt on the next strike — not late, just next-day." },
  { id: "or_9", ref: "ORD-2026-4463", clientName: "Britam Asset Managers", clientType: "institutional", product: "BRF-USD", side: "subscription", amount: 400_000, currency: "USD", units: null, dealingPrice: null, placedAt: "2026-08-27T13:15:00Z", dealingDate: "2026-08-27", status: "cancelled", channel: "Direct institutional", note: "Withdrawn by the client before the strike." },
];

// ---- Portfolio management (trade blotter) ----

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

export const PORTFOLIO_TRADES: PortfolioTrade[] = [
  { id: "tr_1", ref: "TRD-2026-0912", portfolio: "BRF — KES Fixed Income", instrument: "IFB1/2024/9Yr", isin: "KE1000004718", side: "buy", nominal: 180_000_000, currency: "KES", price: 101.35, yieldPct: 14.62, tradeDate: "2026-09-02", settlementDate: "2026-09-04", broker: "Sterling Capital", status: "ic_pending", rationale: "Rung 3 top-up funded by the August net inflow. Takes single-issue exposure to 16.8%, within the 20% issue cap." },
  { id: "tr_2", ref: "TRD-2026-0911", portfolio: "BRF — KES Fixed Income", instrument: "FXD2/2023/20Yr", isin: "KE2000001567", side: "sell", nominal: 40_000_000, currency: "KES", price: 102.55, yieldPct: 15.88, tradeDate: "2026-09-01", settlementDate: "2026-09-03", broker: "Dyer & Blair", status: "executed", rationale: "Trims the long end to bring portfolio duration back under the 7.5-year mandate ceiling." },
  { id: "tr_3", ref: "TRD-2026-0910", portfolio: "BRF Institutional — KTPS", instrument: "IFB1/2023/8Yr", isin: "KE1000004650", side: "buy", nominal: 300_000_000, currency: "KES", price: 102.75, yieldPct: 14.10, tradeDate: "2026-08-29", settlementDate: "2026-09-02", broker: "Genghis Capital", status: "settled", rationale: "Initial deployment of the KTPS mandate's first tranche." },
  { id: "tr_4", ref: "TRD-2026-0909", portfolio: "BRF — USD Eurobond", instrument: "Kenya Eurobond 2031", isin: "XS2465813789", side: "buy", nominal: 250_000, currency: "USD", price: 98.85, yieldPct: 7.42, tradeDate: "2026-08-28", settlementDate: "2026-09-01", broker: "Standard Chartered", status: "settled", rationale: "Rebuilds rung 1 after the August coupon and redemption outflow." },
  { id: "tr_5", ref: "TRD-2026-0908", portfolio: "BRF — KES Fixed Income", instrument: "FXD1/2022/15Yr", isin: "KE2000001234", side: "buy", nominal: 60_000_000, currency: "KES", price: 101.55, yieldPct: 13.95, tradeDate: "2026-08-26", settlementDate: "2026-08-28", broker: "Sterling Capital", status: "failed", rationale: "Ladder maintenance. Failed on the counterparty's side — no securities delivered; re-booked as TRD-2026-0913." },
  { id: "tr_6", ref: "TRD-2026-0907", portfolio: "BRF Institutional — Sanlam", instrument: "IFB1/2024/10.5Yr", isin: "KE1000004825", side: "sell", nominal: 90_000_000, currency: "KES", price: 101.90, yieldPct: 15.05, tradeDate: "2026-08-25", settlementDate: "2026-08-27", broker: "Genghis Capital", status: "settled", rationale: "Raises cash for the client's notified KES 80m redemption." },
  { id: "tr_7", ref: "TRD-2026-0913", portfolio: "BRF — KES Fixed Income", instrument: "FXD1/2022/15Yr", isin: "KE2000001234", side: "buy", nominal: 60_000_000, currency: "KES", price: 101.60, yieldPct: 13.92, tradeDate: "2026-09-03", settlementDate: "2026-09-05", broker: "Dyer & Blair", status: "proposed", rationale: "Re-book of the failed TRD-2026-0908, routed to a different broker." },
];

// ---- Holdings & positions ----

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

export const HOLDINGS_BOOK: BookHolding[] = [
  { id: "hd_1", portfolio: "BRF — KES Fixed Income", instrument: "IFB1/2023/6.5Yr", isin: "KE1000004551", assetClass: "Infrastructure bond", nominal: 150_000_000, marketValue: 154_200_000, currency: "KES", weightPct: 17.55, limitPct: 20, durationYears: 2.7, yieldPct: 14.25, maturity: "2029-08-14" },
  { id: "hd_2", portfolio: "BRF — KES Fixed Income", instrument: "IFB1/2023/8Yr", isin: "KE1000004650", assetClass: "Infrastructure bond", nominal: 140_000_000, marketValue: 143_800_000, currency: "KES", weightPct: 16.36, limitPct: 20, durationYears: 3.9, yieldPct: 14.50, maturity: "2031-03-22" },
  { id: "hd_3", portfolio: "BRF — KES Fixed Income", instrument: "IFB1/2024/9Yr", isin: "KE1000004718", assetClass: "Infrastructure bond", nominal: 140_000_000, marketValue: 141_900_000, currency: "KES", weightPct: 16.15, limitPct: 20, durationYears: 5.1, yieldPct: 14.80, maturity: "2033-04-09" },
  { id: "hd_4", portfolio: "BRF — KES Fixed Income", instrument: "IFB1/2024/10.5Yr", isin: "KE1000004825", assetClass: "Infrastructure bond", nominal: 140_000_000, marketValue: 142_650_000, currency: "KES", weightPct: 16.23, limitPct: 20, durationYears: 6.2, yieldPct: 15.20, maturity: "2034-11-18" },
  { id: "hd_5", portfolio: "BRF — KES Fixed Income", instrument: "FXD1/2022/15Yr", isin: "KE2000001234", assetClass: "Treasury bond", nominal: 135_000_000, marketValue: 137_100_000, currency: "KES", weightPct: 15.60, limitPct: 20, durationYears: 7.8, yieldPct: 13.90, maturity: "2037-06-30" },
  { id: "hd_6", portfolio: "BRF — KES Fixed Income", instrument: "FXD2/2023/20Yr", isin: "KE2000001567", assetClass: "Treasury bond", nominal: 135_000_000, marketValue: 138_450_000, currency: "KES", weightPct: 15.75, limitPct: 20, durationYears: 9.4, yieldPct: 16.10, maturity: "2043-07-25" },
  { id: "hd_7", portfolio: "BRF — KES Fixed Income", instrument: "Cash & near cash", isin: "—", assetClass: "Cash", nominal: 12_400_000, marketValue: 12_400_000, currency: "KES", weightPct: 1.41, limitPct: null, durationYears: 0, yieldPct: 9.20, maturity: "—" },
  { id: "hd_8", portfolio: "BRF — USD Eurobond", instrument: "Kenya Eurobond 2031", isin: "XS2465813789", assetClass: "Sovereign eurobond", nominal: 1_200_000, marketValue: 1_186_000, currency: "USD", weightPct: 37.03, limitPct: 40, durationYears: 3.9, yieldPct: 7.00, maturity: "2031-02-28" },
  { id: "hd_9", portfolio: "BRF — USD Eurobond", instrument: "Kenya Eurobond 2034", isin: "XS2050880858", assetClass: "Sovereign eurobond", nominal: 1_000_000, marketValue: 1_012_000, currency: "USD", weightPct: 31.59, limitPct: 40, durationYears: 5.8, yieldPct: 8.00, maturity: "2034-05-22" },
  { id: "hd_10", portfolio: "BRF — USD Eurobond", instrument: "Kenya Eurobond 2028", isin: "XS1234567890", assetClass: "Sovereign eurobond", nominal: 950_000, marketValue: 942_000, currency: "USD", weightPct: 29.40, limitPct: 40, durationYears: 1.9, yieldPct: 6.50, maturity: "2028-06-24" },
  { id: "hd_11", portfolio: "BRF — USD Eurobond", instrument: "Cash & near cash", isin: "—", assetClass: "Cash", nominal: 48_000, marketValue: 48_000, currency: "USD", weightPct: 1.50, limitPct: null, durationYears: 0, yieldPct: 4.10, maturity: "—" },
  { id: "hd_12", portfolio: "BRF Institutional — KTPS", instrument: "IFB1/2023/8Yr", isin: "KE1000004650", assetClass: "Infrastructure bond", nominal: 300_000_000, marketValue: 308_250_000, currency: "KES", weightPct: 24.66, limitPct: 25, durationYears: 3.9, yieldPct: 14.10, maturity: "2031-03-22" },
  { id: "hd_13", portfolio: "BRF Institutional — KTPS", instrument: "FXD1/2022/15Yr", isin: "KE2000001234", assetClass: "Treasury bond", nominal: 260_000_000, marketValue: 264_040_000, currency: "KES", weightPct: 21.12, limitPct: 25, durationYears: 7.8, yieldPct: 13.90, maturity: "2037-06-30" },
];

// ---- Valuations & NAV ----

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

export const VALUATION_RUNS: ValuationRun[] = [
  { id: "vr_1", portfolio: "BRF — KES Fixed Income", valuationDate: "2026-09-02", currency: "KES", netAssets: 878_744_000, unitsInIssue: 70_380_000, navPerUnit: 12.4857, movePct: 0.016, tolerancePct: 0.5, pricesSourced: 6, pricesTotal: 6, status: "released_to_finance", reviewer: "Daniel Kiptoo" },
  { id: "vr_2", portfolio: "BRF — USD Eurobond", valuationDate: "2026-09-02", currency: "USD", netAssets: 3_203_350, unitsInIssue: 293_500, navPerUnit: 10.9143, movePct: 0.001, tolerancePct: 0.5, pricesSourced: 3, pricesTotal: 3, status: "released_to_finance", reviewer: "Daniel Kiptoo" },
  { id: "vr_3", portfolio: "BRF Institutional — KTPS", valuationDate: "2026-09-02", currency: "KES", netAssets: 1_249_900_000, unitsInIssue: 100_000_000, navPerUnit: 12.4990, movePct: 0.021, tolerancePct: 0.5, pricesSourced: 4, pricesTotal: 4, status: "reviewed", reviewer: "Ruth Nyambura" },
  { id: "vr_4", portfolio: "BRF Institutional — Sanlam", valuationDate: "2026-09-02", currency: "KES", netAssets: 640_200_000, unitsInIssue: 51_240_000, navPerUnit: 12.4941, movePct: -0.612, tolerancePct: 0.5, pricesSourced: 3, pricesTotal: 4, status: "priced", note: "Outside tolerance and one price unsourced — the 10.5Yr has no custodian mark today. Held for query before review; do not release." },
  { id: "vr_5", portfolio: "BRF — KES Fixed Income", valuationDate: "2026-09-01", currency: "KES", netAssets: 876_910_000, unitsInIssue: 70_240_000, navPerUnit: 12.4845, movePct: 0.006, tolerancePct: 0.5, pricesSourced: 6, pricesTotal: 6, status: "published", reviewer: "Daniel Kiptoo" },
  { id: "vr_6", portfolio: "BRF — USD Eurobond", valuationDate: "2026-09-01", currency: "USD", netAssets: 3_198_100, unitsInIssue: 293_100, navPerUnit: 10.9113, movePct: -0.027, tolerancePct: 0.5, pricesSourced: 3, pricesTotal: 3, status: "published", reviewer: "Daniel Kiptoo" },
  { id: "vr_7", portfolio: "BRF Institutional — KTPS", valuationDate: "2026-09-03", currency: "KES", netAssets: 1_250_400_000, unitsInIssue: 100_000_000, navPerUnit: 12.5040, movePct: 0.040, tolerancePct: 0.5, pricesSourced: 2, pricesTotal: 4, status: "draft", note: "Today's run — custodian feed still loading." },
];

// ---- Redemptions ----

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

export const REDEMPTION_REQUESTS: RedemptionRequest[] = [
  { id: "rq_1", ref: "RDM-2026-0331", clientName: "Sanlam Life Assurance", clientType: "institutional", product: "BRF-INST-KES", units: 6_405_128, amount: 80_000_000, currency: "KES", requestedAt: "2026-09-02T11:20:00Z", settlementTier: "T+5 institutional", dueAt: "2026-09-09", status: "approved", fundedBySale: true, note: "Funded by TRD-2026-0907. Notified 10 business days ahead per the mandate's large-redemption clause." },
  { id: "rq_2", ref: "RDM-2026-0330", clientName: "Kenya Teachers Pension Scheme", clientType: "institutional", product: "BRF-INST-KES", units: 12_000_000, amount: 150_000_000, currency: "KES", requestedAt: "2026-09-01T08:00:00Z", settlementTier: "T+5 institutional", dueAt: "2026-09-08", status: "pending_liquidity", fundedBySale: true, note: "Would take single-day redemptions to 9.1% of AUM, just under the 10% gate. Dealer raising cash across two rungs." },
  { id: "rq_3", ref: "RDM-2026-0329", clientName: "David Mwangi", clientType: "retail", product: "BRF-KES", units: 2_002, amount: 25_000, currency: "KES", requestedAt: "2026-08-28T17:50:00Z", settlementTier: "T+2 standard", dueAt: "2026-09-01", status: "settled", fundedBySale: false },
  { id: "rq_4", ref: "RDM-2026-0328", clientName: "Esther Chebet", clientType: "retail", product: "BRF-USD", units: 45.8, amount: 500, currency: "USD", requestedAt: "2026-08-27T09:00:00Z", settlementTier: "T+7 USD wire", dueAt: "2026-09-05", status: "approved", fundedBySale: false },
  { id: "rq_5", ref: "RDM-2026-0327", clientName: "Britam Asset Managers", clientType: "institutional", product: "BRF-USD", units: 27_500, amount: 300_000, currency: "USD", requestedAt: "2026-08-24T10:15:00Z", settlementTier: "T+7 USD wire", dueAt: "2026-09-02", status: "gated", fundedBySale: true, note: "Deferred to the next dealing cycle — the USD sleeve's cash buffer would have gone negative and the 2028 rung would have had to be broken at a loss." },
  { id: "rq_6", ref: "RDM-2026-0326", clientName: "Brian Otieno", clientType: "retail", product: "BRF-KES", units: 6_720, amount: 84_000, currency: "KES", requestedAt: "2026-08-22T14:30:00Z", settlementTier: "T+2 standard", dueAt: "2026-08-26", status: "rejected", fundedBySale: false, note: "Blocked — tokens frozen and account restricted under AML case cs_1. Customer notified of the restriction, not of the reason (tipping-off)." },
  { id: "rq_7", ref: "RDM-2026-0325", clientName: "Amina Wanjiru", clientType: "retail", product: "BRF-KES", units: 1_600, amount: 20_000, currency: "KES", requestedAt: "2026-09-03T06:30:00Z", settlementTier: "T+2 standard", dueAt: "2026-09-07", status: "requested", fundedBySale: false },
];

// ---- Corporate actions ----

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

export const CORPORATE_ACTIONS: CorporateAction[] = [
  { id: "ca_1", ref: "CA-2026-0087", instrument: "IFB1/2023/8Yr", isin: "KE1000004650", type: "coupon", exDate: "2026-09-15", payDate: "2026-09-22", grossAmount: 10_150_000, currency: "KES", withholdingTax: 0, status: "confirmed", electionRequired: false, note: "Infrastructure bond — coupon is tax exempt, so the WHT line is genuinely zero rather than unpopulated." },
  { id: "ca_2", ref: "CA-2026-0086", instrument: "Kenya Eurobond 2034", isin: "XS2050880858", type: "coupon", exDate: "2026-11-15", payDate: "2026-11-22", grossAmount: 40_000, currency: "USD", withholdingTax: 6_000, status: "announced", electionRequired: false },
  { id: "ca_3", ref: "CA-2026-0085", instrument: "FXD2/2023/20Yr", isin: "KE2000001567", type: "reopening", exDate: "2026-09-18", payDate: "2026-09-25", grossAmount: 0, currency: "KES", withholdingTax: 0, status: "announced", electionRequired: true, electionDue: "2026-09-16", note: "Tap issue at an indicative 16.35%. Participating beyond KES 50m needs Investment Committee approval — raised as IC-2026-0074." },
  { id: "ca_4", ref: "CA-2026-0084", instrument: "Kenya Eurobond 2028", isin: "XS1234567890", type: "call", exDate: "2026-10-01", payDate: "2026-10-10", grossAmount: 950_000, currency: "USD", withholdingTax: 0, status: "announced", electionRequired: true, electionDue: "2026-09-24", note: "Issuer call at par. Would remove the USD sleeve's whole short rung — reinvestment plan needed before the election lapses." },
  { id: "ca_5", ref: "CA-2026-0083", instrument: "IFB1/2023/6.5Yr", isin: "KE1000004551", type: "coupon", exDate: "2026-08-07", payDate: "2026-08-14", grossAmount: 10_687_500, currency: "KES", withholdingTax: 0, status: "processed", electionRequired: false },
  { id: "ca_6", ref: "CA-2026-0082", instrument: "Kenya Eurobond 2031", isin: "XS2465813789", type: "coupon", exDate: "2026-08-21", payDate: "2026-08-28", grossAmount: 42_000, currency: "USD", withholdingTax: 6_300, status: "disputed", electionRequired: false, note: "Custodian credited USD 35,700 net against an expected USD 35,700 — but on 1,150,000 nominal, not 1,200,000. Position break raised with the custodian." },
  { id: "ca_7", ref: "CA-2026-0081", instrument: "FXD1/2019/5Yr", isin: "KE2000000998", type: "maturity", exDate: "2026-07-30", payDate: "2026-07-30", grossAmount: 75_000_000, currency: "KES", withholdingTax: 0, status: "processed", electionRequired: false, note: "Matured and reinvested into rung 6 — this is the rung roll the ladder is built around." },
];

// ---- Investment Committee approval queue ----

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

export const IC_APPROVAL_QUEUE: IcApprovalItem[] = [
  { id: "ic_1", ref: "IC-2026-0074", kind: "new_issue", title: "Participate in the FXD2/2023/20Yr tap — KES 120m", detail: "Reopening at an indicative 16.35%, above the current rung 6 yield of 16.10%. Sizing at KES 120m keeps single-issue exposure at 18.9%, inside the 20% cap, and lengthens duration by 0.3 years to 7.1 — still under the 7.5-year ceiling.", portfolio: "BRF — KES Fixed Income", amount: 120_000_000, currency: "KES", proposedBy: "Ruth Nyambura", proposedAt: "2026-09-02T13:00:00Z", quorum: 3, votes: [{ member: "Susan Achieng", vote: "for", at: "2026-09-02T15:20:00Z" }], status: "pending", dueBy: "2026-09-16" },
  { id: "ic_2", ref: "IC-2026-0073", kind: "trade_authority", title: "Buy IFB1/2024/9Yr — KES 180m", detail: "Above the dealer's KES 100m single-trade authority, so it comes to the Committee. Deploys the August net inflow into rung 3.", portfolio: "BRF — KES Fixed Income", amount: 180_000_000, currency: "KES", proposedBy: "Ruth Nyambura", proposedAt: "2026-09-02T09:40:00Z", quorum: 3, votes: [{ member: "Susan Achieng", vote: "for", at: "2026-09-02T11:00:00Z" }, { member: "Daniel Kiptoo", vote: "for", at: "2026-09-02T11:35:00Z" }], status: "pending", dueBy: "2026-09-05" },
  { id: "ic_3", ref: "IC-2026-0072", kind: "limit_ratification", title: "Ratify passive duration breach — Sanlam mandate", detail: "Portfolio duration reached 7.62 years against a 7.50 ceiling after the August rally, without a trade. Passive breach; the manager proposes a 20-business-day cure window rather than a forced sale into a thin market.", portfolio: "BRF Institutional — Sanlam", amount: null, currency: "KES", proposedBy: "Ruth Nyambura", proposedAt: "2026-09-01T10:15:00Z", quorum: 3, votes: [], status: "pending", dueBy: "2026-09-08" },
  { id: "ic_4", ref: "IC-2026-0071", kind: "counterparty", title: "Add Faida Investment Bank to the approved broker list", detail: "Fourth KES broker, to reduce concentration on Sterling and Genghis. Counterparty due diligence complete, financials reviewed, no adverse findings.", portfolio: "All KES portfolios", amount: null, currency: "KES", proposedBy: "Ruth Nyambura", proposedAt: "2026-08-27T14:00:00Z", quorum: 3, votes: [{ member: "Susan Achieng", vote: "for", at: "2026-08-28T09:00:00Z" }, { member: "Daniel Kiptoo", vote: "for", at: "2026-08-28T09:30:00Z" }, { member: "Peter Otieno", vote: "for", at: "2026-08-28T10:10:00Z" }], status: "approved", decidedAt: "2026-08-28T10:10:00Z" },
  { id: "ic_5", ref: "IC-2026-0070", kind: "strategy_change", title: "Raise the KES sleeve's cash buffer floor from 1.0% to 1.5%", detail: "Two gated USD redemptions in the quarter suggest the buffer is set too tight for the current redemption profile. Costs roughly 6bps of yield.", portfolio: "BRF — KES Fixed Income", amount: null, currency: "KES", proposedBy: "Daniel Kiptoo", proposedAt: "2026-08-20T11:00:00Z", quorum: 3, votes: [{ member: "Susan Achieng", vote: "against", at: "2026-08-21T09:00:00Z", comment: "The gating happened in the USD sleeve; raising the KES buffer does not address it." }, { member: "Peter Otieno", vote: "against", at: "2026-08-21T10:00:00Z" }, { member: "Daniel Kiptoo", vote: "for", at: "2026-08-21T10:20:00Z" }], status: "rejected", decidedAt: "2026-08-21T10:20:00Z" },
  { id: "ic_6", ref: "IC-2026-0069", kind: "mandate_change", title: "Extend the KTPS mandate to permit corporate bonds up to 10%", detail: "Client request. Withdrawn before the vote — the scheme's own trustees had not signed the amended IMA.", portfolio: "BRF Institutional — KTPS", amount: null, currency: "KES", proposedBy: "Ruth Nyambura", proposedAt: "2026-08-12T08:00:00Z", quorum: 3, votes: [], status: "withdrawn", decidedAt: "2026-08-15T12:00:00Z" },
];

// ---- Investment mandates (fund level) ----

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

export const INVESTMENT_MANDATES: InvestmentMandate[] = [
  {
    id: "im_1", ref: "IMD-KES-v3", fund: "BRF — KES Fixed Income Fund",
    objective: "Deliver a return above the 91-day T-Bill plus 200bps with daily liquidity, investing only in Kenya government and government-guaranteed fixed income.",
    benchmark: "91-day T-Bill + 200bps", version: "3.0", approvedAt: "2026-04-01", reviewDue: "2027-04-01", owner: "Investment Committee", status: "active",
    limits: [
      { label: "Single issue", limit: "≤ 20% of NAV", current: "17.55%", status: "within" },
      { label: "Portfolio duration", limit: "≤ 7.50 years", current: "6.84 years", status: "within" },
      { label: "Cash buffer", limit: "≥ 1.00% of NAV", current: "1.41%", status: "within" },
      { label: "Non-government exposure", limit: "0%", current: "0%", status: "within" },
      { label: "Liquidity facility drawn", limit: "≤ 20% of NAV", current: "2.09%", status: "within" },
    ],
  },
  {
    id: "im_2", ref: "IMD-USD-v2", fund: "BRF — USD Eurobond Fund",
    objective: "Hard-currency income from Kenya sovereign eurobonds, targeting the US 2-year Treasury plus 300bps with weekly dealing.",
    benchmark: "US 2Y Treasury + 300bps", version: "2.1", approvedAt: "2026-04-01", reviewDue: "2027-04-01", owner: "Investment Committee", status: "active",
    limits: [
      { label: "Single issue", limit: "≤ 40% of NAV", current: "37.03%", status: "near" },
      { label: "Portfolio duration", limit: "≤ 6.00 years", current: "3.94 years", status: "within" },
      { label: "Cash buffer", limit: "≥ 1.00% of NAV", current: "1.50%", status: "within" },
      { label: "Issuers outside Kenya sovereign", limit: "0%", current: "0%", status: "within" },
    ],
  },
  {
    id: "im_3", ref: "IMD-MMF-v1", fund: "BRF Money Market Fund",
    objective: "Capital preservation and same-day liquidity from short-dated government paper and bank deposits.",
    benchmark: "91-day T-Bill", version: "1.0 draft", approvedAt: "—", reviewDue: "2026-10-15", owner: "Investment Committee", status: "under_review",
    limits: [
      { label: "Weighted average maturity", limit: "≤ 180 days", current: "—", status: "within" },
      { label: "Single bank deposit", limit: "≤ 15% of NAV", current: "—", status: "within" },
      { label: "Cash buffer", limit: "≥ 5.00% of NAV", current: "—", status: "within" },
    ],
  },
  {
    id: "im_4", ref: "IMD-KES-v2", fund: "BRF — KES Fixed Income Fund",
    objective: "Superseded by v3, which raised the single-issue cap from 18% to 20% and introduced the explicit duration ceiling.",
    benchmark: "91-day T-Bill + 150bps", version: "2.2", approvedAt: "2026-01-22", reviewDue: "—", owner: "Investment Committee", status: "superseded",
    limits: [
      { label: "Single issue", limit: "≤ 18% of NAV", current: "—", status: "within" },
      { label: "Portfolio duration", limit: "no explicit ceiling", current: "—", status: "within" },
    ],
  },
];
