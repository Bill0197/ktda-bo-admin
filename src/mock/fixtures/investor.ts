import type { SubFundCode } from "./fund";

/** Where the customer sits in the compliance lifecycle, from the investor
 * app's point of view.
 *
 * The first six values are onboarding states. The last three are *post*-
 * activation control states required by the Invescent Customer Exit procedure
 * (§18 — "controlled statuses: Restricted / Suspended / Closed"), the STR
 * procedure (§16 — restriction of withdrawals/redemptions) and the Screening
 * procedure (§14 — TFS freezing). An account can be fully KYC-verified and
 * still be `restricted`; the two are different axes, and `restricted` always
 * carries a `WalletRestriction[]` saying *what* is withheld.
 *
 * BO Admin is the only writer of the last three — the investor app renders
 * them, never sets them. */
export type KycStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "rejected"
  | "suitability_exception"
  | "restricted"
  | "suspended"
  | "closed";

export type Investor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  kycStatus: KycStatus;
  /** Legacy — the suitability questionnaire was retired from the investor
   * apps. Null for anyone who onboarded after that; the investor app no
   * longer surfaces it at all. */
  suitabilityScore: number | null;
  joinedAt: string;
  channel: "self_service" | "ifa_referral" | "bd_officer";
};

export const CURRENT_INVESTOR: Investor = {
  id: "inv_2891",
  firstName: "Amina",
  lastName: "Wanjiru",
  email: "amina.wanjiru@example.com",
  phone: "+254712345678",
  nationalId: "31245678",
  kycStatus: "verified",
  suitabilityScore: 62,
  joinedAt: "2026-03-14T09:20:00Z",
  channel: "self_service",
};

export type Holding = {
  subFund: SubFundCode;
  units: number;
  costBasis: number;
  distributionElection: "reinvest" | "payout";
  /** Date of this holding's first subscription — the start of its soft
   * lock-up window (concept note §5.5).
   *
   * NOTE: the concept note runs the lock-up from "investor subscription date",
   * which for a holding built from several subscriptions implies a per-lot
   * rule. This models it at holding level from the first subscription, which
   * is the investor-favourable reading. Lot-level treatment of top-ups is an
   * open question for Compliance — see the spec review. */
  firstSubscribedAt: string;
};

export const HOLDINGS: Holding[] = [
  { subFund: "KES_FIXED_INCOME", units: 40128.6203, costBasis: 470_000, distributionElection: "reinvest", firstSubscribedAt: "2026-04-18T09:00:00Z" },
  { subFund: "USD_EUROBOND", units: 412.885, costBasis: 4200, distributionElection: "payout", firstSubscribedAt: "2026-07-22T11:05:00Z" },
];

export type TxType = "subscription" | "redemption" | "distribution" | "fee";
export type TxStatus = "pending" | "processing" | "settled" | "failed" | "gated";

export type Transaction = {
  id: string;
  type: TxType;
  subFund: SubFundCode;
  amount: number;
  units: number;
  status: TxStatus;
  channel: "mpesa" | "bank_transfer" | "system";
  createdAt: string;
  settledAt?: string;
  reference: string;
  /** Monitoring-engine risk score (0–100) — high scores feed AML alerting. */
  riskScore?: number;
  counterparty?: string;

  // ---- money breakdown ----
  // `amount` stays the headline figure (what the investor asked for on a
  // redemption, what they received on a distribution). These make the
  // deductions between gross and net explicit, so a statement reconciles.

  /** Gross before any deduction. */
  grossAmount?: number;
  /** Redemptions inside the soft lock-up — concept note §5.5, 1.5% retained
   * in the fund. */
  exitFee?: number;
  /** Withholding deducted from an income distribution. `undefined` means the
   * rate for that instrument is not yet confirmed (Open Question 7), which is
   * a different state from a confirmed zero. */
  withholdingTax?: number;
  /** What actually reaches the investor: gross − exitFee − withholdingTax. */
  netAmount?: number;
  /** Set while a subscription's funds have not cleared. Units are allocated at
   * the dealing-day NAV on settlement, never at request time. */
  awaitingAllocation?: boolean;
};

export const TRANSACTIONS: Transaction[] = [
  { id: "tx_9001", type: "subscription", subFund: "KES_FIXED_INCOME", amount: 50_000, units: 4006.9, status: "settled", channel: "mpesa", createdAt: "2026-08-01T08:12:00Z", settledAt: "2026-08-01T08:12:41Z", reference: "QGH4K2P1M9", riskScore: 72, counterparty: "M-Pesa 254712***455" },
  // KES withholding is 0% — infrastructure bonds pass interest through gross
  // (concept note §3.1), so gross and net are equal here by policy, not by omission.
  { id: "tx_9002", type: "distribution", subFund: "KES_FIXED_INCOME", amount: 5384.12, units: 431.4, status: "settled", channel: "system", createdAt: "2026-07-31T18:00:00Z", settledAt: "2026-07-31T18:04:00Z", reference: "DIST-JUL26-KES", grossAmount: 5384.12, withholdingTax: 0, netAmount: 5384.12 },
  { id: "tx_9003", type: "subscription", subFund: "USD_EUROBOND", amount: 500, units: 45.8, status: "settled", channel: "bank_transfer", createdAt: "2026-07-22T11:05:00Z", settledAt: "2026-07-23T09:40:00Z", reference: "WIRE-KE-88213", riskScore: 34, counterparty: "Stanbic Bank — E. Chebet" },
  // Inside the soft lock-up, so the 1.5% early-exit fee applies and is retained in the fund.
  { id: "tx_9004", type: "redemption", subFund: "KES_FIXED_INCOME", amount: 20_000, units: 1603.4, status: "processing", channel: "mpesa", createdAt: "2026-08-05T14:22:00Z", reference: "RDM-2201-KES", riskScore: 18, counterparty: "M-Pesa 254712***455", grossAmount: 20_000, exitFee: 300, netAmount: 19_700 },
  { id: "tx_9005", type: "subscription", subFund: "KES_FIXED_INCOME", amount: 100, units: 8.02, status: "settled", channel: "mpesa", createdAt: "2026-06-30T07:00:00Z", settledAt: "2026-06-30T07:00:32Z", reference: "QGH3B9X2L1", riskScore: 6, counterparty: "M-Pesa 254712***455" },
  // Eurobond coupon income is withheld at the `wht_eurobonds` rate (15%), which
  // is still pending Tax confirmation — BO Admin flags it. See Open Question 7.
  { id: "tx_9006", type: "distribution", subFund: "USD_EUROBOND", amount: 31.2, units: 0, status: "settled", channel: "system", createdAt: "2026-06-30T18:00:00Z", settledAt: "2026-06-30T18:03:00Z", reference: "DIST-JUN26-USD", grossAmount: 36.71, withholdingTax: 5.51, netAmount: 31.2 },
];

