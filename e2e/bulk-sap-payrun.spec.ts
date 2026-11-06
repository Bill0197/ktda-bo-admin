import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ME, OTHER, envelope, json, signIn } from "./stubs";
import { luhnDigit } from "../src/lib/bulk-file";
import { SapFileChecker } from "../src/lib/sapPaymentFile";

/* Bulk payments with KTDA's SAP export and maker-checker, against stubbed
 * omnichannel answers (the contract of the SAP adapter and release, coded
 * against before it merges). The SAP file is checked in the browser with the
 * KTDA back office's rules before anything is sent; a payment run then waits
 * at SUBMITTED until a different signed-in operator releases it; omnichannel's
 * held lines, CLASH rows and run-only reconciliation are shown when it sends
 * them. An omnichannel without any of this keeps today's behaviour. */

const KTDA = "11111111-1111-4111-8111-111111111111";
const RUN = "44444444-4444-4444-8444-444444444444";
const EARLIER = "55555555-5555-4555-8555-555555555555";
const R = /\/omni\/api\/operator\/bulk-loads/;

const HEADER = "LineNo,GNo,Name,WalletID,PhoneNo,FactoryCode,FactoryName,BuyingCentre,KgDelivered,RateKES,GrossKES,LoanKES,InputsKES,AdvanceKES,Amount,PayTo";
const wallet = (n: number, ok = true) => {
  const d = String(n).padStart(8, "0");
  return `KTW${d}${ok ? luhnDigit(d) : (luhnDigit(d) + 1) % 10}`;
};
type L = { n: number; g: number; name?: string; w?: string; fac?: string; kg?: string; gross: string; loan?: string; amount: string };
const line = ({ n, g, name, w, fac, kg, gross, loan, amount }: L) =>
  [n, `KG-${String(g).padStart(6, "0")}`, name ?? `Farmer ${g}`, w ?? wallet(g), "254700000000", fac ?? "KG", "Kangaita Tea Factory", "Kangaita BC1", kg ?? "100", "21.00", gross, loan ?? "0.00", "0.00", "0.00", amount, "WALLET"].join(",");

/* Ten lines: four pay (KES 5,000.00), six are held by a rule the browser
   applies (KES 3,350.00), so the file's net is KES 8,350.00. */
const SAP_LINES = [
  line({ n: 1, g: 1, gross: "1000.00", amount: "1000.00" }),
  line({ n: 2, g: 2, gross: "2100.50", loan: "100.00", amount: "2000.50" }),
  line({ n: 3, g: 3, gross: "1500.25", amount: "1500.25" }),
  line({ n: 4, g: 1, gross: "700.00", amount: "700.00" }), // E03: grower 1 again
  line({ n: 5, g: 5, w: wallet(5, false), gross: "800.00", amount: "800.00" }), // E04
  line({ n: 6, g: 6, fac: "NY", gross: "900.00", amount: "900.00" }), // E07
  line({ n: 7, g: 7, gross: "1000.00", amount: "950.00" }), // E08
  line({ n: 8, g: 8, gross: "0.00", amount: "0.00" }), // E09
  line({ n: 9, g: 9, kg: "lots", gross: "100.00", amount: "100.00" }), // E01
  line({ n: 10, g: 10, name: '"Doe, Jane"', gross: "499.25", amount: "499.25" }),
];
const SAP_CSV = `${HEADER}\n${SAP_LINES.join("\n")}\n`;
const SAP_SHA = createHash("sha256").update(SAP_CSV).digest("hex");
const CONTROL = { file: "KTDA_GL_2026_10_10.csv", rows: 10, totalAmountKES: "8350.00", sha256: SAP_SHA, period: "2026-10" };

const file = (name: string, text: string, mimeType = "text/csv") => ({ name, mimeType, buffer: Buffer.from(text) });

type Run = Record<string, unknown>;
const run = (over: Run = {}): Run => ({
  runId: RUN, flow: "PAYMENT", institutionId: KTDA, currency: "KES", sourceName: CONTROL.file,
  status: "SUBMITTED", totalRows: 10, processedCount: 0, skippedCount: 0, failureCount: 0, totalAmount: 0,
  startedAt: "2026-11-06T08:00:00Z", completedAt: null, message: null,
  submittedBy: ME, submittedAt: "2026-11-06T08:00:01Z", releasedBy: null, releasedAt: null,
  heldCount: 7, heldTotal: 3850, expectedTotal: 4500, expectedCount: 3, ...over,
});

type Sent = { method: string; path: string; query: URLSearchParams; subject: string | undefined };

