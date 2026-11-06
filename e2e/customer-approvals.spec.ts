import { expect, test, type Page } from "@playwright/test";
import { ME, OTHER, envelope, json } from "./stubs";
import { IDS, sentFrom, stubUnyt, type Sent } from "./unyt-fixtures";
import type { Intervention } from "../src/lib/omniApi";

/* Customer approvals: deciding reinstatements and closures from the queue
 * itself (interventions.spec.ts covers proposing them on the Customer desk).
 * Omnichannel enforces the second person; the page must not offer the proposer
 * an Approve, must name who decided, and must show the service's 409s. */

const proposal = (over: Partial<Intervention> = {}): Intervention => ({
  id: "99999999-9999-4999-8999-999999999999", profileId: IDS.profile, customer: "Alice Wanjiru", action: "CLOSE", note: "Customer asked to close",
  status: "PENDING", proposedBy: OTHER, proposedAt: "2026-10-28T08:00:00Z", decidedBy: null, decidedAt: null, decisionNote: null, profileStatus: "ACTIVE", ...over,
});

type Book = { items: Intervention[]; sent: Sent[]; reads: number; refuse?: { status: number; body: unknown } };

async function stubQueue(page: Page, book: Book) {
  await stubUnyt(page, "data");
  await page.route(/\/omni\/api\/operator\/customers\/interventions(\?.*)?$/, (route) => {
    book.reads++;
    const status = new URL(route.request().url()).searchParams.get("status");
    const items = book.items.filter((i) => status === "ALL" || i.status === "PENDING");
    return route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(items),
      headers: { "X-Total-Count": String(items.length), "X-Total-Pages": items.length ? "1" : "0", "X-Page": "1", "X-Size": "20" },
    });
  });
  await page.route(/\/omni\/api\/operator\/customers\/interventions\/[^/]+\/(approve|reject)$/, (route) => {
    const s = sentFrom(route);
    book.sent.push(s);
    if (book.refuse) return json(route, book.refuse.body, book.refuse.status);
    const [, , , id, action] = s.path.split("/");
    const i = book.items.find((x) => x.id === id)!;
    Object.assign(i, {
      status: action === "approve" ? "APPROVED" : "REJECTED", decidedBy: ME, decidedAt: new Date().toISOString(),
      decisionNote: (s.body as { note?: string }).note ?? null, profileStatus: action === "approve" ? "CLOSED" : i.profileStatus,
    });
    return json(route, i);
  });
}

async function open(page: Page) {
  await page.goto("/token-console/customer-approvals");
  await expect(page.getByRole("heading", { name: "Customer approvals", level: 1 })).toBeVisible();
}

const decide = (page: Page, id = proposal().id) => page.getByTestId(`decide-${id}`);

test("someone else's closure is approved from the queue, as me, and leaves it", async ({ page }) => {
  const book: Book = { items: [proposal()], sent: [], reads: 0 };
  await stubQueue(page, book);
  await open(page);
  await decide(page).getByRole("button", { name: "Approve" }).click();
  const confirm = page.getByRole("dialog", { name: "Approve this?" });
  await expect(confirm).toContainText("The app profile is closed now, for good");
  await confirm.getByLabel(/^Note/).fill("Closure form signed");
  await confirm.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. The profile has been updated.")).toBeVisible();

  expect(book.sent).toHaveLength(1);
  expect(book.sent[0]).toMatchObject({ method: "POST", path: `/customers/interventions/${proposal().id}/approve`, body: { note: "Closure form signed" }, subject: undefined });
  await expect(page.getByText("Nothing is waiting for a second person")).toBeVisible();

  await page.getByRole("tab", { name: "Full log" }).click();
  await expect(page.getByText("Closure form signed").filter({ visible: true })).toBeVisible();
});

test("a rejection is sent with its note and the profile is left as it was", async ({ page }) => {
  const book: Book = { items: [proposal({ action: "REINSTATE", profileStatus: "SUSPENDED" })], sent: [], reads: 0 };
  await stubQueue(page, book);
  await open(page);
  await decide(page).getByRole("button", { name: "Reject" }).click();
  const confirm = page.getByRole("dialog", { name: "Reject this?" });
  await confirm.getByLabel(/^Note/).fill("Fraud case still open");
  await confirm.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Rejected. The profile is unchanged.")).toBeVisible();
  expect(book.sent.map((s) => s.path)).toEqual([`/customers/interventions/${proposal().id}/reject`]);
  expect(book.sent[0].body).toEqual({ note: "Fraud case still open" });
  expect(book.items[0].profileStatus).toBe("SUSPENDED");
});

test("my own proposal offers no Approve, only Reject", async ({ page }) => {
  const book: Book = { items: [proposal({ proposedBy: ME })], sent: [], reads: 0 };
  await stubQueue(page, book);
  await open(page);
  await expect(decide(page).getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(decide(page).getByTestId("second-person").filter({ visible: true })).toBeVisible();
  await expect(decide(page).getByRole("button", { name: "Reject" })).toBeVisible();
});

test("a proposal someone else already decided says so, and the queue is read again", async ({ page }) => {
  const book: Book = {
    items: [proposal()], sent: [], reads: 0,
    refuse: { status: 409, body: envelope(409, "This proposal was already decided by brian@baracel.ae", "CHANGE_DECIDED") },
  };
  await stubQueue(page, book);
  await open(page);
  const readsBefore = book.reads;
  await decide(page).getByRole("button", { name: "Approve" }).click();
  const confirm = page.getByRole("dialog", { name: "Approve this?" });
  await confirm.getByRole("button", { name: "Approve" }).click();
  await expect(confirm).toContainText("This proposal was already decided by brian@baracel.ae");
  await expect.poll(() => book.reads).toBeGreaterThan(readsBefore);
  await expect(page.getByText("Approved. The profile has been updated.")).toHaveCount(0);
});

test("someone who may not decide sees the status only", async ({ page }) => {
  const book: Book = { items: [proposal()], sent: [], reads: 0 };
  await stubQueue(page, book);
  await page.route(/\/tok\/auth\/me$/, (route) => json(route, { email: "joy@baracel.ae", fullName: "Joy", roles: ["ACCOUNTANT"], admin: false }));
  await open(page);
  await expect(page.getByRole("row").filter({ hasText: "Alice Wanjiru" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
});
