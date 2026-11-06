/* The browser's check of a payment file before it is sent: which format it is,
 * and for KTDA's SAP export the same line rules as the KTDA back office
 * (file-rules.ts + bulk-file.ts, copied verbatim). Pure and streaming: the
 * worker (sapPaymentCheck.worker.ts) feeds it one line at a time, so a 600,000
 * line file is never held as lines. Money is integer cents throughout.
 *
 * What the browser cannot check: the farmer register. The rules that need it
 * (E02 unknown grower, E05 wallet belongs to another grower, E06 suspended,
 * W01 name differs) run in omnichannel after upload, and the lines it holds
 * come back on the run. Every other rule (E01, E03, E04, E07, E08, E09) is
 * applied here exactly as the service applies it, so the expected total this
 * sends already leaves out the lines those rules hold. */
import { CHECK_TEXT, Summary, checkLine, compareControl, csvCell, formatKes, parseKes, type CheckCode, type CheckedLine, type ControlCheck, type ControlSheet, type FileSummary, type RegisterEntry } from "./bulk-file";
import { MAX_LINES, headerFor, parseErrorLine, parseLine, toCanonicalCsv, type HeaderMap } from "./file-rules";

/** SAP: KTDA's 16-column export. SIMPLE: the accounting file omnichannel has
 *  always taken (grower_no,amount_kes,payment_ref). */
export type PaymentFormat = "SAP" | "SIMPLE";

export const SIMPLE_COLUMNS = ["grower_no", "amount_kes", "payment_ref"] as const;

/** The rules that need the farmer register, so only omnichannel applies them. */
export const REGISTER_CODES: readonly CheckCode[] = ["E02_UNKNOWN_GROWER", "E05_WALLET_MISMATCH", "E06_WALLET_SUSPENDED", "W01_NAME_DIFFERS"];

/** Which payment file a first line belongs to, or null for neither. */
export function paymentFormatOf(firstLine: string): PaymentFormat | null {
  const cells = firstLine.replace(/^﻿/, "").split(",").map((c) => c.trim().toLowerCase());
  if (SIMPLE_COLUMNS.every((c) => cells.includes(c))) return "SIMPLE";
  return headerFor(firstLine).ok ? "SAP" : null;
}

/** Why a first line is neither file, in words an operator can act on. */
export function formatProblem(firstLine: string): string {
  const h = headerFor(firstLine);
  const sap = h.ok ? "" : h.message;
  return `${sap} Or send the accounting file with the header ${SIMPLE_COLUMNS.join(",")}.`.trim();
}

/* The register stand-in: the line's own grower, wallet and name, always
 * active. With it checkLine applies every rule that does not need the
 * register and passes the ones that do (omnichannel applies those). */
const asItsOwnRegister = (line: { name: string; walletId: string; factoryCode: string }) =>
  (): RegisterEntry => ({ name: line.name, walletId: line.walletId, status: "active", factoryCode: line.factoryCode });

/** Exception report columns. */
export const EXCEPTION_HEADER = "LineNo,GNo,Name,WalletID,FactoryCode,AmountKES,Check,Code,Reason";

const exceptionRow = (l: CheckedLine) =>
  [l.lineNo, l.grower, l.name, l.walletId, l.factoryCode, formatKes(l.amount), l.check, l.code, l.reason].map(csvCell).join(",");

/** How many exception lines are kept for the on-screen table; the CSV keeps up to MAX_EXCEPTION_ROWS. */
export const PREVIEW_EXCEPTIONS = 200;
export const MAX_EXCEPTION_ROWS = 100_000;

export type SapCheckResult = {
  lines: number;
  /** Totals in cents, per factory and per rule code, exactly as the service sums them. */
  summary: FileSummary;
  /** Net of the lines this check holds (errors), in cents. */
  heldCents: number;
  heldCount: number;
  warningCount: number;
  /** What the run should credit: the file's net less the held lines, in cents. */
  expectedCents: number;
  /** The first exception lines, for the on-screen table. */
  preview: CheckedLine[];
  exceptionsTotal: number;
  /** The exception report, header included; capped at MAX_EXCEPTION_ROWS lines. */
  exceptionsCsv: string;
  exceptionsTruncated: boolean;
  /** Header cells that matched no column; read past. */
  extras: string[];
};