/** Omnichannel with the SAP adapter and maker-checker (or, with `legacy`, without). */
async function stubOmni(page: Page, opts: {
  upload?: { status: number; body: unknown };
  process?: Run;
  /** The run as each GET answers, the last repeating. */
  polls?: Run[];
  recent?: Run[];
  release?: { status: number; body: unknown };
  reconciliation?: Run;
} = {}) {
  const sent: Sent[] = [];
  let poll = 0;
  await page.route(/\/omni\/api\/operator\/institutions$/, (route) => json(route, [{ id: KTDA, name: "KTDA Holdings", localCurrency: "KES", country: "KE", status: "ACTIVE" }]));
  await page.route(R, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/omni\/api\/operator\/bulk-loads/, "");
    sent.push({ method: req.method(), path, query: url.searchParams, subject: req.headers()["x-operator-subject"] });
    if (path === "/onboarding-status") return json(route, { onboardingCompleted: true, registrationCompleted: true });
    if (path === "") return json(route, opts.recent ?? []);
    if (req.method() === "POST" && path === "/upload") {
      const out = opts.upload ?? { status: 202, body: run({ status: "RUNNING", submittedBy: null, submittedAt: null }) };
      return json(route, out.body, out.status);
    }
    if (req.method() === "POST" && path === `/${RUN}/process`) return json(route, opts.process ?? run());
    if (req.method() === "POST" && path === `/${RUN}/release`) {
      const out = opts.release ?? { status: 200, body: run({ status: "RUNNING", releasedBy: OTHER, releasedAt: "2026-11-06T08:05:00Z" }) };
      return json(route, out.body, out.status);
    }
    if (path === `/${RUN}`) {
      const polls = opts.polls ?? [run()];
      const r = polls[Math.min(poll, polls.length - 1)];
      poll++;
      return json(route, r);
    }
    if (path === `/${RUN}/reconciliation`) return json(route, opts.reconciliation ?? {});
    return json(route, { message: "Not stubbed" }, 404);
  });
  return sent;
}

/** Signs in as the second operator instead of the stubs' default one. */
async function signInAs(page: Page, email: string, fullName: string) {
  await page.route(/\/tok\/auth\/me$/, (route) => json(route, { email, fullName, roles: ["ADMIN"], admin: true }));
}

const completed = (over: Run = {}) => run({
  status: "COMPLETED", releasedBy: OTHER, releasedAt: "2026-11-06T08:05:00Z", processedCount: 3, totalAmount: 4500,
  completedAt: "2026-11-06T08:05:03Z", message: "3 credited, 7 held",
  heldLines: [
    { lineNo: 4, growerNo: "KG-000001", code: "E03_DUPLICATE", reason: "Grower already appears earlier in this file (line 1)", amount: 700 },
    { lineNo: 10, growerNo: "KG-000010", code: "E02_UNKNOWN_GROWER", reason: "Grower number not in the farmer register", amount: 499.25 },
  ],
  ...over,
});

const reconciled = {
  runId: RUN, flow: "PAYMENT", institutionId: KTDA, institutionName: "KTDA Holdings", status: "COMPLETED",
  walletCount: 120, processedCount: 3, skippedCount: 0, failureCount: 0, creditedTotal: 98000,
  depositDebitTotal: 98000, depositCreditTotal: 98000, doubleEntryBalanced: true, expectedTotal: 4500, matchesExpected: true,
  runPostedTotal: 4500, runPostedCount: 3, expectedCount: 3, matchesExpectedCount: true, heldCount: 7, heldTotal: 3850,
};

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the browser check of a SAP file matches the KTDA back office's rules, line for line", () => {
  const c = new SapFileChecker();
  for (const l of SAP_CSV.split("\n").filter(Boolean)) c.feed(l);
  const r = c.result();
  expect(r.lines).toBe(10);
  expect(r.summary.net).toBe(835000);
  expect(r.heldCount).toBe(6);
  expect(r.heldCents).toBe(335000);
  expect(r.expectedCents).toBe(500000);
  expect(r.summary.byCode).toEqual({ OK: 4, E03_DUPLICATE: 1, E04_WALLET_CHECK_DIGIT: 1, E07_FACTORY_MISMATCH: 1, E08_AMOUNT_ARITHMETIC: 1, E09_AMOUNT_NOT_POSITIVE: 1, E01_MALFORMED: 1 });
  expect(r.exceptionsCsv.split("\n").filter(Boolean)).toHaveLength(7);
});

