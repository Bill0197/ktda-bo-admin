/* The FX rate customers convert by (omnichannel /api/operator/fx), as the FX
   rates page edits it: the form's values, the proposal that sends only what
   changed, the buy and sell rates a mid and margin give (QuoteMaths: mid ×
   (1 ± margin/2), four places, half up), and the checks the service makes,
   said before anything is sent. */
import type { FxChange, FxProposal, FxSettings } from "../omniApi";

/** What the form edits, as typed. `validUntil` is a datetime-local value in the browser's zone. */
export type FxForm = {
  midRate: string;
  validUntil: string;
  marginPct: string;
  marginFloorPct: string;
  quoteTtlSeconds: string;
  minAmount: string;
  perConversion: string;
  perDay: string;
  suspended: boolean;
};

export const NOTE_MAX = 300;
/** A rate that runs out within this is flagged so the morning's rate is not missed. */
export const EXPIRES_SOON_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** An ISO instant as a datetime-local value in the browser's zone; "" for none. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value as an ISO instant; null when empty or not a date. */
export function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function formOf(s: FxSettings): FxForm {
  return {
    midRate: str(s.midRate),
    validUntil: toLocalInput(s.rateValidUntil),
    marginPct: str(s.marginPct),
    marginFloorPct: str(s.marginFloorPct),
    quoteTtlSeconds: str(s.quoteTtlSeconds),
    minAmount: str(s.minAmount),
    perConversion: str(s.perConversion),
    perDay: str(s.perDay),
    suspended: s.suspended,
  };
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;

/** What a customer pays per USD (buying dollars) and gets per USD (selling them). */
export function ratesOf(mid: number, marginPct: number): { buy: number; sell: number } {
  const half = marginPct / 100 / 2;
  return { buy: round4(mid * (1 + half)), sell: round4(mid * (1 - half)) };
}

/** How the rate in force stands now. */
export function rateState(s: Pick<FxSettings, "midRate" | "rateValidUntil">, now = Date.now()):
  "none" | "expired" | "expiring" | "valid" {
  if (s.midRate === null || !s.rateValidUntil) return "none";
  const until = new Date(s.rateValidUntil).getTime();
  if (Number.isNaN(until) || until <= now) return "expired";
  return until - now < EXPIRES_SOON_MS ? "expiring" : "valid";
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const changed = (typed: string, current: number | null | undefined) => {
  const n = num(typed);
  return n !== null && Number.isFinite(n) && n !== (current ?? null);
};

/**
 * The proposal: only what differs from the setting in force. A new mid always
 * carries its validity, so it is not cut short at the end of the day; a new
 * validity on its own extends the rate in force. A cap left blank keeps its value
 * (the service cannot remove one).
 */
export function proposalFrom(current: FxSettings, f: FxForm, note: string): FxProposal {
  const p: FxProposal = {};
  const until = fromLocalInput(f.validUntil);
  if (changed(f.midRate, current.midRate)) {
    p.midRate = Number(f.midRate);
    if (until) p.rateValidUntil = until;
  } else if (until && f.validUntil !== toLocalInput(current.rateValidUntil)) {
    // Compared as the form shows it (to the minute), so an untouched field is never a change.
    p.rateValidUntil = until;
  }
  if (changed(f.marginPct, current.marginPct)) p.marginPct = Number(f.marginPct);
  if (changed(f.marginFloorPct, current.marginFloorPct)) p.marginFloorPct = Number(f.marginFloorPct);
  if (changed(f.quoteTtlSeconds, current.quoteTtlSeconds)) p.quoteTtlSeconds = Number(f.quoteTtlSeconds);
  if (changed(f.minAmount, current.minAmount)) p.minAmount = Number(f.minAmount);
  if (changed(f.perConversion, current.perConversion)) p.perConversion = Number(f.perConversion);
  if (changed(f.perDay, current.perDay)) p.perDay = Number(f.perDay);
  if (f.suspended !== current.suspended) p.suspended = f.suspended;
  if (note.trim()) p.note = note.trim();
  return p;
}

export const changesSomething = (p: FxProposal) => Object.keys(p).some((k) => k !== "note");

/** Which field is wrong and why, as the service would refuse it; null when the form can be sent. */
export function formProblem(current: FxSettings, f: FxForm, now = Date.now()): { field: keyof FxForm; message: string } | null {
  const positive = (field: keyof FxForm, label: string) => {
    const v = num(f[field] as string);
    return v !== null && (!Number.isFinite(v) || v <= 0) ? { field, message: `${label} must be more than zero.` } : null;
  };
  const mid = num(f.midRate);
  if (f.midRate.trim() === "" && current.midRate !== null) return { field: "midRate", message: "Enter the mid rate." };
  if (mid !== null && (!Number.isFinite(mid) || mid <= 0)) return { field: "midRate", message: "The mid rate must be more than zero." };
  const until = fromLocalInput(f.validUntil);
  if (f.validUntil.trim() !== "" && !until) return { field: "validUntil", message: "Enter a date and time." };
  if (until && new Date(until).getTime() <= now) return { field: "validUntil", message: "Valid until must be in the future." };
  const margin = num(f.marginPct);
  const floor = num(f.marginFloorPct) ?? current.marginFloorPct;
  if (margin === null || !Number.isFinite(margin) || margin < 0 || margin > 50) return { field: "marginPct", message: "The margin must be between 0% and 50%." };
  if (floor < 0 || floor > 50) return { field: "marginFloorPct", message: "The margin floor must be between 0% and 50%." };
  if (margin < floor) return { field: "marginPct", message: `The margin cannot be under the floor of ${floor}%.` };
  const ttl = num(f.quoteTtlSeconds);
  if (ttl === null || !Number.isInteger(ttl) || ttl < 1 || ttl > 900) return { field: "quoteTtlSeconds", message: "A quote holds for 1 to 900 seconds." };
  const bad = positive("minAmount", "The minimum") ?? positive("perConversion", "The per-conversion cap") ?? positive("perDay", "The daily cap");
  if (bad) return bad;
  const min = num(f.minAmount) ?? current.minAmount;
  const one = num(f.perConversion) ?? current.perConversion;
  const day = num(f.perDay) ?? current.perDay;
  if (min !== null && one !== null && one < min) return { field: "perConversion", message: "The per-conversion cap cannot be under the minimum." };
  if (one !== null && day !== null && day < one) return { field: "perDay", message: "The daily cap cannot be under the per-conversion cap." };
  return null;
}

const kes = (v: number | null | undefined) =>
  v === null || v === undefined ? "none" : `KES ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v)}`;

/** "Mid rate 129.89 → 130.10" lines: what `after` changes against `before`. */
export function describeChange(before: FxSettings | FxChange | null, after: FxChange): string[] {
  const lines: string[] = [];
  const b = before;
  const line = (label: string, from: string, to: string) => { if (from !== to) lines.push(b ? `${label}: ${from} → ${to}` : `${label}: ${to}`); };
  line("Mid rate", str(b?.midRate), str(after.midRate));
  line("Valid until", b?.rateValidUntil ? new Date(b.rateValidUntil).toLocaleString() : "", after.rateValidUntil ? new Date(after.rateValidUntil).toLocaleString() : "");
  line("Margin", b ? `${b.marginPct}%` : "", `${after.marginPct}%`);
  line("Margin floor", b ? `${b.marginFloorPct}%` : "", `${after.marginFloorPct}%`);
  line("Quote holds", b ? `${b.quoteTtlSeconds} s` : "", `${after.quoteTtlSeconds} s`);
  line("Minimum", b ? kes(b.minAmount) : "", kes(after.minAmount));
  line("Per conversion", b ? kes(b.perConversion) : "", kes(after.perConversion));
  line("Per day", b ? kes(b.perDay) : "", kes(after.perDay));
  if (!b || b.suspended !== after.suspended) lines.push(after.suspended ? "Conversion paused" : "Conversion open");
  return lines.length ? lines : ["No change from the setting in force"];
}
