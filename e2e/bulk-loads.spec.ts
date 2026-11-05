import { expect, test, type Page } from "@playwright/test";
import { envelope, json, signIn } from "./stubs";

/* Bulk onboarding and bulk payment (KTDA): omnichannel's operator bulk-loads
 * API, stubbed. A run is uploaded, started with Process, polled while
 * RUNNING, and its reconciliation read once it ends. */

const KTDA = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const RUN = "33333333-3333-4333-8333-333333333333";
const R = /\/omni\/api\/operator\/bulk-loads/;

const ONBOARDING_CSV = "grower_no,national_id,full_name,msisdn\nKTDA000001,12345678,Farmer One,254700000001\nKTDA000002,12345679,Farmer Two,254700000002\nKTDA000003,12345680,Farmer Three,254700000003\n";
const PAYMENT_CSV = "grower_no,amount_kes,payment_ref\nKTDA000001,1500.50,GL-2026-11-0001\nKTDA000002,2499.50,GL-2026-11-0002\n";

type Run = Record<string, unknown>;

const run = (over: Run = {}): Run => ({
  runId: RUN, flow: "ONBOARDING", institutionId: KTDA, currency: "KES", sourceName: "farmers.csv",
  status: "RUNNING", totalRows: 3, processedCount: 0, skippedCount: 0, failureCount: 0, totalAmount: 0,
  startedAt: "2026-11-05T08:00:00Z", completedAt: null, message: null, ...over,
});

const recon = (over: Run = {}): Run => ({
  runId: RUN, flow: "ONBOARDING", institutionId: KTDA, institutionName: "KTDA Holdings", status: "COMPLETED",
  walletCount: 3, processedCount: 3, skippedCount: 0, failureCount: 0, creditedTotal: 0,
  depositDebitTotal: 0, depositCreditTotal: 0, doubleEntryBalanced: true, expectedTotal: null, matchesExpected: null, ...over,
});

type Sent = { method: string; path: string; query: URLSearchParams; contentType?: string; body: string | null };

/** Answers the bulk-loads calls. `polls` are the run as each GET of it
 *  returns, the last one repeating. */
async function stubBulk(page: Page, opts: {
  onboarded?: boolean | ((institutionId: string) => boolean);
  upload?: { status: number; body: unknown };
  polls?: Run[];
  reconciliation?: Run;
  recent?: Run[];
}) {
  const sent: Sent[] = [];
  let poll = 0;
  await page.route(/\/tok\/accounting\/institutions$/, (route) => json(route, [
    { institutionId: OTHER, name: "Investcent Kenya", localCurrency: "KES" },
    { institutionId: KTDA, name: "KTDA Holdings", localCurrency: "KES" },
  ]));
  await page.route(R, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/omni\/api\/operator\/bulk-loads/, "");
    sent.push({ method: req.method(), path, query: url.searchParams, contentType: req.headers()["content-type"], body: req.postData() });
    if (req.method() === "POST" && path === "/upload") {
      const out = opts.upload ?? { status: 202, body: opts.polls?.[0] ?? run() };
      return json(route, out.body, out.status);
    }
    if (req.method() === "POST" && path === `/${RUN}/process`) return json(route, opts.polls?.[0] ?? run());
    if (path === "/onboarding-status") {
      const id = url.searchParams.get("institutionId") ?? "";
      const done = typeof opts.onboarded === "function" ? opts.onboarded(id) : !!opts.onboarded;
      return json(route, { onboardingCompleted: done });
    }
    if (path === "") return json(route, opts.recent ?? []);
    if (path === `/${RUN}`) {
      const polls = opts.polls ?? [run()];
      const r = polls[Math.min(poll, polls.length - 1)];
      poll++;
      return json(route, r);
    }
    if (path === `/${RUN}/reconciliation`) return json(route, opts.reconciliation ?? recon());
    return json(route, { message: "Not stubbed" }, 404);
  });
  return sent;
}

const csv = (name: string, text: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(text) });

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("onboarding: picks KTDA, uploads, processes, polls to COMPLETED and shows the reconciliation", async ({ page }) => {
  const sent = await stubBulk(page, {
    polls: [
      run(),
      run({ processedCount: 1 }),
      run({ status: "COMPLETED", processedCount: 3, completedAt: "2026-11-05T08:00:04Z" }),
    ],
  });
  await page.goto("/bulk/onboarding");
  await expect(page.getByRole("heading", { name: "Bulk onboarding" })).toBeVisible();
  await expect(page.getByLabel("Institution")).toHaveValue(KTDA);

  const process = page.getByRole("button", { name: "Process" });
  await expect(process).toBeDisabled();
  await page.getByLabel("CSV file").setInputFiles(csv("farmers.csv", ONBOARDING_CSV));
  await expect(page.getByTestId("file-summary")).toContainText("farmers.csv: 3 rows");
  await process.click();

  await expect(page.getByTestId("run-progress")).toContainText("Completed");
  await expect(page.getByText("Every row was applied")).toBeVisible();
  const panel = page.getByTestId("recon-panel");
  await expect(panel).toContainText("Double entry balanced");
  await expect(panel).toContainText("KTDA Holdings");
  await expect(panel).toContainText("Wallets held");

  const upload = sent.find((s) => s.method === "POST" && s.path === "/upload")!;
  expect(upload.contentType).toMatch(/^multipart\/form-data; boundary=/);
  expect(upload.body).toContain('name="flow"\r\n\r\nONBOARDING');
  expect(upload.body).toContain(`name="institutionId"\r\n\r\n${KTDA}`);
  expect(upload.body).toContain('name="currency"\r\n\r\nKES');
  expect(upload.body).toContain('filename="farmers.csv"');
  expect(sent.some((s) => s.method === "POST" && s.path === `/${RUN}/process`)).toBe(true);
  expect(sent.filter((s) => s.method === "GET" && s.path === `/${RUN}`).length).toBeGreaterThanOrEqual(2);
  // Read once, after the run ended; no expected total for an onboarding file.
  const recons = sent.filter((s) => s.path === `/${RUN}/reconciliation`);
  expect(recons).toHaveLength(1);
  expect(recons[0].query.has("expectedTotal")).toBe(false);
});