test("SAP file: checked before upload, submitted by the uploader, who cannot release it", async ({ page }) => {
  const sent = await stubOmni(page);
  await page.goto("/bulk/payments");
  await expect(page.getByRole("heading", { name: "Bulk payments" })).toBeVisible();
  const submit = page.getByRole("button", { name: "Submit", exact: true });
  await expect(submit).toBeDisabled();

  await page.getByLabel("CSV file").setInputFiles(file(CONTROL.file, SAP_CSV));
  const check = page.getByTestId("sap-check");
  await expect(check).toContainText("KTDA SAP export, 10 lines");
  await expect(page.getByTestId("sap-net")).toHaveText("KES 8,350.00");
  await expect(page.getByTestId("sap-held")).toHaveText("6");
  await expect(page.getByTestId("sap-expected")).toHaveText("KES 5,000.00");
  const byCode = page.getByTestId("sap-by-code");
  for (const [code, n] of [["OK", 4], ["E01_MALFORMED", 1], ["E03_DUPLICATE", 1], ["E04_WALLET_CHECK_DIGIT", 1], ["E07_FACTORY_MISMATCH", 1], ["E08_AMOUNT_ARITHMETIC", 1], ["E09_AMOUNT_NOT_POSITIVE", 1]] as const) {
    await expect(byCode.locator(`tr[data-code="${code}"] td`).last()).toHaveText(String(n));
  }
  await expect(page.getByTestId("sap-exceptions")).toContainText("Factory code doesn't match the grower number");

  // The exception report downloads with every held line and its reason.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exception report \(6 lines\)/ }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe("KTDA_GL_2026_10_10.exceptions.csv");
  const report = readFileSync(await d.path(), "utf8").trim().split("\n");
  expect(report[0]).toBe("LineNo,GNo,Name,WalletID,FactoryCode,AmountKES,Check,Code,Reason");
  expect(report).toHaveLength(7);
  expect(report.find((r) => r.startsWith("4,"))).toContain("E03_DUPLICATE");

  // The control sheet SAP sent with it agrees on lines, total and checksum.
  await page.getByLabel("Control sheet").setInputFiles(file("KTDA_GL_2026_10_10.control.json", JSON.stringify(CONTROL), "application/json"));
  await expect(page.getByTestId("control-result")).toContainText("This is the file SAP sent for 2026-10");
  await expect(page.getByTestId("control-result")).toContainText("Checksum matches");

  await submit.click();
  const approval = page.getByTestId("run-approval");
  await expect(approval.getByTestId("approval-submitted")).toContainText("amina@baracel.ae");
  await expect(approval.getByTestId("approval-released")).toContainText("Waiting for release");
  await expect(approval.getByTestId("release-summary")).toContainText("3 lines, KES 4,500.00");
  await expect(approval.getByRole("button", { name: "Release" })).toBeDisabled();
  await expect(approval.getByTestId("release-blocked")).toHaveText("You submitted this run. A different operator must sign in and release it.");
  await expect(page.getByTestId("run-progress")).toHaveCount(0);

  // Every omnichannel call named the signed-in operator; release was never called.
  expect(sent.length).toBeGreaterThan(0);
  expect(sent.every((s) => s.subject === ME)).toBe(true);
  expect(sent.some((s) => s.path === `/${RUN}/process`)).toBe(true);
  expect(sent.some((s) => s.path.endsWith("/release"))).toBe(false);
});

test("a file that does not match its control sheet cannot be submitted, and says why", async ({ page }) => {
  await stubOmni(page);
  await page.goto("/bulk/payments");
  await page.getByLabel("CSV file").setInputFiles(file(CONTROL.file, SAP_CSV));
  await expect(page.getByTestId("sap-check")).toBeVisible();
  await page.getByLabel("Control sheet").setInputFiles(file("c.control.json", JSON.stringify({ ...CONTROL, rows: 11, totalAmountKES: "9000.00" }), "application/json"));
  await expect(page.getByTestId("control-result")).toContainText("Lines: sheet 11, file 10");
  await expect(page.getByTestId("control-result")).toContainText("Total: sheet KES 9000.00, file KES 8,350.00");
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
  await expect(page.getByTestId("process-blocked")).toContainText("does not match its control sheet");

  await page.getByLabel("Control sheet").setInputFiles(file("broken.control.json", "{not json", "application/json"));
  await expect(page.getByTestId("control-sheet").getByRole("alert")).toContainText("isn't valid JSON");
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
});

