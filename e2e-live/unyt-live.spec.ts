import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/* Baracel Unyt on a deployed BO Admin, read only (see playwright.live.config.ts).
 * Signs in once through the form, then opens every /token-console page and
 * checks it is live and healthy: its heading, no "Demo data" badge, no error
 * panel, no failed call to the engine or omnichannel, no uncaught error. Then
 * Loans and Funds in a little more detail. Nothing is written: every non-GET
 * call other than the sign-in itself is aborted and fails the run. */

const BASE = process.env.BO_URL;
const EMAIL = process.env.BO_ADMIN_EMAIL;
const PASS = process.env.BO_ADMIN_PASS;

test.skip(!BASE || !EMAIL || !PASS, "Set BO_URL, BO_ADMIN_EMAIL and BO_ADMIN_PASS to run the live Unyt check.");
test.describe.configure({ mode: "serial" });

const ROUTES: [path: string, heading: string][] = [
  ["overview", "Overview"], ["investors", "Investors"], ["accounts", "Accounts"], ["offerings", "Offerings"], ["products", "Products"],
  ["market", "Market"], ["prices", "Bond prices"], ["fx", "FX rates"], ["journals", "Journals"], ["trial-balance", "Trial balance"],
  ["unit-ledger", "Unit ledger"], ["reconciliation", "Reconciliation"], ["runs", "Batch runs"], ["policies", "Accrual & distribution policies"],
  ["compliance", "Review queue"], ["changes", "Change approvals"], ["funds", "Funds"], ["tariffs", "Tariffs"], ["configuration", "Configuration"],
  ["loans", "Loans"], ["kyc", "KYC desk"], ["customers", "Customer desk"], ["customer-approvals", "Customer approvals"],
  ["transactions", "Transactions"], ["users", "Tokenization users"], ["nav", "NAV"], ["assets", "Assets"],
];

const SIGN_IN = /\/tok\/auth\/login$/;
const ERROR_PANEL = /Could not load|Something went wrong|Part of this page could not be loaded/;

let context: BrowserContext;
let page: Page;
const blocked: string[] = [];
let failed: string[] = [];
let uncaught: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, baseURL: BASE });
  page = await context.newPage();
  // Read only: let GETs and the sign-in through, stop anything else before it leaves.
  await page.route(/\/(tok|omni)\//, (route) => {
    const req = route.request();
    if (req.method() === "GET" || req.method() === "HEAD" || (req.method() === "POST" && SIGN_IN.test(new URL(req.url()).pathname))) return route.fallback();
    blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
    return route.abort("blockedbyclient");
  });
  page.on("response", (r) => {
    if (/\/(tok|omni)\//.test(r.url()) && r.status() >= 400 && !SIGN_IN.test(new URL(r.url()).pathname)) {
      failed.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    }
  });
  page.on("pageerror", (e) => uncaught.push(e.message));

  await page.goto("/login");
  await page.locator('input[type="email"]').first().fill(EMAIL!);
  await page.locator('input[type="password"]').first().fill(PASS!);
  await page.getByRole("button", { name: "Sign in" }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
});

test.afterAll(async () => {
  await context?.close();
});

test.beforeEach(() => {
  failed = [];
  uncaught = [];
});

test.afterEach(() => {
  expect(blocked, "a page tried to write").toEqual([]);
});

async function visit(path: string, heading: string) {
  await page.goto(`/token-console/${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  await expect(page.getByRole("heading", { name: heading, level: 1, exact: true })).toBeVisible();
  // Let late reads settle (pickers, second-page reads).
  await page.waitForLoadState("networkidle");
}

for (const [path, heading] of ROUTES) {
  test(`${path} is live and healthy`, async () => {
    await visit(path, heading);
    await test.info().attach(`${path}.png`, { body: await page.screenshot(), contentType: "image/png" });
    await expect(page.getByText("Demo data")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(ERROR_PANEL);
    expect(failed, "failed calls").toEqual([]);
    expect(uncaught, "uncaught errors").toEqual([]);
  });
}

test("loans: the engine's loan endpoints are deployed, and a loan opens", async () => {
  await visit("loans", "Loans");
  await expect(page.locator("main")).not.toContainText("predates the loan endpoints");
  const rows = page.locator("main tbody tr");
  if (await rows.count()) {
    await rows.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(dialog).not.toContainText("Not available yet");
    await expect(dialog).not.toContainText(ERROR_PANEL);
  }
  expect(failed).toEqual([]);
});

test("funds: no sample ladder, and no sample bonds", async () => {
  await visit("funds", "Funds");
  const subFunds = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sub-funds" }) }).locator("tbody tr");
  if (await subFunds.count()) {
    await subFunds.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  await expect(page.getByText(/sample ladder/i)).toHaveCount(0);
  // The ISINs the removed sample ladder used.
  await expect(page.locator("body")).not.toContainText(/KE10000123(4[5-9]|50)/);
  expect(failed).toEqual([]);
});
