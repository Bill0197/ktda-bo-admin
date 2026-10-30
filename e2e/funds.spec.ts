import { expect, test, type Page } from "@playwright/test";
import { json } from "./stubs";
import { IDS, pick, sentFrom, stubUnyt, type Sent } from "./unyt-fixtures";
import type { BondLadderView, TariffDomain } from "../src/lib/tokenConsole/types.gen";

/* Funds: a sub-fund's bond ladder is built from real rungs only — the sample
 * ladder the console once offered is gone (package A) — and an institution's
 * default tariff domain goes through Change approvals. */

const RUNG = { ladderSlot: 1, isin: "KE7000001234", tenorYears: 5, couponRate: 0.1375, couponMonths: "06,12", faceValueHeld: 20_000_000, maturityDate: "2030-06-15" };

type Book = { ladder: BondLadderView; sent: Sent[]; reads: number };

async function stubLadder(page: Page, book: Book) {
  await stubUnyt(page, "data");
  await page.route(new RegExp(`/tok/accounting/sub-funds/${IDS.subFund}/ladder$`), (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      book.reads++;
      return json(route, book.ladder);
    }
    const s = sentFrom(route);
    book.sent.push(s);
    if (req.method() === "DELETE") {
      book.ladder = { ...book.ladder, rungs: [], capacity: 0, blendedCoupon: 0, couponMonths: [] };
      return route.fulfill({ status: 204 });
    }
    const rung = s.body as typeof RUNG;
    book.ladder = { ...book.ladder, rungs: [...(book.ladder.rungs ?? []), rung] };
    return json(route, { ...rung, bondId: "B-2", subFundId: IDS.subFund }, 201);
  });
}

const ladder = (rungs = [RUNG]): BondLadderView => ({
  subFundId: IDS.subFund, subFundName: "BRF KES sub-fund", currency: "KES", blendedCoupon: 0.1375, capacity: 20_000_000, claims: 250000,
  headroom: 19_750_000, utilization: 0.0125, everyMonthCovered: false, couponMonths: [6, 12], rungs,
});

async function openLadder(page: Page) {
  await page.goto("/token-console/funds");
  await expect(page.getByRole("heading", { name: "Funds", level: 1 })).toBeVisible();
  const subFunds = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sub-funds" }) });
  await subFunds.getByRole("row").filter({ hasText: "BRF KES sub-fund" }).click();
  const dialog = page.getByRole("dialog", { name: "Bond ladder · BRF KES sub-fund" });
  await expect(dialog).toContainText("KE7000001234");
  return dialog;
}

test("no sample ladder: the page and the ladder offer only real rungs", async ({ page }) => {
  const book: Book = { ladder: ladder(), sent: [], reads: 0 };
  await stubLadder(page, book);
  const dialog = await openLadder(page);
  await expect(page.getByText(/sample/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /sample/i })).toHaveCount(0);
  const buttons = (await dialog.getByRole("button").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  expect(buttons).toEqual(expect.arrayContaining(["Add rung", "Clear ladder"]));
  expect(buttons.filter((b) => !["Add rung", "Clear ladder"].includes(b) && !/close/i.test(b))).toEqual([]);
  expect(book.sent).toEqual([]);
});

test("an empty ladder says to add the bonds the sub-fund holds, and cannot be cleared", async ({ page }) => {
  const book: Book = { ladder: ladder([]), sent: [], reads: 0 };
  await stubLadder(page, book);
  await page.goto("/token-console/funds");
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Sub-funds" }) }).getByRole("row").filter({ hasText: "BRF KES sub-fund" }).click();
  const dialog = page.getByRole("dialog", { name: "Bond ladder · BRF KES sub-fund" });
  await expect(dialog).toContainText("No rungs yet — add the bonds this sub-fund holds");
  await expect(dialog.getByRole("button", { name: "Clear ladder" })).toBeDisabled();
});

