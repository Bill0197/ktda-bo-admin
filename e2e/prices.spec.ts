import { expect, test, type Page } from "@playwright/test";
import { ME, json, signIn, stubOfferings } from "./stubs";

/* Bond prices: the live buy/sell price of each bond and the desk's proposal of
   a new one (BOND_PRICE_SET), staged for a second person. */

const TERMS = [
  { productId: "BOND-A", isin: "KE1000000IFB1", faceValue: 100, couponRate: 0.14, anchorYield: null, anchorSetAt: null, quoteSpread: null },
  { productId: "BOND-B", isin: "KE1000000FXD1", faceValue: 100, couponRate: 0.12, anchorYield: 0.12, anchorSetAt: "2026-10-26T08:00:00Z", quoteSpread: 0.01 },
];
const QUOTES = [
  { offeringId: "OF-A", bid: 103.2, offer: 104.8, yield: 0.1187, accruedInterest: 3.99, currency: "KES", asOf: "2026-10-27T08:00:00Z", status: "FRESH" },
  { offeringId: "OF-B", bid: 99.5, offer: 100.5, yield: 0.12, accruedInterest: 1.2, currency: "KES", asOf: "2026-10-27T08:00:00Z", status: "FRESH" },
];

type Staged = { type: string; payload: Record<string, unknown> };

async function stubPrices(page: Page, pending: Record<string, unknown>[] = []) {
  const staged: Staged[] = [];
  await page.route(/\/tok\/accounting\/bond-terms$/, (route) => json(route, TERMS));
  await page.route(/\/tok\/accounting\/quotes$/, (route) => json(route, QUOTES));
  await page.route(/\/tok\/accounting\/config\/changes(\?.*)?$/, (route) => {
    const req = route.request();
    if (req.method() === "GET") return json(route, pending);
    const body = req.postDataJSON() as Staged;
    staged.push(body);
    return json(route, { requestId: "c-1", changeType: body.type, payload: body.payload, status: "PENDING", maker: "amina@baracel.ae" }, 202);
  });
  return staged;
}

async function open(page: Page) {
  await page.goto("/token-console/prices");
  await expect(page.getByRole("heading", { name: "Bond prices" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await stubOfferings(page);
});

test("each open bond shows what investors buy and sell at, with its spread", async ({ page }) => {
  await stubPrices(page);
  await open(page);
  const row = page.getByRole("row", { name: /IFB1\/2023\/17/ });
  await expect(row).toContainText("KES 104.80");
  await expect(row).toContainText("KES 103.20");
  await expect(row).toContainText("1.54%");
  await expect(page.getByRole("row", { name: /FXD1\/2024\/10/ })).toContainText("Set");
});

test("a new price is proposed for a second person, with the buy and sell it will give", async ({ page }) => {
  const staged = await stubPrices(page);
  await open(page);
  await page.getByRole("button", { name: "Set the price of IFB1/2023/17" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Mid price per unit/).fill("102.5");
  await dialog.getByLabel("Spread (%)").fill("1");
  await expect(dialog).toContainText("KES 103.0125");
  await expect(dialog).toContainText("KES 101.9875");
  await dialog.getByRole("button", { name: "Send for approval" }).click();
  await expect(page.getByText(/Sent for approval/)).toBeVisible();
  expect(staged).toEqual([{ type: "BOND_PRICE_SET", payload: { productId: "BOND-A", midPrice: 102.5, quoteSpread: 0.01 } }]);
});

test("a spread over 10% cannot be sent", async ({ page }) => {
  const staged = await stubPrices(page);
  await open(page);
  await page.getByRole("button", { name: "Set the price of IFB1/2023/17" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Spread (%)").fill("12");
  await expect(dialog.getByRole("button", { name: "Send for approval" })).toBeDisabled();
  await expect(dialog).toContainText("Enter a spread between 0% and 10%.");
  expect(staged).toHaveLength(0);
});

test("a bond with a price awaiting approval cannot be given another", async ({ page }) => {
  await stubPrices(page, [{ requestId: "c-9", changeType: "BOND_PRICE_SET", payload: { productId: "BOND-A", midPrice: 101, quoteSpread: 0.01 }, status: "PENDING", maker: ME }]);
  await open(page);
  await expect(page.getByRole("row", { name: /IFB1\/2023\/17/ })).toContainText("Awaiting approval");
  await expect(page.getByRole("button", { name: "Set the price of IFB1/2023/17" })).toBeDisabled();
  await expect(page.getByText("Waiting for a second person")).toBeVisible();
});
