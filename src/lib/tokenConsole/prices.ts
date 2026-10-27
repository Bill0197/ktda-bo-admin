/* The desk's bond prices (BOND_PRICE_SET through maker-checker): what the engine
   answers for a bond's terms and live quote, and the arithmetic the Prices page
   shows before anything is staged. The engine solves the mid to a reference
   yield and quotes mid ± mid × spread / 2; the preview here is that same sum. */

/** One row of the engine's GET /bond-terms (BondTermsEntity). Rates are fractions. */
export type BondTerms = {
  productId: string;
  isin?: string | null;
  issuer?: string | null;
  faceValue?: number | null;
  couponRate?: number | null;
  maturityDate?: string | null;
  /** The desk's price as a reference yield; null until a desk price is set. */
  anchorYield?: number | null;
  anchorSetAt?: string | null;
  anchorSetBy?: string | null;
  /** Whole bid-offer width as a fraction of mid; null until a desk price is set. */
  quoteSpread?: number | null;
};

/** One row of the engine's GET /quotes (MarketPricingService.Quote). bid/offer are null while SUSPENDED. */
export type MarketQuote = {
  offeringId: string;
  bid?: number | null;
  offer?: number | null;
  yield?: number | null;
  accruedInterest?: number | null;
  currency?: string | null;
  asOf?: string | null;
  source?: string | null;
  /** FRESH, WIDENED or SUSPENDED. */
  status?: string | null;
};

/** The most a desk spread may be, as the engine checks it (10% of mid). */
export const MAX_SPREAD_PCT = 10;

export const midOf = (q: MarketQuote | null | undefined): number | null =>
  q?.bid != null && q?.offer != null ? (q.bid + q.offer) / 2 : null;

/** The quote's bid-offer width as a percentage of mid, to two places. */
export function spreadPctOf(q: MarketQuote | null | undefined): number | null {
  const mid = midOf(q);
  if (mid == null || !(mid > 0)) return null;
  return Math.round(((q!.offer! - q!.bid!) / mid) * 10000) / 100;
}

/** What investors would buy at (offer) and sell at (bid) for a desk mid and spread in percent. */
export function previewOf(mid: number, spreadPct: number): { buy: number; sell: number } {
  const half = (mid * spreadPct) / 100 / 2;
  return { buy: mid + half, sell: mid - half };
}

/** Why the desk price cannot be proposed yet, or null when it can. */
export function priceProblem(mid: string, spreadPct: string): string | null {
  const m = Number(mid);
  const s = Number(spreadPct);
  if (mid.trim() === "" || !Number.isFinite(m) || m <= 0) return "Enter a mid price greater than zero.";
  if (spreadPct.trim() === "" || !Number.isFinite(s) || s < 0 || s > MAX_SPREAD_PCT) {
    return `Enter a spread between 0% and ${MAX_SPREAD_PCT}%.`;
  }
  return null;
}
