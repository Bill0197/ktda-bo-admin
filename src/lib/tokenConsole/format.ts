/* Display formatting for the tokenization console pages. Ported from
 * apps/tokenization-web/src/lib/{format,status}.ts.
 *
 * Money arrives as JSON numbers in any currency the accounting service
 * holds, so these helpers are not limited to KES/USD the way src/ui's
 * formatMoney is. Display only: no arithmetic on a monetary value here. */

/** The currency code, not a symbol: KES and USD sit side by side in these
 * tables, and "$" next to "KSh" invites a misread. */
export function money(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined) return "—";
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return currency ? `${currency} ${n}` : n;
}

/** Token quantities are whole numbers. */
export function units(quantity: number | null | undefined): string {
  if (quantity === null || quantity === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(quantity);
}

/** Rates arrive as fractions: 0.1 means 10%. Checked against the live
 * service (coupon tariff 0.1, sub-fund gate 0.1, withholding 0.15). The
 * console's own helper assumed the opposite. */
export function percent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 4 }).format(rate);
}

export function dateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** A plain calendar date (YYYY-MM-DD) has no zone. Parsing it with
 * `new Date()` reads it as UTC midnight and shows the previous day to anyone
 * west of UTC, so it is formatted from its parts instead. */
export function calendarDate(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return dateOf(value);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

/** The date part of an instant, in the viewer's zone. */
export function dateOf(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

/** Middle-truncates an identifier: the tail alone loses the part that
 * differs between two similar UUIDs. */
export function shortId(id: string | null | undefined, head = 8, tail = 4): string {
  if (!id) return "—";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** SCREAMING_SNAKE_CASE -> "Screaming snake case". */
export function label(value: string | null | undefined): string {
  if (!value) return "—";
  const words = value.toLowerCase().split("_");
  return [words[0].charAt(0).toUpperCase() + words[0].slice(1), ...words.slice(1)].join(" ");
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

/* One place for status colours, so a status never reads green on one page
 * and grey on another. Unknown values fall through to neutral: the service
 * can add a value without the page mis-signalling it. */
const TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  UNDER_REVIEW: "warning",
  IN_REVIEW: "warning",
  OPEN: "success",
  ACTIVE: "success",
  APPROVED: "info",
  VERIFIED: "success",
  CONFIRMED: "success",
  COMPLETED: "success",
  POSTED: "success",
  CLEARED: "success",
  RUNNING: "info",
  INITIATED: "neutral",
  PARTIAL: "warning",
  SUSPENDED: "warning",
  FROZEN: "warning",
  FAILED: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  CLOSED: "neutral",
  INACTIVE: "neutral",
  DISABLED: "neutral",
  OFFBOARDED: "neutral",
  RETIRED: "neutral",
};

export function toneFor(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  return TONES[status.toUpperCase()] ?? "neutral";
}
