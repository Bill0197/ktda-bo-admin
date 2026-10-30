import { expect, test, type Page } from "@playwright/test";
import { json } from "./stubs";
import { pick, sentFrom, stubUnyt, type Sent } from "./unyt-fixtures";
import type { ConfigChange } from "../src/lib/tokenConsole/configChanges";
import type { TariffValue } from "../src/lib/tokenConsole/types.gen";

/* Tariffs → Change approvals: a rate is staged by one person and applied only
 * when someone else approves it (the engine's /config/changes maker-checker).
 * The stub keeps the queue and the rates, so each step's re-read shows its effect. */

const ME = "amina@baracel.ae";
const BRIAN = "brian@baracel.ae";
const BASE_RATE: TariffValue = {
  tariffValueId: "TV-1", tariffTypeId: "TT-MGMT-FEE", tariffDomainId: "TD-DEFAULT", currency: "KES", rate: 0.015, dayCount: "ACTUAL_365", effectiveFrom: "2026-01-01", approved: true,
};

type Book = { changes: ConfigChange[]; values: TariffValue[]; sent: Sent[]; refuse?: { status: number; body: unknown } };

const staged = (over: Partial<ConfigChange>): ConfigChange => ({
  requestId: "CR-RATE-9", changeType: "TARIFF_VALUE_CREATE", targetId: null, summary: "Management fee 2%",
  payload: { tariffTypeId: "TT-MGMT-FEE", tariffDomainId: "TD-DEFAULT", currency: "KES", rate: 0.02, dayCount: "ACTUAL_365", effectiveFrom: "2026-11-01" },
  status: "PENDING", maker: BRIAN, madeAt: "2026-10-29T08:00:00Z", ...over,
});

/** The engine's change queue and rates over `book`. */
async function stubBooks(page: Page, book: Book) {
  await stubUnyt(page, "data");
  await page.route(/\/tok\/accounting\/tariffs\/values$/, (route) => json(route, book.values));
  await page.route(/\/tok\/accounting\/config\/changes(\/[^/?]+(\/\w+)?)?(\?.*)?$/, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET") {
      const status = url.searchParams.get("status");
      return json(route, book.changes.filter((c) => !status || c.status === status));
    }
    const s = sentFrom(route);
    book.sent.push(s);
    const [, , , , id, action] = s.path.split("/"); // /accounting/config/changes/{id}/{action}
    if (!id) {
      const body = s.body as { type: ConfigChange["changeType"]; payload: Record<string, unknown>; summary?: string };
      const change = staged({ requestId: `CR-NEW-${book.changes.length + 1}`, changeType: body.type, payload: body.payload, summary: body.summary ?? null, maker: ME, madeAt: new Date().toISOString() });
      book.changes.push(change);
      return json(route, change, 202);
    }
    const change = book.changes.find((c) => c.requestId === id)!;
    if (book.refuse) {
      change.status = "FAILED";
      change.error = (book.refuse.body as { error: string }).error;
      return json(route, book.refuse.body, book.refuse.status);
    }
    const note = (s.body as { note?: string } | null)?.note ?? null;
    if (action === "approve") {
      Object.assign(change, { status: "APPROVED", checker: ME, decidedAt: new Date().toISOString(), decisionNote: note });
      book.values.push({ ...(change.payload as TariffValue), tariffValueId: "TV-2", approved: true });
    } else if (action === "reject") {
      Object.assign(change, { status: "REJECTED", checker: ME, decidedAt: new Date().toISOString(), decisionNote: note });
    } else {
      change.status = "CANCELLED";
    }
    return json(route, change);
  });
}

const values = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Values" }) });

async function openChange(page: Page, summary: string) {
  await page.goto("/token-console/changes");
  await expect(page.getByRole("heading", { name: "Change approvals", level: 1 })).toBeVisible();
  await page.getByRole("row").filter({ hasText: summary }).click();
  return page.getByRole("dialog", { name: summary });
}