test("a rung is sent exactly as typed, then the ladder and the summary are read again", async ({ page }) => {
  const book: Book = { ladder: ladder(), sent: [], reads: 0 };
  await stubLadder(page, book);
  const dialog = await openLadder(page);
  await dialog.getByRole("button", { name: "Add rung" }).click();

  const form = page.getByRole("dialog", { name: "Add a rung" });
  await expect(form.getByLabel(/^Slot/)).toHaveValue("2");
  await form.getByLabel(/^ISIN/).fill("KE7000005678");
  await form.getByLabel(/^Tenor/).fill("7");
  await form.getByLabel(/^Coupon rate/).fill("10.85");
  await expect(form).toContainText("Coupon is a fraction: 0.1085 means 10.85%.");
  await expect(form.getByRole("button", { name: "Add rung" })).toBeDisabled();
  await form.getByLabel(/^Coupon rate/).fill("0.1085");
  await form.getByLabel(/^Coupon months/).fill("01, 07");
  await form.getByLabel(/^Face value held/).fill("5000000");
  const readsBefore = book.reads;
  await form.getByRole("button", { name: "Add rung" }).click();
  await expect(page.getByText("Rung added.")).toBeVisible();

  expect(book.sent).toHaveLength(1);
  expect(book.sent[0]).toMatchObject({ method: "POST", path: `/accounting/sub-funds/${IDS.subFund}/ladder` });
  expect(book.sent[0].body).toEqual({ ladderSlot: 2, isin: "KE7000005678", tenorYears: 7, couponRate: 0.1085, couponMonths: "01,07", faceValueHeld: 5000000 });
  await expect(dialog).toContainText("KE7000005678");
  expect(book.reads).toBeGreaterThan(readsBefore);
});

test("clearing asks first, then removes every rung", async ({ page }) => {
  const book: Book = { ladder: ladder(), sent: [], reads: 0 };
  await stubLadder(page, book);
  const dialog = await openLadder(page);
  await dialog.getByRole("button", { name: "Clear ladder" }).click();
  const confirm = page.getByRole("dialog", { name: "Clear this ladder?" });
  await expect(confirm).toContainText("Removes every rung");
  expect(book.sent).toEqual([]);
  await confirm.getByRole("button", { name: "Clear ladder" }).click();
  await expect(page.getByText("Ladder cleared.")).toBeVisible();
  expect(book.sent.map((s) => `${s.method} ${s.path}`)).toEqual([`DELETE /accounting/sub-funds/${IDS.subFund}/ladder`]);
  await expect(dialog).toContainText("No rungs yet");
});

test("a refused rung shows the engine's reason and adds nothing", async ({ page }) => {
  await stubUnyt(page, "data");
  await page.route(new RegExp(`/tok/accounting/sub-funds/${IDS.subFund}/ladder$`), (route) =>
    route.request().method() === "GET" ? json(route, ladder()) : json(route, { error: "Slot 1 is already taken on this ladder" }, 409));
  const dialog = await openLadder(page);
  await dialog.getByRole("button", { name: "Add rung" }).click();
  const form = page.getByRole("dialog", { name: "Add a rung" });
  await form.getByLabel(/^Slot/).fill("1");
  await form.getByLabel(/^Tenor/).fill("5");
  await form.getByLabel(/^Coupon rate/).fill("0.12");
  await form.getByLabel(/^Coupon months/).fill("03,09");
  await form.getByLabel(/^Face value held/).fill("1000000");
  await form.getByRole("button", { name: "Add rung" }).click();
  await expect(form).toContainText("Slot 1 is already taken on this ladder");
  await expect(page.getByText("Rung added.")).toHaveCount(0);
});

test("an institution's default tariff domain is sent for approval, not applied", async ({ page }) => {
  const sent: Sent[] = [];
  await stubUnyt(page, "data");
  const domains: TariffDomain[] = [
    { tariffDomainId: "TD-DEFAULT", institutionId: IDS.institution, name: "Retail default", domainCategory: "RETAIL" },
    { tariffDomainId: "TD-PRIVATE", institutionId: IDS.institution, name: "Private banking", domainCategory: "PRIVATE" },
  ];
  await page.route(/\/tok\/accounting\/tariffs\/domains$/, (route) => json(route, domains));
  await page.route(/\/tok\/accounting\/config\/changes$/, (route) => {
    if (route.request().method() === "GET") return json(route, []);
    sent.push(sentFrom(route));
    return json(route, { requestId: "CR-DOM-1", changeType: "INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET", status: "PENDING", maker: "amina@baracel.ae" }, 202);
  });
  await page.goto("/token-console/funds");
  await page.getByRole("button", { name: "Set default domain" }).click();
  const form = page.getByRole("dialog", { name: /Default tariff domain/ });
  await pick(form, "Tariff domain", /Private banking/);
  await form.getByRole("button", { name: "Send for approval" }).click();
  await expect(page.getByText("Default tariff domain change sent for approval. It applies once someone else approves it.")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0].body).toEqual({ type: "INSTITUTION_DEFAULT_TARIFF_DOMAIN_SET", payload: { institutionId: IDS.institution, tariffDomainId: "TD-PRIVATE" } });
  // Still the domain in force until someone else approves.
  const institutions = page.locator("section").filter({ has: page.getByRole("heading", { name: "Institutions", exact: true }) });
  await expect(institutions.getByRole("row").filter({ hasText: "Investcent Kenya" })).toContainText("TD-DEFAULT");
});
