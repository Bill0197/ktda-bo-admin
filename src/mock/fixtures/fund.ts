export type SubFundCode = "KES_FIXED_INCOME" | "USD_EUROBOND";

export type SubFund = {
  code: SubFundCode;
  name: string;
  currency: "KES" | "USD";
  minInvestment: number;
  nav: number;
  navAsOf: string;
  aum: number;
  ytdReturn: number;
  sevenDayYield: number;
  liquidityFacility: number;
  liquidityUsed: number;
  gateActive: boolean;
  /** Fund launch date — the soft lock-up cohort is everyone who subscribes
   * within `lockup_days` of this (concept note §5.5). */
  launchDate: string;
  /** Which withholding-tax setting prices this sub-fund's coupon income.
   * The rate itself lives in Platform Settings, not here — IFB and Eurobond
   * treatments differ, and both are pending Tax confirmation (Open Question 7). */
  whtSettingKey: "wht_infra_bonds" | "wht_eurobonds";
  /** Units outstanding — the denominator of NAV per unit. */
  unitsOutstanding: number;
  /** Fund-level cash: coupon receipts not yet distributed, plus subscription
   * proceeds. Part of the AUM that prices NAV. */
  cashBalance: number;
  /** Coupon interest earned across the ladder but not yet received in cash. */
  accruedIncome: number;
  /** Management and liquidity-facility charges accrued and not yet settled.
   * Subtracted from AUM, which is how the fee actually reaches the investor. */
  accruedFees: number;
  /** Interest accrued on the drawn liquidity facility (concept note §5.1:
   * CBR + 1.5–2.0%, charged to the fund as an operating expense). */
  facilityInterestAccrued: number;
};

/** Central Bank Rate — the base for liquidity-facility pricing. Seeded value;
 * a real deployment reads this from the CBK rate feed. */
export const CENTRAL_BANK_RATE = 0.1075;

export const SUB_FUNDS: SubFund[] = [
  {
    code: "KES_FIXED_INCOME",
    name: "BRF — KES Fixed Income Fund",
    currency: "KES",
    minInvestment: 100,
    nav: 12.4837,
    navAsOf: "2026-08-06",
    // AUM is the sum of the composition below, not a standalone figure:
    // bond ladder 858,100,000 + cash 12,400,000 + accrued income 9,850,000
    // − accrued fees (1,120,000 + 486,000 facility interest) = 878,744,000.
    // See navComposition(). `nav` above is the last *published* price, so
    // today's derived NAV sits slightly above it — that gap is what the
    // independent review step exists to look at.
    aum: 878_744_000,
    ytdReturn: 0.1128,
    sevenDayYield: 0.1364,
    liquidityFacility: 100_000_000,
    liquidityUsed: 18_400_000,
    gateActive: false,
    launchDate: "2026-04-01",
    whtSettingKey: "wht_infra_bonds",
    unitsOutstanding: 70_380_000,
    cashBalance: 12_400_000,
    accruedIncome: 9_850_000,
    accruedFees: 1_120_000,
    facilityInterestAccrued: 486_000,
  },
  {
    code: "USD_EUROBOND",
    name: "BRF — USD Eurobond Fund",
    currency: "USD",
    minInvestment: 10,
    nav: 10.9142,
    navAsOf: "2026-08-06",
    // bond ladder 3,140,000 + cash 48,000 + accrued income 21,500
    // − accrued fees (4,200 + 1,950 facility interest) = 3,203,350.
    aum: 3_203_350,
    ytdReturn: 0.0871,
    sevenDayYield: 0.1042,
    liquidityFacility: 500_000,
    liquidityUsed: 60_000,
    gateActive: false,
    launchDate: "2026-04-01",
    whtSettingKey: "wht_eurobonds",
    unitsOutstanding: 293_503,
    cashBalance: 48_000,
    accruedIncome: 21_500,
    accruedFees: 4_200,
    facilityInterestAccrued: 1_950,
  },
];

export type BondPosition = {
  id: string;
  subFund: SubFundCode;
  isin: string;
  name: string;
  couponRate: number;
  couponDates: string[];
  maturity: string;
  faceValue: number;
  marketValue: number;
  rung: number;
};

export type NavComposition = {
  subFund: SubFundCode;
  currency: SubFund["currency"];
  /** Mark-to-market value of the bond ladder. */
  bondMarketValue: number;
  cashBalance: number;
  accruedIncome: number;
  /** Accrued management fee + accrued liquidity-facility interest. */
  accruedFees: number;
  /** bondMarketValue + cash + accruedIncome − accruedFees. */
  totalAum: number;
  unitsOutstanding: number;
  /** totalAum ÷ unitsOutstanding, to 4dp. */
  derivedNav: number;
  /** The NAV currently published to investors. */
  publishedNav: number;
  /** derivedNav − publishedNav. A non-zero value is what independent review
   * exists to catch before publication. */
  variance: number;
};
