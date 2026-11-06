/* Bulk onboarding and bulk payment (KTDA farmers), through omnichannel's
 * operator API at /omni/api/operator/bulk-loads.
 *
 * Both flows are file based and long running: upload the CSV (a RUNNING run,
 * HTTP 202), press Process to start the durable job, poll the run until it
 * leaves RUNNING, then read its reconciliation once.
 *
 * ONBOARDING (grower_no,national_id,full_name,msisdn) gives each farmer a
 * phone and PIN login, an omnichannel profile with a product link and an empty
 * wallet. PAYMENT (grower_no,amount_kes,payment_ref) credits those wallets; a
 * grower who was never onboarded is rejected, and payment_ref makes each row
 * safe to send twice. A PAYMENT upload is refused with 409 until an ONBOARDING
 * run has completed for the institution.
 *
 * PAYMENT also takes KTDA's SAP export (16 columns, sapPaymentFile.ts) where
 * omnichannel has the SAP adapter: it derives the accounting file itself and
 * holds the lines that fail a check, with the reason. There a PAYMENT run
 * stops at SUBMITTED after Process and waits for a different operator to
 * release it (maker-checker). Both are read from the run omnichannel answers,
 * never assumed: a run without the approval fields is an omnichannel without
 * them, and the page keeps today's one-step behaviour.
 *
 * REGISTRATION and ACTIVATION are the farmer journey's flows
 * (journeyContract.ts): not on every environment yet, and said so plainly
 * where omnichannel refuses one. */
import { OmniApiError, omniCall } from "./omniApi";
import { formatKes, parseKes } from "./bulk-file";
import { institutionApi } from "./api.institution";
import { BULK_COLUMNS, COLUMNS, NEW_FLOWS, NOT_AVAILABLE, notBuiltYet, type BulkFlow, type OnboardingStatus } from "./journeyContract";

export { BULK_COLUMNS, type BulkFlow };
/** SUBMITTED: a PAYMENT run waiting for a second operator to release it
 *  (an omnichannel with maker-checker only). */
export type RunStatus = "SUBMITTED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";

/** A line omnichannel held instead of paying (a SAP file), or would not
 *  register (CLASH: the phone belongs to another farmer). */
export type HeldLine = {
  lineNo: number;
  growerNo: string | null;
  /** The rule (E02_UNKNOWN_GROWER, CLASH, ...), when omnichannel names one. */
  code: string | null;
  reason: string;
  /** KES; absent for a registration row. */
  amount?: number | null;
  phone?: string | null;
};

export type BulkRun = {
  runId: string;
  flow: BulkFlow;
  institutionId: string;
  /** Not sent by omnichannel today; look the name up from the institutions. */
  institutionName?: string | null;
  currency: string;
  /** The uploaded file's name. */
  sourceName: string;
  status: RunStatus;
  totalRows: number;
  /** Wallets created (ONBOARDING), farmers registered (REGISTRATION), wallets
   *  opened (ACTIVATION) or credited (PAYMENT). */
  processedCount: number;
  /** Rows already applied by an earlier run. */
  skippedCount: number;
  /** Rows refused: bad data, or a payment for a grower not onboarded. */
  failureCount: number;
  /** Credited by this run (PAYMENT); 0 for ONBOARDING. */
  totalAmount: number;
  startedAt: string;
  completedAt: string | null;
  /** A summary with sample failures; always shown on PARTIAL and FAILED. */
  message: string | null;

  /* Maker-checker (PAYMENT, an omnichannel that has it). Absent elsewhere:
     the run then starts on Process, as it always has. */
  /** Who uploaded and submitted it (omnichannel's subject, "staff:<email>"). */
  submittedBy?: string | null;
  submittedAt?: string | null;
  /** Who released it; must differ from submittedBy (omnichannel answers 409 otherwise). */
  releasedBy?: string | null;
  releasedAt?: string | null;

  /* What omnichannel's own checks set aside (the SAP adapter, CLASH rows). */
  /** Lines held, never paid (SAP file). */
  heldCount?: number | null;
  /** Their net, KES. */
  heldTotal?: number | null;
  /** What this run should credit: the file less the held lines, KES. */
  expectedTotal?: number | null;
  expectedCount?: number | null;
  /** Registration rows refused because the phone is another farmer's. */
  clashCount?: number | null;
  /** The held lines and CLASH rows themselves (omnichannel may send the first few only). */
  heldLines?: HeldLine[] | null;
};