test("a second operator opens the submitted run, releases it, and sees held lines and the run-only reconciliation", async ({ page }) => {
  await signInAs(page, "brian@baracel.ae", "Brian Checker");
  const sent = await stubOmni(page, {
    recent: [run({ submittedBy: ME })],
    polls: [run({ submittedBy: ME }), run({ status: "RUNNING", releasedBy: OTHER, releasedAt: "2026-11-06T08:05:00Z", processedCount: 1 }), completed()],
    reconciliation: reconciled,
  });
  await page.goto("/bulk/payments");
  const row = page.getByRole("row").filter({ hasText: CONTROL.file });
  await expect(row).toContainText("Awaiting release");
  await expect(row).toContainText("amina@baracel.ae / —");
  await row.click();

  const approval = page.getByTestId("run-approval");
  const release = approval.getByRole("button", { name: "Release" });
  await expect(release).toBeEnabled();
  await expect(approval.getByTestId("release-blocked")).toHaveCount(0);
  await release.click();

  await expect(page.getByTestId("run-progress")).toContainText("Completed");
  await expect(approval.getByTestId("approval-released")).toContainText("brian@baracel.ae");
  const panel = page.getByTestId("recon-panel");
  await expect(panel).toContainText("Matches the expected total");
  await expect(panel).toContainText("Line count matches");
  await expect(panel).toContainText("Posted by this run");
  await expect(panel).toContainText("3 of 3 expected");
  await expect(panel).toContainText("7 · KES 3,850.00");
  const held = page.getByTestId("run-exceptions");
  await expect(held).toContainText("Held by omnichannel");
  await expect(held).toContainText("Grower number not in the farmer register");
  await expect(held).toContainText("Showing 2 of 7");

  const rel = sent.find((s) => s.method === "POST" && s.path === `/${RUN}/release`)!;
  expect(rel.subject).toBe(OTHER);
  // Omnichannel's own expected total (it holds register lines too) is what is reconciled against.
  expect(sent.find((s) => s.path === `/${RUN}/reconciliation`)!.query.get("expectedTotal")).toBe("4500.00");
});

test("omnichannel's refusal of a release (same operator) is shown as it comes", async ({ page }) => {
  await signInAs(page, "brian@baracel.ae", "Brian Checker");
  const refused = "The operator who submitted a run cannot release it";
  await stubOmni(page, { recent: [run({ submittedBy: "staff:someone@baracel.ae" })], polls: [run({ submittedBy: "staff:someone@baracel.ae" })], release: { status: 409, body: envelope(409, refused) } });
  await page.goto("/bulk/payments");
  await page.getByRole("row").filter({ hasText: CONTROL.file }).click();
  await page.getByTestId("run-approval").getByRole("button", { name: "Release" }).click();
  await expect(page.getByTestId("release-error")).toHaveText(refused);
  await expect(page.getByTestId("run-approval").getByRole("button", { name: "Release" })).toBeEnabled();
});

test("a run submitted under the proxy's shared identity says why it cannot be released", async ({ page }) => {
  await signInAs(page, "brian@baracel.ae", "Brian Checker");
  await stubOmni(page, { recent: [run({ submittedBy: "ktda-operator" })], polls: [run({ submittedBy: "ktda-operator" })] });
  await page.goto("/bulk/payments");
  await page.getByRole("row").filter({ hasText: CONTROL.file }).click();
  await expect(page.getByTestId("run-approval")).toContainText("Submitted under a shared identity");
});

test("the same file twice: omnichannel's 409 names the earlier run, which opens from the message", async ({ page }) => {
  const message = `This file was already loaded as run ${EARLIER}`;
  const earlier = run({ runId: EARLIER, status: "COMPLETED", completedAt: "2026-11-05T09:00:00Z", startedAt: "2026-11-05T09:00:00Z" });
  await stubOmni(page, { upload: { status: 409, body: envelope(409, message) }, recent: [earlier] });
  await page.route(new RegExp(`/bulk-loads/${EARLIER}(/reconciliation)?(\\?.*)?$`), (route) =>
    json(route, new URL(route.request().url()).pathname.endsWith("/reconciliation") ? { ...reconciled, runId: EARLIER } : earlier));
  await page.goto("/bulk/payments");
  await page.getByLabel("CSV file").setInputFiles(file(CONTROL.file, SAP_CSV));
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByTestId("upload-error")).toContainText(message);
  await page.getByRole("button", { name: "Open the earlier run" }).click();
  await expect(page.getByText(`Run ${EARLIER}`)).toBeVisible();
  await expect(page.getByTestId("recon-panel")).toBeVisible();
});

