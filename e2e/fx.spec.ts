import { expect, test, type Page, type Request } from "@playwright/test";
import { ME, OTHER, envelope, json, signIn } from "./stubs";

/* FX rates: the rate customers convert at, under dual control. */

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const SETTINGS = {
  base: "USD", quote: "KES", midRate: 129.89, rateAsOf: "2026-10-26T19:02:56Z", rateValidUntil: inDays(5), rateSource: "BACK_OFFICE",
  marginPct: 2, marginFloorPct: 0, quoteTtlSeconds: 60, minAmount: 100, perConversion: null, perDay: null, suspended: false,
  source: "change", changeId: "597b9716-39f7-4f07-8f0c-1996a10c5c21", since: "2026-10-26T19:02:58Z", decidedBy: "staff:brian@baracel.ae", decisionNote: null,
};

const change = (over: Record<string, unknown>) => ({
  id: "22222222-2222-4222-8222-222222222222", status: "PENDING", midRate: 130.1, rateAsOf: null, rateValidUntil: inDays(6), marginPct: 2,
  marginFloorPct: 0, quoteTtlSeconds: 60, minAmount: 100, perConversion: null, perDay: null, suspended: false, note: "CBK mid",
  proposedBy: OTHER, proposedAt: "2026-10-27T07:00:00Z", decidedBy: null, decidedAt: null, decisionNote: null, ...over,
});

const ENTRY = {
  profileId: "33333333-3333-4333-8333-333333333333", investorId: "44444444-4444-4444-8444-444444444444",
  quote: { id: "55555555-5555-4555-8555-555555555555", from: "KES", to: "USD", sellAmount: 2000, buyAmount: 15.25, rate: 131.1889, midRate: 129.89,
    spreadPct: 2, expiresAt: null, status: "FAILED", createdAt: "2026-10-27T08:00:00Z", convertedAt: null, reference: "FX-5555", failureReason: "The account is closed" },
};

type State = { settings: Record<string, unknown>; pending: Record<string, unknown> | null; log: Record<string, unknown>[] };

async function stubFx(page: Page, state: State, onPost: (req: Request) => { status: number; body: unknown }) {
  await page.route(/\/omni\/api\/operator\/fx\/settings$/, (route) => json(route, { settings: state.settings, pending: state.pending }));
  await page.route(/\/omni\/api\/operator\/fx\/settings\/changes(\/.*)?(\?.*)?$/, (route) => {
    const req = route.request();
    if (req.method() === "GET") return json(route, state.log);
    const { status, body } = onPost(req);
    return json(route, body, status);
  });
  await page.route(/\/omni\/api\/operator\/fx\/conversions(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "X-Total-Pages": "1", "X-Total-Count": "1" }, body: JSON.stringify([ENTRY]) }));
}

async function open(page: Page) {
  await page.goto("/token-console/fx");
  await expect(page.getByRole("heading", { name: "FX rates" })).toBeVisible();
  await expect(page.getByTestId("fx-current")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the rate in force with what customers pay and get, and the book with a failure's reason", async ({ page }) => {
  await stubFx(page, { settings: SETTINGS, pending: null, log: [] }, () => ({ status: 500, body: {} }));
  await open(page);
  const current = page.getByTestId("fx-current");
  await expect(current).toContainText("129.89");
  await expect(current).toContainText("KES 131.1889"); // 129.89 × 1.01
  await expect(current).toContainText("KES 128.5911"); // 129.89 × 0.99
  await expect(page.getByText("The account is closed").first()).toBeVisible();
  await expect(page.getByText("FX-5555").first()).toBeVisible();
});

test("a new rate is proposed with only what changed, and the proposer sees no Approve", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  const state: State = { settings: SETTINGS, pending: null, log: [] };
  await stubFx(page, state, (req) => {
    const body = req.postDataJSON() as Record<string, unknown>;
    sent.push(body);
    const proposed = change({ ...body, proposedBy: ME });
    state.pending = proposed;
    state.log = [proposed];
    return { status: 201, body: proposed };
  });
  await open(page);
  const form = page.getByTestId("fx-proposal");
  await form.getByLabel("Mid rate").fill("130.1");
  await expect(page.getByTestId("fx-preview")).toContainText("KES 131.401");
  await form.getByRole("button", { name: "Propose for approval" }).click();
  await expect(page.getByText(/Proposed\. It waits for a second person/)).toBeVisible();
  // Only the mid changed: the validity in force rides along, nothing else is sent.
  expect(sent).toHaveLength(1);
  expect(Object.keys(sent[0]).sort()).toEqual(["midRate", "rateValidUntil"]);
  expect(sent[0].midRate).toBe(130.1);
  const pending = page.getByTestId("fx-pending");
  await expect(pending.getByTestId("second-person")).toContainText("Waiting for a second person");
  await expect(pending.getByRole("button", { name: "Approve" })).toHaveCount(0);
});

test("someone else's proposal is approved; a refusal is shown as it came", async ({ page }) => {
  const theirs = change({});
  let refuse = true;
  await stubFx(page, { settings: SETTINGS, pending: theirs, log: [theirs] }, () => {
    if (refuse) { refuse = false; return { status: 409, body: envelope(409, "That change was already decided", "CHANGE_DECIDED") }; }
    return { status: 200, body: { ...theirs, status: "APPROVED" } };
  });
  await open(page);
  const pending = page.getByTestId("fx-pending");
  await expect(pending).toContainText("Mid rate: 129.89 → 130.1");
  await pending.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("dialog")).toContainText("That change was already decided");
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Approved\. Customers' quotes now use the new setting/)).toBeVisible();
});

test("the change log names only what each change altered", async ({ page }) => {
  const older = change({ id: "66666666-6666-4666-8666-666666666666", status: "APPROVED", midRate: 129.89, rateValidUntil: "2026-11-02T20:59:59Z" });
  const newer = change({ id: "77777777-7777-4777-8777-777777777777", status: "APPROVED", midRate: 129.89, rateValidUntil: "2026-11-03T18:59:00Z" });
  await stubFx(page, { settings: SETTINGS, pending: null, log: [newer, older] }, () => ({ status: 500, body: {} }));
  await open(page);
  const row = page.getByRole("row").filter({ hasText: "Valid until" }).first();
  await expect(row).toContainText("→");
  await expect(row).not.toContainText("Mid rate");
});

test("a rate that has run out says customers cannot convert", async ({ page }) => {
  await stubFx(page, { settings: { ...SETTINGS, rateValidUntil: inDays(-1) }, pending: null, log: [] }, () => ({ status: 500, body: {} }));
  await open(page);
  await expect(page.getByText("The rate has run out")).toBeVisible();
});

test("a value the service refuses is shown on its field", async ({ page }) => {
  await stubFx(page, { settings: SETTINGS, pending: null, log: [] }, () =>
    ({ status: 400, body: envelope(400, "perDay cannot be under perConversion", undefined, "perDay") }));
  await open(page);
  const form = page.getByTestId("fx-proposal");
  await form.getByLabel("Mid rate").fill("130");
  await form.getByRole("button", { name: "Propose for approval" }).click();
  await page.getByText("Limits and quote hold").click();
  await expect(form.getByText("perDay cannot be under perConversion")).toBeVisible();
});
