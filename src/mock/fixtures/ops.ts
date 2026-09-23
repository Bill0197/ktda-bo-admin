/** Operating history for the BO Admin overview.
 *
 * Everything the dashboard shows about *today* is derived from the live
 * fixtures (clients, cases, alerts, approvals, the bond ladder). What no other
 * fixture carries is *history* — the fund has one row per current state, not a
 * time series — so the daily flow and monthly AUM curves are generated here.
 *
 * Generated, not random: a seeded sequence keeps the same numbers across
 * reloads and across the two people looking at the same demo, which random
 * fixtures do not. `navHistory` predates this and still uses `Math.random`;
 * new series should use the generator below.
 */

import { SUB_FUNDS } from "./fund";

/** Deterministic 0–1 sequence (mulberry32). One seed, one series, forever. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The fixtures' "today". Kept in step with the rest of the mock data, which is
 * dated around the first week of August 2026. */
export const OPS_TODAY = new Date("2026-08-19");

export type DailyFlow = {
  date: string;
  /** KES-equivalent, both sub-funds — the dashboard reads total fund flow, and
   * mixing two currencies on one axis would be a lie. USD is converted at the
   * indicative rate below rather than shown as a second scale. */
  subscriptions: number;
  redemptions: number;
  /** Count of settled inbound payments — volume tells a different story from
   * value when the minimum ticket is KES 100. */
  tickets: number;
};

/** Indicative KES/USD used only to express USD flow on the KES axis. A real
 * build reads this from the FX rate the NAV was struck at. */
export const INDICATIVE_USD_KES = 129;

export function dailyFlows(days = 30): DailyFlow[] {
  const rand = seeded(20260819);
  const out: DailyFlow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(OPS_TODAY);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6;
    // Retail money arrives on weekdays and clusters after payday.
    const payday = d.getDate() >= 26 || d.getDate() <= 3;
    const base = weekend ? 0.35 : payday ? 1.45 : 1;
    const subs = Math.round((900_000 + rand() * 1_400_000) * base);
    // Redemptions are a fraction of inflow in a healthy month, with the
    // occasional larger ticket that is what the liquidity gate exists for.
    const spike = rand() > 0.9 ? 2.6 : 1;
    const reds = Math.round((180_000 + rand() * 520_000) * base * spike);
    out.push({
      date: d.toISOString().slice(0, 10),
      subscriptions: subs,
      redemptions: reds,
      tickets: Math.round((weekend ? 30 : 120) + rand() * (weekend ? 40 : 190)),
    });
  }
  return out;
}

export type AumPoint = { month: string; kes: number; usd: number };

/** Twelve months of AUM per sub-fund, ending at each sub-fund's current AUM so
 * the curve and the stat tile can never disagree. */
export function aumTrend(months = 12): AumPoint[] {
  const rand = seeded(981_2026);
  const kesNow = SUB_FUNDS.find((f) => f.currency === "KES")?.aum ?? 0;
  const usdNow = SUB_FUNDS.find((f) => f.currency === "USD")?.aum ?? 0;
  // The two sub-funds did not ramp at the same rate: the KES fund carries the
  // M-Pesa retail flow, while USD is bank-wire only and grew more slowly.
  const kesGrowth = 0.058;
  const usdGrowth = 0.031;
  const out: AumPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(OPS_TODAY);
    d.setMonth(d.getMonth() - i);
    const wobbleKes = 1 + (rand() - 0.5) * 0.04;
    const wobbleUsd = 1 + (rand() - 0.5) * 0.05;
    out.push({
      month: d.toLocaleDateString("en-GB", { month: "short" }),
      kes: Math.round(kesNow * (1 + kesGrowth) ** -i * (i === 0 ? 1 : wobbleKes)),
      usd: Math.round(usdNow * (1 + usdGrowth) ** -i * (i === 0 ? 1 : wobbleUsd)),
    });
  }
  return out;
}