export class SapFileChecker {
  private map: HeaderMap | null = null;
  private physical = 0;
  private lines = 0;
  private readonly seen = new Map<string, number>();
  private readonly sum = new Summary();
  private readonly preview: CheckedLine[] = [];
  private readonly rows: string[] = [EXCEPTION_HEADER];
  private exceptionsTotal = 0;

  /** One physical line of the file, header first. Throws with an operator-facing message when the file can't be checked. */
  feed(raw: string): void {
    this.physical++;
    if (!this.map) {
      const h = headerFor(raw);
      if (!h.ok) throw new Error(h.message);
      this.map = h.map;
      return;
    }
    if (raw.trim() === "") return;
    this.lines++;
    if (this.lines > MAX_LINES) throw new Error(`The file has more than ${MAX_LINES.toLocaleString("en-KE")} lines. Split it by factory and send each part.`);
    const p = parseLine(raw, this.physical, this.map);
    const checked = p.ok
      ? checkLine(toCanonicalCsv(p.line), this.physical, asItsOwnRegister(p.line), this.seen)
      : parseErrorLine(p.error, raw);
    // The run's own numbering, as the service keeps it: the Nth payment line.
    checked.lineNo = this.lines;
    this.sum.add(checked);
    if (checked.code !== "OK") {
      this.exceptionsTotal++;
      if (this.preview.length < PREVIEW_EXCEPTIONS) this.preview.push(checked);
      if (this.rows.length <= MAX_EXCEPTION_ROWS) this.rows.push(exceptionRow(checked));
    }
  }

  get lineCount() {
    return this.lines;
  }

  result(): SapCheckResult {
    if (!this.map) throw new Error("The file is empty.");
    if (!this.lines) throw new Error("The file has a header but no payment lines.");
    const summary = this.sum.result();
    return {
      lines: this.lines,
      summary,
      heldCents: summary.heldNet,
      heldCount: summary.errors,
      warningCount: summary.warnings,
      expectedCents: summary.net - summary.heldNet,
      preview: this.preview,
      exceptionsTotal: this.exceptionsTotal,
      exceptionsCsv: `${this.rows.join("\n")}\n`,
      exceptionsTruncated: this.exceptionsTotal > MAX_EXCEPTION_ROWS,
      extras: this.map.extras,
    };
  }
}

/* ---- The control sheet SAP sends with the file (<file>.control.json) ---- */

export type ControlResult = { sheet: ControlSheet; check: ControlCheck; sameName: boolean; shaChecked: boolean };

/** Reads a control sheet's text; throws with what is wrong with it. */
export function parseControlSheet(text: string): ControlSheet {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The control sheet isn't valid JSON.");
  }
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const missing: string[] = [];
  if (typeof c.file !== "string") missing.push("file");
  if (typeof c.rows !== "number" || !Number.isSafeInteger(c.rows) || c.rows < 0) missing.push("rows");
  if (typeof c.totalAmountKES !== "string" || parseKes(c.totalAmountKES) === null) missing.push("totalAmountKES");
  if (typeof c.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(c.sha256)) missing.push("sha256");
  if (missing.length) throw new Error(`The control sheet is missing or has an unreadable ${missing.join(", ")}.`);
  return {
    file: c.file as string,
    rows: c.rows as number,
    totalAmountKES: c.totalAmountKES as string,
    sha256: c.sha256 as string,
    ...(typeof c.paymentType === "string" ? { paymentType: c.paymentType } : {}),
    ...(typeof c.period === "string" ? { period: c.period } : {}),
  };
}

/** The file against its control sheet: line count, the file's whole net (held lines included, as SAP totals it) and checksum. */
export function checkControl(sheet: ControlSheet, fileName: string, result: Pick<SapCheckResult, "lines" | "summary">, sha256: string | null): ControlResult {
  const check = compareControl(sheet, { rows: result.lines, totalCents: result.summary.net, sha256: sha256 ?? "" });
  // No digest on an insecure page: the checksum is "not checked", not "wrong".
  return { sheet, check: sha256 ? check : { ...check, sha256: true }, sameName: sheet.file === fileName, shaChecked: !!sha256 };
}

export const controlOk = (c: ControlResult) => c.check.rows && c.check.total && c.check.sha256;

export { CHECK_TEXT, formatKes, type CheckCode, type CheckedLine, type ControlSheet };
