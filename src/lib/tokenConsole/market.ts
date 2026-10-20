import type { MarketChange, MarketProposal, MarketSettings } from "../omniApi";

/* The Market page's arithmetic: what a proposal changes, and what a change
 * in the log changed. Display and request shaping only. */

/** The part of a setting a proposal can change. */
export type MarketValues = {
  tradingOpen: string;
  tradingClose: string;
  weekendsOpen: boolean;
  halted: boolean;
  haltedOfferings: string[];
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** "09:00:00" and "09:00" are the same time; the service's own pattern takes both. */
export function hhmm(value: string): string {
  return TIME.test(value) ? value.slice(0, 5) : value;
}

export const isTime = (value: string) => TIME.test(value);

const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

/** Why these hours cannot be proposed; null when they can. Same rules as the
 *  service, so the form says so before it is sent. */
export function hoursProblem(open: string, close: string): { field: "tradingOpen" | "tradingClose"; message: string } | null {
  if (!isTime(open)) return { field: "tradingOpen", message: "Enter the opening time as HH:mm (24-hour)." };
  if (!isTime(close)) return { field: "tradingClose", message: "Enter the closing time as HH:mm (24-hour)." };
  if (minutes(close) <= minutes(open)) return { field: "tradingClose", message: "The close must be after the open." };
  return null;
}

const sameSet = (a: string[], b: string[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

/** Only what differs from `current`, so a field left alone keeps whatever the
 *  setting is when the change is approved. The note goes when there is one. */
export function proposalFrom(current: MarketValues, next: MarketValues, note: string): MarketProposal {
  const p: MarketProposal = {};
  if (hhmm(next.tradingOpen) !== hhmm(current.tradingOpen)) p.tradingOpen = hhmm(next.tradingOpen);
  if (hhmm(next.tradingClose) !== hhmm(current.tradingClose)) p.tradingClose = hhmm(next.tradingClose);
  if (next.weekendsOpen !== current.weekendsOpen) p.weekendsOpen = next.weekendsOpen;
  if (next.halted !== current.halted) p.halted = next.halted;
  if (!sameSet(next.haltedOfferings, current.haltedOfferings)) p.haltedOfferings = [...new Set(next.haltedOfferings)].sort();
  const n = note.trim();
  if (n) p.note = n;
  return p;
}

/** Whether a proposal changes the setting at all (a note alone does not). */
export const changesSomething = (p: MarketProposal) => Object.keys(p).some((k) => k !== "note");

export const valuesOf = (s: MarketSettings | MarketChange): MarketValues => ({
  tradingOpen: s.tradingOpen,
  tradingClose: s.tradingClose,
  weekendsOpen: s.weekendsOpen,
  halted: s.halted,
  haltedOfferings: s.haltedOfferings ?? [],
});

/** The setting a change was proposed against: the latest approval decided
 *  before it was proposed, or the defaults when nothing was approved by then.
 *  Null when that cannot be told from the rows at hand (the approval is
 *  older than the page of the log read, or the defaults are no longer known). */
export function baselineOf(change: MarketChange, log: MarketChange[], defaults: MarketValues | null, complete: boolean): MarketValues | null {
  // Instants are compared as times: their fractions of a second vary in length.
  const at = (ts: string | null) => (ts ? Date.parse(ts) : NaN);
  const proposed = at(change.proposedAt);
  let best: MarketChange | null = null;
  for (const c of log) {
    if (c.id === change.id || c.status !== "APPROVED") continue;
    const decided = at(c.decidedAt);
    if (!(decided <= proposed)) continue;
    if (!best || at(best.decidedAt) < decided) best = c;
  }
  if (best) return valuesOf(best);
  // Nothing approved before it in the rows read: only a complete log proves
  // nothing was ever approved before it, and only then do the defaults apply.
  return complete ? defaults : null;
}

/** One line per difference, in words; the whole setting when there is no
 *  baseline to compare with. `name` turns an offering id into its name. */
export function describeDifferences(before: MarketValues | null, after: MarketValues, name: (id: string) => string): string[] {
  const hours = (v: MarketValues) => `${hhmm(v.tradingOpen)}–${hhmm(v.tradingClose)}`;
  const weekends = (v: boolean) => (v ? "open at weekends" : "closed at weekends");
  const list = (ids: string[]) => (ids.length ? ids.map(name).join(", ") : "none");
  if (!before) {
    return [
      `Hours ${hours(after)}`,
      weekends(after.weekendsOpen).replace(/^./, (c) => c.toUpperCase()),
      after.halted ? "Whole market halted" : "Market not halted",
      `Bonds halted: ${list(after.haltedOfferings)}`,
    ];
  }
  const out: string[] = [];
  if (hours(before) !== hours(after)) out.push(`Hours ${hours(before)} → ${hours(after)}`);
  if (before.weekendsOpen !== after.weekendsOpen) out.push(`Weekends: ${after.weekendsOpen ? "now open" : "now closed"}`);
  if (before.halted !== after.halted) out.push(after.halted ? "Halts the whole market" : "Lifts the market halt");
  const added = after.haltedOfferings.filter((id) => !before.haltedOfferings.includes(id));
  const removed = before.haltedOfferings.filter((id) => !after.haltedOfferings.includes(id));
  if (added.length) out.push(`Halts ${list(added)}`);
  if (removed.length) out.push(`Lifts the halt on ${list(removed)}`);
  return out.length ? out : ["No change to the setting"];
}
