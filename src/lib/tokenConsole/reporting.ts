import { OmniApiError, type CsvDownload } from "../omniApi";
import type { Tone } from "./format";

/* The Reports and Surveillance pages: reports, alerts and runs from the
 * reporting service, through omnichannel. While the service is not switched on
 * (or cannot be reached) every call is a 503, which these pages show as one
 * "reporting is unavailable" state rather than an error on every panel. */

/** The zone the reporting service counts days in, and the end-of-day job runs in. */
export const REPORTING_ZONE = "Africa/Nairobi";

/** The longest period one report may cover (from + 400 days); the service answers 400 beyond it. */
export const MAX_REPORT_DAYS = 400;

/** The service keeps at most 500 characters of a close note. */
export const CLOSE_NOTE_MAX = 500;

/** Today in Nairobi, as YYYY-MM-DD. */
export function reportingToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: REPORTING_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** A YYYY-MM-DD day moved by `days`; calendar arithmetic only, no zone involved. */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Why a period cannot be asked for, or null when it can. */
export function periodProblem(from: string, to: string): string | null {
  if (!DAY.test(from) || !DAY.test(to)) return "Pick both days.";
  if (to < from) return "The end is before the start.";
  if (to > shiftDay(from, MAX_REPORT_DAYS)) return `At most ${MAX_REPORT_DAYS} days per report.`;
  return null;
}

/** What a 404 on a list means: omnichannel predates the reporting endpoints. */
export const NOT_DEPLOYED = "The omnichannel service on this server does not serve reports and alerts yet. They appear once its reporting update is deployed.";

/** A read that may find the reporting service switched off: `unavailable`
 *  carries omnichannel's reason. Any other failure still throws. Only for the
 *  lists (the queue, the run log), where a 404 can only mean the endpoint is
 *  not there; never for one alert, whose 404 means it does not exist. */
export type Reachable<T> = { unavailable: null; data: T } | { unavailable: string; data: null };

export async function reachable<T>(call: Promise<T>): Promise<Reachable<T>> {
  try {
    return { unavailable: null, data: await call };
  } catch (e) {
    if (e instanceof OmniApiError && e.status === 503) return { unavailable: e.message, data: null };
    if (e instanceof OmniApiError && e.status === 404) return { unavailable: NOT_DEPLOYED, data: null };
    throw e;
  }
}

/** Hands a downloaded report to the browser as a file. */
export function saveDownload({ filename, blob }: CsvDownload) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next task: some browsers start the download only after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const RULE_LABEL: Record<string, string> = {
  CAP_STRUCTURING: "Cap structuring",
  ABNORMAL_VOLUME: "Abnormal volume",
  WASH_TRADING: "Wash trading",
};

export const RULE_HINT: Record<string, string> = {
  CAP_STRUCTURING: "Several payments in one day, each under the threshold.",
  ABNORMAL_VOLUME: "A day's orders far above the customer's own 30-day average.",
  WASH_TRADING: "A buy and a sell of the same offering on the same day.",
};

export const SEVERITY_TONE: Record<string, Tone> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };

export const ALERT_STATUS_TONE: Record<string, Tone> = { OPEN: "warning", ASSIGNED: "info", CLOSED: "neutral" };

export const RUN_KIND_LABEL: Record<string, string> = { SNAPSHOT: "Holdings snapshot", RULES: "Surveillance rules", REPORT: "Report" };