test("an omnichannel without the SAP adapter: the SAP file is stored but never started", async ({ page }) => {
  const legacy = { runId: RUN, flow: "PAYMENT", institutionId: KTDA, currency: "KES", sourceName: CONTROL.file, status: "RUNNING", totalRows: 10, processedCount: 0, skippedCount: 0, failureCount: 0, totalAmount: 0, startedAt: "2026-11-06T08:00:00Z", completedAt: null, message: null };
  const sent = await stubOmni(page, { upload: { status: 202, body: legacy } });
  await page.goto("/bulk/payments");
  await page.getByLabel("CSV file").setInputFiles(file(CONTROL.file, SAP_CSV));
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByTestId("sap-not-taken")).toContainText("does not take the SAP export yet");
  await expect(page.getByRole("button", { name: "Start another" })).toBeVisible();
  expect(sent.some((s) => s.path.endsWith("/process"))).toBe(false);
  await expect(page.getByTestId("run-approval")).toHaveCount(0);
});

test("a file that is neither payment format is refused before upload", async ({ page }) => {
  const sent = await stubOmni(page);
  await page.goto("/bulk/payments");
  await page.getByLabel("CSV file").setInputFiles(file("x.csv", "a,b,c\n1,2,3\n"));
  await expect(page.getByTestId("file-summary")).toContainText("This isn't a payment file.");
  await expect(page.getByTestId("file-summary")).toContainText("grower_no,amount_kes,payment_ref");
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
  expect(sent.some((s) => s.method === "POST")).toBe(false);
});

test("accounting file: the expected total leaves out the rows that will be refused", async ({ page }) => {
  const legacy = { runId: RUN, flow: "PAYMENT", institutionId: KTDA, currency: "KES", sourceName: "p.csv", status: "RUNNING", totalRows: 4, processedCount: 0, skippedCount: 0, failureCount: 0, totalAmount: 0, startedAt: "2026-11-06T08:00:00Z", completedAt: null, message: null };
  const sent = await stubOmni(page, {
    upload: { status: 202, body: legacy },
    process: legacy,
    polls: [{ ...legacy, status: "PARTIAL", processedCount: 1, failureCount: 3, totalAmount: 1500.5, completedAt: "2026-11-06T08:00:02Z", message: "3 rows failed" }],
    reconciliation: { ...reconciled, runPostedTotal: undefined, runPostedCount: undefined, expectedCount: undefined, matchesExpectedCount: undefined, heldCount: undefined, heldTotal: undefined, creditedTotal: 1500.5, expectedTotal: 1500.5, matchesExpected: true },
  });
  await page.goto("/bulk/payments");
  const csv = "grower_no,amount_kes,payment_ref\nKTDA1,1500.50,R1\nKTDA2,2000000,R2\nKTDA3,10.00,R1\nKTDA4,0,R4\n";
  await page.getByLabel("CSV file").setInputFiles(file("p.csv", csv));
  await expect(page.getByTestId("file-summary")).toContainText("4 rows, total KES 2,001,510.50");
  await expect(page.getByTestId("file-expected")).toHaveText("KES 1,500.50");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByTestId("recon-panel")).toContainText("Matches the expected total");
  // Old omnichannel: no approval, the run starts on Process as it always has.
  expect(sent.some((s) => s.path === `/${RUN}/process`)).toBe(true);
  expect(sent.find((s) => s.path === `/${RUN}/reconciliation`)!.query.get("expectedTotal")).toBe("1500.50");
});

test("registration: rows refused as CLASH are listed with their reason", async ({ page }) => {
  const reg = { runId: RUN, flow: "REGISTRATION", institutionId: KTDA, currency: "KES", sourceName: "register.csv", status: "PARTIAL", totalRows: 3, processedCount: 2, skippedCount: 0, failureCount: 1, totalAmount: 0, startedAt: "2026-11-06T08:00:00Z", completedAt: "2026-11-06T08:00:02Z", message: "1 row clashed", clashCount: 1, heldLines: [{ lineNo: 3, growerNo: "KG-000003", phone: "+254700000001", code: "CLASH", reason: "Phone +254700000001 is already registered to KG-000001" }] };
  await stubOmni(page, { recent: [reg], polls: [reg] });
  await page.goto("/journey/register");
  await page.getByRole("row").filter({ hasText: "register.csv" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("Clashes");
  const list = page.getByTestId("run-exceptions");
  await expect(list).toContainText("Not registered");
  await expect(list).toContainText("Clash: Phone +254700000001 is already registered to KG-000001");
  const download = page.waitForEvent("download");
  await list.getByRole("button", { name: /Download/ }).click();
  expect((await download).suggestedFilename()).toBe("register.clashes.csv");
});
