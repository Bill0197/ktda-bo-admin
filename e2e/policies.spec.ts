import { expect, test, type Page } from "@playwright/test";
import { json } from "./stubs";
import { IDS, pick, sentFrom, stubUnyt, type Sent } from "./unyt-fixtures";
import type { AccrualPolicyResponse } from "../src/lib/tokenConsole/types.gen";

/* Accrual & distribution policies: what the batch runs do. These are direct
 * engine writes (the engine has no change request for them). The point that
 * matters is spec-deviations §5: `approved` and `scheduleEnabled` must always be
 * sent, because the engine reads a missing one as false and silently creates a
 * policy that never acts. */

const POLICY: AccrualPolicyResponse = {
  policyId: "AP-1", scope: "PRODUCT", scopeRef: IDS.fundProduct, method: "SIMPLE_DAILY", rateSource: "TARIFF", dayCount: "ACTUAL_365",
  currency: "KES", effectiveFrom: "2026-01-01", approved: true, active: true, cron: "0 0 1 * * *", zone: "Africa/Nairobi", scheduleEnabled: true,
  createdAt: "2026-10-01T08:00:00Z",
};

type Book = { accrual: AccrualPolicyResponse[]; sent: Sent[]; refuse?: string };

async function stubPolicies(page: Page, book: Book) {
  await stubUnyt(page, "data");
  await page.route(/\/tok\/accounting\/policies\/(accrual|distribution|schedules)(\/[^?]*)?(\?.*)?$/, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "GET") {
      if (path.endsWith("/accrual")) return json(route, book.accrual);
      return json(route, []);
    }
    const s = sentFrom(route);
    book.sent.push(s);
    if (book.refuse) return json(route, { error: book.refuse }, 400);
    if (path.endsWith("/accrual")) {
      const created = { ...(s.body as AccrualPolicyResponse), policyId: "AP-2", createdAt: new Date().toISOString() };
      book.accrual.push(created);
      return json(route, created, 201);
    }
    const active = path.match(/\/accrual\/([^/]+)\/active$/);
    if (active) {
      const p = book.accrual.find((x) => x.policyId === active[1])!;
      p.active = new URL(req.url()).searchParams.get("value") === "true";
      return json(route, p);
    }
    return json(route, s.body ?? {}, 201);
  });
}

async function open(page: Page) {
  await page.goto("/token-console/policies");
  await expect(page.getByRole("heading", { name: "Accrual & distribution policies", level: 1 })).toBeVisible();
}

test("a new accrual policy always says whether it is approved and scheduled, even when both are no", async ({ page }) => {
  const book: Book = { accrual: [POLICY], sent: [] };
  await stubPolicies(page, book);
  await open(page);
  await page.getByRole("button", { name: "Accrual policy" }).click();
  const form = page.getByRole("dialog", { name: "New accrual policy" });
  await form.getByLabel(/^Applies to/).selectOption("PRODUCT");
  await pick(form, "Product", /BRF-KES Income Fund/);
  await form.getByLabel(/^Rate source/).selectOption("FIXED");
  await form.getByLabel(/^Fixed rate/).fill("0.1");
  await form.getByRole("button", { name: "Create policy" }).click();
  await expect(page.getByText("No accrual policies")).toHaveCount(0);

  expect(book.sent).toHaveLength(1);
  expect(book.sent[0].path).toBe("/accounting/policies/accrual");
  const body = book.sent[0].body as Record<string, unknown>;
  expect(body).toMatchObject({
    scope: "PRODUCT", scopeRef: IDS.fundProduct, method: "SIMPLE_DAILY", rateSource: "FIXED", fixedRate: 0.1, dayCount: "ACTUAL_365",
    approved: false, scheduleEnabled: false,
  });
  expect(body).toHaveProperty("approved", false);
  expect(body).toHaveProperty("scheduleEnabled", false);
  // Re-read: the new one is listed, and says it will not act.
  const accrual = page.locator("section").filter({ has: page.getByRole("heading", { name: "Accrual policies" }) });
  await expect(accrual.getByText("Unapproved").filter({ visible: true })).toBeVisible();
});

test("a scheduled policy needs a six-field cron before it can be sent", async ({ page }) => {
  const book: Book = { accrual: [], sent: [] };
  await stubPolicies(page, book);
  await open(page);
  await page.getByRole("button", { name: "Accrual policy" }).click();
  const form = page.getByRole("dialog", { name: "New accrual policy" });
  await form.getByText("Run on the schedule").click();
  await form.getByLabel(/^Schedule \(cron\)/).fill("0 1 * *");
  await expect(form).toContainText("A scheduled policy needs a six-field cron.");
  await expect(form.getByRole("button", { name: "Create policy" })).toBeDisabled();
  await form.getByLabel(/^Schedule \(cron\)/).fill("0 0 1 * * *");
  await form.getByText("Approved — it acts from its effective date").click();
  await form.getByRole("button", { name: "Create policy" }).click();
  await expect.poll(() => book.sent.length).toBe(1);
  expect(book.sent[0].body).toMatchObject({ scope: "GLOBAL", cron: "0 0 1 * * *", zone: "Africa/Nairobi", scheduleEnabled: true, approved: true });
});

test("deactivating sends value=false and the list is read again", async ({ page }) => {
  const book: Book = { accrual: [{ ...POLICY }], sent: [] };
  await stubPolicies(page, book);
  await open(page);
  await page.getByRole("button", { name: "Deactivate" }).first().click();
  await expect(page.getByText("Accrual policy deactivated.")).toBeVisible();
  expect(book.sent.map((s) => `${s.method} ${s.path}${s.query}`)).toEqual(["POST /accounting/policies/accrual/AP-1/active?value=false"]);
  const accrual = page.locator("section").filter({ has: page.getByRole("heading", { name: "Accrual policies" }) });
  await expect(accrual.getByText("Inactive").filter({ visible: true })).toBeVisible();
});

test("withholding outside 0–1 is caught before it is sent", async ({ page }) => {
  const book: Book = { accrual: [], sent: [] };
  await stubPolicies(page, book);
  await open(page);
  await page.getByRole("button", { name: "Distribution policy" }).click();
  const form = page.getByRole("dialog", { name: "New distribution policy" });
  await form.getByLabel(/^Withholding tax/).fill("15");
  await expect(form).toContainText("Withholding is a fraction between 0 and 1, e.g. 0.15.");
  await expect(form.getByRole("button", { name: "Create policy" })).toBeDisabled();
  expect(book.sent).toEqual([]);
});

test("the engine's refusal is shown on the form and nothing is listed", async ({ page }) => {
  const book: Book = { accrual: [], sent: [], refuse: "An accrual policy for GLOBAL already covers 2026-10-30" };
  await stubPolicies(page, book);
  await open(page);
  await page.getByRole("button", { name: "Accrual policy" }).click();
  const form = page.getByRole("dialog", { name: "New accrual policy" });
  await form.getByRole("button", { name: "Create policy" }).click();
  await expect(form).toContainText("An accrual policy for GLOBAL already covers 2026-10-30");
  expect(book.accrual).toEqual([]);
});
