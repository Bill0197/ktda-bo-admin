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
 * run has completed for the institution. */
import { OmniApiError, omniCall } from "./omniApi";

export type BulkFlow = "ONBOARDING" | "PAYMENT";
export type RunStatus = "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";

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
  /** Wallets created (ONBOARDING) or credited (PAYMENT). */
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
};

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
};

export const BULK_COLUMNS: Record<BulkFlow, string[]> = {
  ONBOARDING: ["grower_no", "national_id", "full_name", "msisdn"],
  PAYMENT: ["grower_no", "amount_kes", "payment_ref"],
};

/** Payments at or over this need approval, so the backend refuses them here. */
export const MAX_PAYMENT_KES = 1_000_000;

const BASE = "/bulk-loads";
const runPath = (runId: string) => `${BASE}/${encodeURIComponent(runId)}`;

/** An institution as omnichannel knows it. `name` and the rest are null for
 *  an institution omnichannel has not loaded a file for yet. */
export type OmniInstitution = {
  id: string;
  name: string | null;
  localCurrency: string | null;
  country: string | null;
  status: string | null;
};

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
  ownInstitution: () => omniCall.get<OmniInstitution[]>("/institutions"),
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
    return plainForbidden(omniCall.post<BulkRun>(`${BASE}/upload`, form));
  },
  /** Starts the durable job for an uploaded run. */
  process: (runId: string) => omniCall.post<BulkRun>(`${runPath(runId)}/process`, {}),
  run: (runId: string) => omniCall.get<BulkRun>(runPath(runId)),
  /** The latest 50 runs, every institution and flow, newest first. */
  recent: () => omniCall.list<BulkRun>(BASE),
  reconciliation: (runId: string, expectedTotal?: number | null) =>
    omniCall.get<BulkReconciliation>(
      `${runPath(runId)}/reconciliation${expectedTotal != null ? `?expectedTotal=${expectedTotal.toFixed(2)}` : ""}`,
    ),
  /** Whether payments are open for the institution. */
  onboardingStatus: (institutionId: string) =>
    plainForbidden(omniCall.get<{ onboardingCompleted: boolean }>(`${BASE}/onboarding-status?institutionId=${encodeURIComponent(institutionId)}`)),
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
};

export function summariseCsv(flow: BulkFlow, text: string): FileSummary {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const expected = BULK_COLUMNS[flow];
  if (lines.length === 0) return { rows: 0, total: null, problem: "The file is empty.", warnings: [] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const missing = expected.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: 0, total: null, problem: `The header must have ${expected.join(",")}. Missing: ${missing.join(", ")}.`, warnings: [] };
  }
  const rows = lines.length - 1;
  if (rows === 0) return { rows: 0, total: null, problem: "The file has a header but no rows.", warnings: [] };
  if (flow !== "PAYMENT") return { rows, total: null, problem: null, warnings: [] };

  const at = header.indexOf("amount_kes");
  let cents = 0;
  let parsed = true;
  let tooLarge = 0;
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].split(",")[at]?.trim() ?? "";
    const amount = Number(raw);
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
  return { rows, total: parsed ? cents / 100 : null, problem: null, warnings };
}