/** The run comes from an omnichannel with maker-checker. */
export const hasApproval = (r: BulkRun) => r.status === "SUBMITTED" || "submittedBy" in r || "releasedBy" in r;

/** The earlier run a "same file" 409 names, when its message carries the id. */
export function earlierRunIn(message: string | null | undefined): string | null {
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(message ?? "")?.[0] ?? null;
}

/** The proof panel. An ONBOARDING run has the same shape with amounts 0. */
export type BulkReconciliation = {
  runId: string;
  flow: BulkFlow;
  institutionId: string;
  institutionName: string | null;
  status: RunStatus;
  /** Wallets the institution holds in the run's currency. */
  walletCount: number;
  processedCount: number;
  skippedCount: number;
  failureCount: number;
  creditedTotal: number;
  depositDebitTotal: number;
  depositCreditTotal: number;
  doubleEntryBalanced: boolean;
  /** The file's grand total, when it was passed. */
  expectedTotal: number | null;
  /** creditedTotal equals expectedTotal to the cent; null without one. */
  matchesExpected: boolean | null;

  /* This run on its own, where accounting compares it (newer omnichannel):
     the totals above are the institution's, these are what this run posted. */
  runPostedTotal?: number | null;
  runPostedCount?: number | null;
  expectedCount?: number | null;
  /** runPostedCount equals expectedCount; null without one. */
  matchesExpectedCount?: boolean | null;
  heldCount?: number | null;
  heldTotal?: number | null;
  clashCount?: number | null;
  heldLines?: HeldLine[] | null;
};

/** Payments at or over this need approval, so the backend refuses them here. */
export const MAX_PAYMENT_KES = 1_000_000;

const BASE = "/bulk-loads";
const runPath = (runId: string) => `${BASE}/${encodeURIComponent(runId)}`;

export type { OmniInstitution } from "./api.institution";

/** Omnichannel refuses (403, with no code) an upload or onboarding check for
 *  an institution that is not this back office's own. The page only ever sends
 *  the one omnichannel named, so this means the configuration changed under it. */
const NOT_OURS = "Omnichannel refused this: the institution is not this back office's. Reload the page and try again.";
function plainForbidden<T>(call: Promise<T>): Promise<T> {
  return call.catch((e: unknown) => {
    if (e instanceof OmniApiError && e.status === 403 && !e.code) throw new OmniApiError(403, NOT_OURS);
    throw e;
  });
}

export const bulkLoads = {
  /** The institution this back office works for. Omnichannel answers only
   *  the caller's own, which the proxy sets from configuration; the browser
   *  never names it. */
  ownInstitution: institutionApi.own,
  /** Stores the file and returns the RUNNING run (202). 409 for a PAYMENT
   *  file before onboarding has completed; 400 for an empty file. */
  upload: (flow: BulkFlow, institutionId: string, file: File, institutionName?: string | null, currency = "KES") => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("flow", flow);
    form.append("institutionId", institutionId);
    // Optional: omnichannel keeps its own copy of the institution, made on the
    // first upload, and names it from this field.
    if (institutionName) form.append("institutionName", institutionName);
    form.append("currency", currency);
    const sent = plainForbidden(omniCall.post<BulkRun>(`${BASE}/upload`, form));
    // A flow this omnichannel does not have yet says so; nothing is retried
    // under another flow.
    return NEW_FLOWS.has(flow)
      ? sent.catch((e: unknown) => {
        if (e instanceof OmniApiError && notBuiltYet(e.status, e.message)) throw new OmniApiError(e.status, NOT_AVAILABLE);
        throw e;
      })
      : sent;
  },
  /** Starts the durable job for an uploaded run; a PAYMENT run on an
   *  omnichannel with maker-checker answers SUBMITTED instead. */
  process: (runId: string) => omniCall.post<BulkRun>(`${runPath(runId)}/process`, {}),
  /** The second operator's release of a SUBMITTED run: it then runs. 409
   *  when the caller is the one who submitted it. */
  release: (runId: string) => omniCall.post<BulkRun>(`${runPath(runId)}/release`, {}),
  run: (runId: string) => omniCall.get<BulkRun>(runPath(runId)),
  /** The latest 50 runs, every institution and flow, newest first. */
  recent: () => omniCall.list<BulkRun>(BASE),
  /** `expectedCents` is what the run should have credited, in cents. */
  reconciliation: (runId: string, expectedCents?: number | null) =>
    omniCall.get<BulkReconciliation>(
      `${runPath(runId)}/reconciliation${expectedCents != null ? `?expectedTotal=${formatKes(expectedCents)}` : ""}`,
    ),
  /** Whether payments (any farmer has a wallet) and step 2 (anyone is
   *  registered) are open for the institution. */
  onboardingStatus: (institutionId: string) =>
    plainForbidden(omniCall.get<OnboardingStatus>(`${BASE}/onboarding-status?institutionId=${encodeURIComponent(institutionId)}`)),
};

