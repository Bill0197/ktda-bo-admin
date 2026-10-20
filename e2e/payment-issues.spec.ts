import { expect, test, type Page, type Request } from "@playwright/test";
import { ME, envelope, json, signIn } from "./stubs";

const PAYOUT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRANSFER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ALICE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BOB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const payment = (id: string, over: Record<string, unknown>) => ({
  id, direction: "OUT", status: "FAILED", method: "MPESA", phone: "+254700000000", amount: 1000, currency: "KES",
  reference: "WD-1", providerRef: null, failureReason: "Simulated failure", createdAt: "2026-10-18T08:00:00Z", completedAt: null, ...over,
});

const ISSUES = [
  { profileId: ALICE, kind: "PAYOUT_FAILED", why: "The payout was not made: Simulated failure.", payment: payment(PAYOUT, {}) },
  {
    profileId: BOB, kind: "TRANSFER_WAITING", why: "Reported 2 days ago under reference IC-ABCDEFGH and not matched yet.",
    payment: payment(TRANSFER, { direction: "IN", status: "PENDING", method: "BANK_TRANSFER", phone: null, amount: 50, currency: "USD", reference: "IC-ABCDEFGH" }),
  },
];

type Write = { path: string; body: unknown; subject?: string };

/** The queue over `issues`; `answer` decides each write (default: handled, leaves the queue). */
async function stubIssues(page: Page, answer?: (req: Request) => { status: number; body: unknown } | null) {
  const state = { issues: [...ISSUES], reads: 0, writes: [] as Write[] };
  await page.route(/\/omni\/api\/operator\/payments\/issues$/, (route) => {
    state.reads++;
    return json(route, state.issues);
  });
  await page.route(/\/omni\/api\/operator\/payments\/[^/]+\/(retry|resolve|match|unmatched)$/, (route) => {
    const req = route.request();
    const [, id, action] = /payments\/([^/]+)\/(\w+)$/.exec(new URL(req.url()).pathname)!;
    state.writes.push({ path: `${id}/${action}`, body: req.postDataJSON(), subject: req.headers()["x-dev-subject"] });
    const custom = answer?.(req);
    if (custom) return json(route, custom.body, custom.status);
    state.issues = state.issues.filter((i) => i.payment.id !== id);
    return json(route, payment(id, { status: action === "retry" ? "PENDING" : "FAILED" }), action === "retry" ? 201 : 200);
  });
  await page.route(/\/omni\/api\/operator\/customers\/[^/]+$/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop();
    if (id === ALICE) return json(route, { profileId: ALICE, legalName: "Alice Wanjiru", displayName: "Alice" });
    return json(route, envelope(404, "Not found"), 404);
  });
  return state;
}

async function openIssues(page: Page) {
  await page.goto("/token-console/transactions?tab=issues");
  await expect(page.getByRole("tab", { name: /Issues/ })).toHaveAttribute("aria-selected", "true");
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("each row offers the actions for its kind, with the customer's name", async ({ page }) => {
  await stubIssues(page);
  await openIssues(page);

  const payout = page.getByTestId(`issue-actions-${PAYOUT}`);
  await expect(payout.getByRole("button")).toHaveText(["Retry", "Resolve"]);
  const transfer = page.getByTestId(`issue-actions-${TRANSFER}`);
  await expect(transfer.getByRole("button")).toHaveText(["Match", "Unmatched", "Resolve"]);

  await expect(page.getByRole("link", { name: "Alice Wanjiru" })).toBeVisible();
  // A lookup that fails leaves the id rather than a blank.
  await expect(page.getByRole("link", { name: /^Customer dddddddd/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Issues/ })).toContainText("2");
});

test("resolve needs a note, sends it, and the queue is read again", async ({ page }) => {
  const state = await stubIssues(page);
  await openIssues(page);

  await page.getByTestId(`issue-actions-${PAYOUT}`).getByRole("button", { name: "Resolve" }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Resolve" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Note/).fill("   ");
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Note/).fill("Paid by hand from the float");
  await submit.click();

  await expect(dialog).toBeHidden();
  expect(state.writes).toEqual([{ path: `${PAYOUT}/resolve`, body: { note: "Paid by hand from the float" }, subject: ME }]);
  await expect(page.getByTestId(`issue-actions-${PAYOUT}`)).toHaveCount(0);
  expect(state.reads).toBeGreaterThan(1);
});

test("a refused retry is shown as it came and the queue is read again", async ({ page }) => {
  const message = "This payout was already handled by staff:brian@baracel.ae: Retried as 123";
  const state = await stubIssues(page, () => ({ status: 409, body: envelope(409, message) }));
  await openIssues(page);

  await page.getByTestId(`issue-actions-${PAYOUT}`).getByRole("button", { name: "Retry" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Retry payout" }).click();
  await expect(dialog).toContainText(message);
  expect(state.writes.map((w) => w.path)).toEqual([`${PAYOUT}/retry`]);
  await expect.poll(() => state.reads).toBeGreaterThan(1);
});

test("match sends the bank reference", async ({ page }) => {
  const state = await stubIssues(page);
  await openIssues(page);

  await page.getByTestId(`issue-actions-${TRANSFER}`).getByRole("button", { name: "Match", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Bank reference/).fill("FT2610200001");
  await dialog.getByRole("button", { name: "Match transfer" }).click();
  await expect(dialog).toBeHidden();
  expect(state.writes).toEqual([{ path: `${TRANSFER}/match`, body: { bankReference: "FT2610200001" }, subject: ME }]);
});

test("an empty queue says so", async ({ page }) => {
  const state = await stubIssues(page);
  state.issues = [];
  await openIssues(page);
  await expect(page.getByText("Nothing needs a person right now.")).toBeVisible();
});
