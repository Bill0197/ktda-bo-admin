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

export const BOND_LADDER: BondPosition[] = [
  { id: "b1", subFund: "KES_FIXED_INCOME", isin: "KE1000004551", name: "IFB1/2023/6.5Yr", couponRate: 0.1425, couponDates: ["2026-02-14", "2026-08-14"], maturity: "2029-08-14", faceValue: 150_000_000, marketValue: 154_200_000, rung: 1 },
  { id: "b2", subFund: "KES_FIXED_INCOME", isin: "KE1000004650", name: "IFB1/2023/8Yr", couponRate: 0.1450, couponDates: ["2026-03-22", "2026-09-22"], maturity: "2031-03-22", faceValue: 140_000_000, marketValue: 143_800_000, rung: 2 },
  { id: "b3", subFund: "KES_FIXED_INCOME", isin: "KE1000004718", name: "IFB1/2024/9Yr", couponRate: 0.1480, couponDates: ["2026-04-09", "2026-10-09"], maturity: "2033-04-09", faceValue: 140_000_000, marketValue: 141_900_000, rung: 3 },
  { id: "b4", subFund: "KES_FIXED_INCOME", isin: "KE1000004825", name: "IFB1/2024/10.5Yr", couponRate: 0.1520, couponDates: ["2026-05-18", "2026-11-18"], maturity: "2034-11-18", faceValue: 140_000_000, marketValue: 142_650_000, rung: 4 },
  { id: "b5", subFund: "KES_FIXED_INCOME", isin: "KE2000001234", name: "FXD1/2022/15Yr", couponRate: 0.1390, couponDates: ["2026-06-30", "2026-12-30"], maturity: "2037-06-30", faceValue: 135_000_000, marketValue: 137_100_000, rung: 5 },
  { id: "b6", subFund: "KES_FIXED_INCOME", isin: "KE2000001567", name: "FXD2/2023/20Yr", couponRate: 0.1610, couponDates: ["2026-07-25", "2027-01-25"], maturity: "2043-07-25", faceValue: 135_000_000, marketValue: 138_450_000, rung: 6 },
  { id: "e1", subFund: "USD_EUROBOND", isin: "XS2465813789", name: "Kenya Eurobond 2031", couponRate: 0.0700, couponDates: ["2026-02-28", "2026-08-28"], maturity: "2031-02-28", faceValue: 1_200_000, marketValue: 1_186_000, rung: 1 },
  { id: "e2", subFund: "USD_EUROBOND", isin: "XS2050880858", name: "Kenya Eurobond 2034", couponRate: 0.0800, couponDates: ["2026-05-22", "2026-11-22"], maturity: "2034-05-22", faceValue: 1_000_000, marketValue: 1_012_000, rung: 2 },
  { id: "e3", subFund: "USD_EUROBOND", isin: "XS1234567890", name: "Kenya Eurobond 2028", couponRate: 0.0650, couponDates: ["2026-06-24", "2026-12-24"], maturity: "2028-06-24", faceValue: 950_000, marketValue: 942_000, rung: 3 },
];

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

/** AUM and NAV per unit built from their parts rather than stored as a typed-in
 * figure — the Operations SOP requires NAV to come from portfolio positions,
 * market prices, cash, accrued income and expenses, then be independently
 * reviewed before publication. */
export function navComposition(code: SubFundCode): NavComposition {
  const fund = SUB_FUNDS.find((f) => f.code === code)!;
  const bondMarketValue = BOND_LADDER
    .filter((b) => b.subFund === code)
    .reduce((sum, b) => sum + b.marketValue, 0);
  const accruedFees = fund.accruedFees + fund.facilityInterestAccrued;
  const totalAum = bondMarketValue + fund.cashBalance + fund.accruedIncome - accruedFees;
  const derivedNav = Number((totalAum / fund.unitsOutstanding).toFixed(4));
  return {
    subFund: code,
    currency: fund.currency,
    bondMarketValue,
    cashBalance: fund.cashBalance,
    accruedIncome: fund.accruedIncome,
    accruedFees,
    totalAum,
    unitsOutstanding: fund.unitsOutstanding,
    derivedNav,
    publishedNav: fund.nav,
    variance: Number((derivedNav - fund.nav).toFixed(4)),
  };
}

export function navHistory(code: SubFundCode, days = 90) {
  const fund = SUB_FUNDS.find((f) => f.code === code)!;
  const points: { date: string; nav: number }[] = [];
  let nav = fund.nav - (fund.nav * fund.ytdReturn * (days / 365));
  const today = new Date("2026-08-06");
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    nav = nav * (1 + (fund.sevenDayYield / 7 / 100) + (Math.random() - 0.48) * 0.00015);
    points.push({ date: d.toISOString().slice(0, 10), nav: Number(nav.toFixed(4)) });
  }
  // The series must end on the published NAV — but assigning only the last
  // point leaves a visible step now that these are drawn against an axis, so
  // the whole path is scaled onto it instead.
  const drift = fund.nav / points[points.length - 1].nav;
  return points.map((p, i) => ({
    date: p.date,
    nav: i === points.length - 1 ? fund.nav : Number((p.nav * drift).toFixed(4)),
  }));
}