/* A light read of the file before it is sent: the backend validates every
 * row, this only catches the wrong file (no header, wrong columns, no rows)
 * and, for a payment file, adds up the amounts so the reconciliation can
 * check the credited total against the file's own. */

export type FileSummary = {
  rows: number;
  /** Sum of amount_kes, to the cent; null for an onboarding file or when an
   *  amount does not parse (the backend reports those rows). */
  total: number | null;
  /** Why the file cannot be sent; null when it can. */
  problem: string | null;
  /** Rows the backend will refuse, as a heads-up (amount too large). */
  warnings: string[];
  /** PAYMENT: what the run should credit, in cents: the rows that pass the
   *  checks the backend applies (a KES amount above zero and under the
   *  approval threshold, a payment_ref not already earlier in the file).
   *  Null for other flows. */
  expectedCents?: number | null;
};

export function summariseCsv(flow: BulkFlow, text: string): FileSummary {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const { required, byName } = COLUMNS[flow];
  if (lines.length === 0) return { rows: 0, total: null, problem: "The file is empty.", warnings: [] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length) {
    // Omnichannel would take the file and fail the run on Process; say it now.
    const problem = byName
      ? `The file's header row has no ${missing.join(", ")} column${missing.length === 1 ? "" : "s"}. It needs ${required.join(", ")}.`
      : `The header must have ${BULK_COLUMNS[flow].join(",")}. Missing: ${missing.join(", ")}.`;
    return { rows: 0, total: null, problem, warnings: [] };
  }
  const rows = lines.length - 1;
  if (rows === 0) return { rows: 0, total: null, problem: "The file has a header but no rows.", warnings: [] };
  if (flow === "ACTIVATION") {
    const at = header.indexOf("date_of_birth");
    const bad = at < 0 ? 0 : lines.slice(1).filter((l) => {
      const v = l.split(",")[at]?.trim() ?? "";
      return v !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(v);
    }).length;
    const warnings = bad ? [`${bad.toLocaleString()} row${bad === 1 ? "" : "s"} with a date_of_birth not in YYYY-MM-DD form will fail.`] : [];
    return { rows, total: null, problem: null, warnings };
  }
  if (flow !== "PAYMENT") return { rows, total: null, problem: null, warnings: [] };

  const at = header.indexOf("amount_kes");
  const refAt = header.indexOf("payment_ref");
  let cents = 0;
  let parsed = true;
  let tooLarge = 0;
  // Integer cents, no floats: only rows that will be credited count.
  let expected = 0;
  let refused = 0;
  const refs = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const raw = cells[at]?.trim() ?? "";
    const ref = cells[refAt]?.trim() ?? "";
    const amount = Number(raw);
    const exact = parseKes(raw);
    const repeat = ref !== "" && refs.has(ref);
    if (ref !== "") refs.add(ref);
    if (exact !== null && exact > 0 && exact < MAX_PAYMENT_KES * 100 && ref !== "" && !repeat) expected += exact;
    else refused++;
    if (raw === "" || !Number.isFinite(amount)) {
      parsed = false;
      continue;
    }
    if (amount >= MAX_PAYMENT_KES) tooLarge++;
    cents += Math.round(amount * 100);
  }
  const warnings = tooLarge
    ? [`${tooLarge.toLocaleString()} row${tooLarge === 1 ? "" : "s"} at or over KES ${MAX_PAYMENT_KES.toLocaleString()} will be refused.`]
    : [];
  if (refused > tooLarge) {
    const other = refused - tooLarge;
    warnings.push(`${other.toLocaleString()} row${other === 1 ? "" : "s"} without a KES amount above zero or a payment_ref of their own will not be credited.`);
  }
  return { rows, total: parsed ? cents / 100 : null, problem: null, warnings, expectedCents: expected };
}