test("a new rate is sent for approval, is not listed yet, and its maker cannot approve it", async ({ page }) => {
  const book: Book = { changes: [], values: [BASE_RATE], sent: [] };
  await stubBooks(page, book);
  await page.goto("/token-console/tariffs");
  await page.getByRole("button", { name: "Rate", exact: true }).click();

  const form = page.getByRole("dialog", { name: "New rate" });
  await expect(form.getByRole("button", { name: "Send for approval" })).toBeDisabled();
  await pick(form, "Tariff type", /Management fee/);
  await pick(form, "Domain", /Retail default/);
  await form.getByLabel(/^Rate/).fill("0.02");
  await form.getByRole("button", { name: "Send for approval" }).click();
  await expect(page.getByText("Rate sent for approval. It is added once someone else approves it.")).toBeVisible();

  expect(book.sent).toHaveLength(1);
  expect(book.sent[0].method).toBe("POST");
  expect(book.sent[0].path).toBe("/accounting/config/changes");
  const body = book.sent[0].body as { type: string; payload: Record<string, unknown> };
  expect(body.type).toBe("TARIFF_VALUE_CREATE");
  expect(body.payload).toEqual({
    tariffTypeId: "TT-MGMT-FEE", tariffDomainId: "TD-DEFAULT", currency: "KES", rate: 0.02, dayCount: "ACTUAL_365",
    effectiveFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  });

  // Staged, not applied: the table still has only the rate in force, and says one is waiting.
  await expect(page.getByText("1 rate is awaiting approval")).toBeVisible();
  await expect(values(page).getByText("2%", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/token-console\/changes$/);
  const row = page.getByRole("row").filter({ hasText: "New rate" });
  await expect(row).toContainText("You");
  await row.click();
  const panel = page.getByRole("dialog");
  await expect(panel).toContainText("You made this change, so someone else has to approve it.");
  await expect(panel.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Withdraw request" })).toBeVisible();
});

test("someone else's rate is approved with a note, and then Tariffs lists it", async ({ page }) => {
  const book: Book = { changes: [staged({})], values: [BASE_RATE], sent: [] };
  await stubBooks(page, book);
  const panel = await openChange(page, "Management fee 2%");
  await expect(panel).toContainText(BRIAN);
  await panel.getByRole("button", { name: "Approve" }).click();

  const confirm = page.getByRole("dialog", { name: "Approve this change?" });
  await confirm.getByLabel(/^Note/).fill("Matches the signed fee schedule");
  await confirm.getByRole("button", { name: "Approve and apply" }).click();
  await expect(page.getByText("Approved and applied.")).toBeVisible();

  expect(book.sent.map((s) => `${s.method} ${s.path}`)).toEqual(["POST /accounting/config/changes/CR-RATE-9/approve"]);
  expect(book.sent[0].body).toEqual({ note: "Matches the signed fee schedule" });
  await expect(page.getByRole("row").filter({ hasText: "Management fee 2%" })).toHaveCount(0);

  await page.goto("/token-console/tariffs");
  await expect(values(page).getByText("2%", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/awaiting approval/)).toHaveCount(0);
});

test("a rejection needs a note, which is sent; nothing is applied", async ({ page }) => {
  const book: Book = { changes: [staged({})], values: [BASE_RATE], sent: [] };
  await stubBooks(page, book);
  const panel = await openChange(page, "Management fee 2%");
  await panel.getByRole("button", { name: "Reject" }).click();

  const confirm = page.getByRole("dialog", { name: "Reject this change?" });
  await expect(confirm.getByRole("button", { name: "Reject" })).toBeDisabled();
  await confirm.getByLabel(/^Note/).fill("Rate not agreed with the board");
  await confirm.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Rejected. Nothing was applied.")).toBeVisible();

  expect(book.sent.map((s) => s.path)).toEqual(["/accounting/config/changes/CR-RATE-9/reject"]);
  expect(book.sent[0].body).toEqual({ note: "Rate not agreed with the board" });
  expect(book.values).toEqual([BASE_RATE]);
});

test("an approval the engine refuses shows its reason, and the request reads as failed", async ({ page }) => {
  const book: Book = {
    changes: [staged({})], values: [BASE_RATE], sent: [],
    refuse: { status: 409, body: { error: "A rate for TT-MGMT-FEE in TD-DEFAULT already starts on 2026-11-01" } },
  };
  await stubBooks(page, book);
  const panel = await openChange(page, "Management fee 2%");
  await panel.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog", { name: "Approve this change?" }).getByRole("button", { name: "Approve and apply" }).click();

  await expect(page.getByText("A rate for TT-MGMT-FEE in TD-DEFAULT already starts on 2026-11-01").first()).toBeVisible();
  await expect(page.getByText("Approved and applied.")).toHaveCount(0);
  expect(book.values).toEqual([BASE_RATE]);
  // The queue is re-read: it is no longer waiting.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row").filter({ hasText: "Management fee 2%" })).toHaveCount(0);
});

test("the maker can withdraw their own request", async ({ page }) => {
  const book: Book = { changes: [staged({ maker: ME })], values: [BASE_RATE], sent: [] };
  await stubBooks(page, book);
  const panel = await openChange(page, "Management fee 2%");
  await panel.getByRole("button", { name: "Withdraw request" }).click();
  await page.getByRole("dialog", { name: "Withdraw your request?" }).getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByText("Request withdrawn.")).toBeVisible();
  expect(book.sent.map((s) => s.path)).toEqual(["/accounting/config/changes/CR-RATE-9/cancel"]);
});