export type RedemptionTier = {
  id: string;
  maxAmount: number;
  label: string;
  settlementDays: number;
  currency: "KES" | "USD";
  /** Set while a tier change is awaiting maker-checker approval in BO Admin. */
  pendingApprovalId?: string;
  pendingSummary?: string;
};

/** Tier schedule is BO-configurable (Platform Settings → Redemption tiers).
 * KES bands come from the concept note §5.2. USD bands are indicative
 * placeholders — the concept note defines no USD schedule (flagged in BO). */
export const REDEMPTION_TIERS: RedemptionTier[] = [
  { id: "rt_kes_1", maxAmount: 50_000, label: "Up to KES 50,000", settlementDays: 0, currency: "KES" },
  { id: "rt_kes_2", maxAmount: 500_000, label: "KES 50,001 – 500,000", settlementDays: 2, currency: "KES" },
  { id: "rt_kes_3", maxAmount: 5_000_000, label: "KES 500,001 – 5,000,000", settlementDays: 7, currency: "KES" },
  { id: "rt_kes_4", maxAmount: Infinity, label: "Above KES 5,000,000", settlementDays: 30, currency: "KES" },
  { id: "rt_usd_1", maxAmount: 500, label: "Up to USD 500", settlementDays: 0, currency: "USD" },
  { id: "rt_usd_2", maxAmount: 5_000, label: "USD 501 – 5,000", settlementDays: 3, currency: "USD" },
  { id: "rt_usd_3", maxAmount: 50_000, label: "USD 5,001 – 50,000", settlementDays: 7, currency: "USD" },
  { id: "rt_usd_4", maxAmount: Infinity, label: "Above USD 50,000", settlementDays: 30, currency: "USD" },
];

export type Statement = { id: string; period: string; subFund: SubFundCode; generatedAt: string; sizeKb: number };

export const STATEMENTS: Statement[] = [
  { id: "st_1", period: "July 2026", subFund: "KES_FIXED_INCOME", generatedAt: "2026-08-01T06:00:00Z", sizeKb: 182 },
  { id: "st_2", period: "June 2026", subFund: "KES_FIXED_INCOME", generatedAt: "2026-07-01T06:00:00Z", sizeKb: 178 },
  { id: "st_3", period: "May 2026", subFund: "KES_FIXED_INCOME", generatedAt: "2026-06-01T06:00:00Z", sizeKb: 175 },
  { id: "st_4", period: "July 2026", subFund: "USD_EUROBOND", generatedAt: "2026-08-01T06:00:00Z", sizeKb: 96 },
];

// ---- Payout destinations ----

/** Where redemption proceeds are paid.
 *
 * Verification is a control, not a formality. Transaction Monitoring §9.1
 * (TM-005) treats payment to an unrelated third party as a red flag, and the
 * Screening Policy §17 requires payout counterparties to be screened on a
 * risk basis. So an account is only payable once its registered name has been
 * matched against the customer's own — which is also exactly what the app has
 * always *told* customers happens ("payouts only ever go to an account in your
 * own name"). Until now nothing enforced it. */
export type PayoutAccountStatus = "pending_verification" | "verified" | "name_mismatch";

export type PayoutAccount = {
  id: string;
  type: "mpesa" | "bank";
  label: string;
  /** The bank the account is held with, from the controlled `BANKS` list. Set
   * for bank accounts only — an account number cannot be routed, or shown back
   * to the customer meaningfully, without it. */
  bankName?: string;
  /** Masked for display — the full number never leaves the backend. */
  value: string;
  /** Name registered against the account at the bank or with Safaricom. */
  registeredName?: string;
  status: PayoutAccountStatus;
  isDefault: boolean;
};

export const PAYOUT_ACCOUNTS: PayoutAccount[] = [
  { id: "pa_1", type: "mpesa", label: "M-Pesa", value: "•••• 5678", registeredName: "AMINA WANJIRU", status: "verified", isDefault: true },
  { id: "pa_2", type: "bank", label: "Equity Bank", bankName: "Equity Bank", value: "•••• 4412", registeredName: "AMINA WANJIRU", status: "verified", isDefault: false },
];
