import { expect, test, type Page } from "@playwright/test";
import { envelope, json, signIn } from "./stubs";

/* Admin > Institution: this back office's institution, read-only, from
 * omnichannel's scoped reads (GET /institutions, GET /institution/settings),
 * stubbed. */

const KTDA = "11111111-1111-4111-8111-111111111111";

async function stub(page: Page, opts: {
  own?: { status: number; body: unknown };
  settings?: { status: number; body: unknown };
}) {
  const writes: string[] = [];
  await page.route(/\/tok\/accounting\/institutions$/, (route) => json(route, [{ institutionId: KTDA, name: "KTDA Holdings", localCurrency: "KES" }]));
  await page.route(/\/omni\/api\/operator\/institutions$/, (route) => {
    const out = opts.own ?? { status: 200, body: [{ id: KTDA, name: "KTDA Holdings", localCurrency: "KES", country: "KE", status: "ACTIVE" }] };
    return json(route, out.body, out.status);
  });
  await page.route(/\/omni\/api\/operator\/institution\/settings$/, (route) => {
    if (route.request().method() !== "GET") writes.push(route.request().method());
    const out = opts.settings ?? { status: 200, body: { institutionId: KTDA, features: ["TRANSFERS", "WITHDRAWALS", "TOP_UPS"], set: {} } };
    return json(route, out.body, out.status);
  });
  return writes;
}

const feature = (page: Page, f: string) => page.getByTestId("institution-features").locator(`[data-feature="${f}"]`);

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("shows who the institution is, what its customers can use, and what it sets over the defaults", async ({ page }) => {
  const writes = await stub(page, {
    settings: {
      status: 200,
      body: {
        institutionId: KTDA,
        features: ["TRANSFERS", "WITHDRAWALS", "TOP_UPS"],
        set: {
          "sms.sender": "TEAPAY",
          "withdrawals.kes.per-day": "150000",
          "withdrawals.kes.per-transaction": "none",
          "transfers.kes.min": "10",
          "payments.funding.kes.bank-name": "Sample Bank",
          "payments.funding.kes.account-number": "0123456789",
          "something.new": "42",
        },
      },
    },
  });
  await page.goto("/institution");
  await expect(page.getByRole("heading", { name: "Institution", level: 1 })).toBeVisible();

  const who = page.getByTestId("institution-identity");
  await expect(who).toContainText("KTDA Holdings");
  await expect(who).toContainText(KTDA);
  await expect(who).toContainText("KES");

  for (const f of ["TRANSFERS", "WITHDRAWALS", "TOP_UPS"]) await expect(feature(page, f)).toHaveAttribute("data-on", "true");
  for (const f of ["INVESTING", "FX"]) await expect(feature(page, f)).toHaveAttribute("data-on", "false");
  await expect(feature(page, "FX")).toContainText("Currency exchange: not offered");

  const set = page.getByTestId("institution-settings");
  await expect(set).toContainText("SMS sender name");
  await expect(set).toContainText("TEAPAY");
  await expect(set).toContainText("Most per day (KES)");
  await expect(set).toContainText("KES 150,000");
  await expect(set.locator("div", { hasText: /^Most per withdrawal \(KES\)No limit$/ })).toHaveCount(1);
  await expect(set).toContainText("Smallest transfer (KES)");
  await expect(set).toContainText("Bank (KES)");
  await expect(set).toContainText("Sample Bank");
  await expect(set).toContainText("something.new");
  await expect(set).toContainText("Anything not listed follows the platform defaults.");

  // Read-only: nothing to change, and nothing was written.
  await expect(page.locator("main").getByRole("button", { name: /edit|save|change/i })).toHaveCount(0);
  expect(writes).toEqual([]);
  // A live page: no demo badge, no demo footer.
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("demo-footer")).toHaveCount(0);
});

test("an institution that sets nothing says so, and one omnichannel has not named takes the engine's name", async ({ page }) => {
  await stub(page, { own: { status: 200, body: [{ id: KTDA, name: null, localCurrency: null, country: null, status: null }] } });
  await page.goto("/institution");
  await expect(page.getByTestId("institution-identity")).toContainText("KTDA Holdings");
  await expect(page.getByTestId("institution-settings")).toContainText("This institution sets nothing of its own.");
});

test("no institution configured: omnichannel's 403 is explained", async ({ page }) => {
  const refused = { status: 403, body: envelope(403, "No institution on this request", "OPERATOR_INSTITUTION_REQUIRED") };
  await stub(page, { own: refused, settings: refused });
  await page.goto("/institution");
  await expect(page.getByTestId("institution-identity")).toContainText("This back office has no institution configured");
  await expect(page.getByTestId("institution-features")).toContainText("This back office has no institution configured");
});

test("Institution is in the Admin menu", async ({ page }) => {
  await stub(page, {});
  await page.goto("/");
  const menu = page.locator("aside").first();
  await menu.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(menu.getByRole("link", { name: "Institution", exact: true })).toHaveAttribute("href", "/institution");
});