test("a file with the wrong header is stopped before upload", async ({ page }) => {
  const sent = await stubBulk(page, {});
  await page.goto("/bulk/onboarding");
  await page.getByLabel("CSV file").setInputFiles(csv("payments.csv", PAYMENT_CSV));
  await expect(page.getByTestId("file-summary")).toContainText("Missing: national_id, full_name, msisdn");
  await expect(page.getByRole("button", { name: "Process" })).toBeDisabled();
  expect(sent.some((s) => s.method === "POST")).toBe(false);
});

test("payments stay closed until onboarding has completed for the institution", async ({ page }) => {
  await stubBulk(page, { onboarded: (id) => id === OTHER });
  await page.goto("/bulk/payments");
  await expect(page.getByLabel("Institution")).toHaveValue(KTDA);
  await expect(page.getByText("Payments are closed")).toBeVisible();
  await expect(page.getByLabel("CSV file")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Process" })).toBeDisabled();

  await page.getByLabel("Institution").selectOption(OTHER);
  await expect(page.getByText("Onboarding has completed. Payments are open.")).toBeVisible();
  await expect(page.getByLabel("CSV file")).toBeEnabled();
});

test("payment: a PARTIAL run shows its message in amber and checks the file total", async ({ page }) => {
  const message = "1 of 2 rows failed. grower KTDA000002: no KES wallet, onboard first";
  const partial = run({
    flow: "PAYMENT", sourceName: "payments.csv", totalRows: 2, status: "PARTIAL", processedCount: 1, failureCount: 1,
    totalAmount: 1500.5, completedAt: "2026-11-05T08:00:02Z", message,
  });
  const sent = await stubBulk(page, {
    onboarded: true,
    polls: [run({ flow: "PAYMENT", sourceName: "payments.csv", totalRows: 2 }), partial],
    reconciliation: recon({
      flow: "PAYMENT", status: "PARTIAL", walletCount: 3, processedCount: 1, failureCount: 1, creditedTotal: 1500.5,
      depositDebitTotal: 1500.5, depositCreditTotal: 1500.5, expectedTotal: 4000, matchesExpected: false,
    }),
  });
  await page.goto("/bulk/payments");
  await expect(page.getByText("Onboarding has completed. Payments are open.")).toBeVisible();
  await page.getByLabel("CSV file").setInputFiles(csv("payments.csv", PAYMENT_CSV));
  await expect(page.getByTestId("file-summary")).toContainText("2 rows, total KES 4,000.00");
  await page.getByRole("button", { name: "Process" }).click();

  await expect(page.getByText("Partly completed: some rows failed")).toBeVisible();
  await expect(page.getByTestId("run-message")).toHaveText(message);
  await expect(page.getByTestId("run-progress").locator('[data-tone="warning"]')).toHaveText("Partial");
  const panel = page.getByTestId("recon-panel");
  await expect(panel).toContainText("Does not match the file total");
  await expect(panel).toContainText("KES 1,500.50");

  const upload = sent.find((s) => s.method === "POST" && s.path === "/upload")!;
  expect(upload.body).toContain('name="flow"\r\n\r\nPAYMENT');
  const reconCall = sent.find((s) => s.path === `/${RUN}/reconciliation`)!;
  expect(reconCall.query.get("expectedTotal")).toBe("4000.00");
});

test("payment: a 409 on upload is shown as omnichannel sent it and nothing is started", async ({ page }) => {
  const refused = "onboard this institution's customers before loading payments";
  const sent = await stubBulk(page, { onboarded: true, upload: { status: 409, body: envelope(409, refused) } });
  await page.goto("/bulk/payments");
  await page.getByLabel("CSV file").setInputFiles(csv("payments.csv", PAYMENT_CSV));
  await page.getByRole("button", { name: "Process" }).click();
  await expect(page.getByRole("alert").filter({ hasText: refused })).toBeVisible();
  expect(sent.some((s) => s.path.endsWith("/process"))).toBe(false);
  await expect(page.getByTestId("run-progress")).toHaveCount(0);
});

test("a FAILED run is red with its message, and a past run can be reopened from the history", async ({ page }) => {
  const failed = run({ status: "FAILED", completedAt: "2026-11-05T08:01:00Z", message: "could not reach the accounting service" });
  await stubBulk(page, { polls: [failed], recent: [failed], reconciliation: recon({ status: "FAILED", walletCount: 0, processedCount: 0 }) });
  await page.goto("/bulk/onboarding");
  await page.getByRole("row").filter({ hasText: "farmers.csv" }).click();
  await expect(page.getByText("Failed", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("run-message")).toHaveText("could not reach the accounting service");
  await expect(page.getByTestId("recon-panel")).toBeVisible();
});
