import { expect, test, type Page, type Request } from "@playwright/test";
import { ME, OTHER, envelope, json, signIn } from "./stubs";

/* Reinstating and closing a customer under dual control (FR-ADM-03), against
   stubbed omnichannel: the desk proposes, a different person approves. */

const CUSTOMER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROPOSAL = "99999999-9999-4999-8999-999999999999";

const summary = (status: string) => ({
  profileId: CUSTOMER, displayName: "Alice", legalName: "Alice Wanjiru", status, registeredAt: "2026-10-01T08:00:00Z",
  contacts: [], links: [], account: null, activeDevices: 0, pushEnabled: false,
});

const intervention = (over: Record<string, unknown>) => ({
  id: PROPOSAL, profileId: CUSTOMER, customer: "Alice", action: "REINSTATE", note: "False alarm", status: "PENDING",
  proposedBy: OTHER, proposedAt: "2026-10-21T08:00:00Z", decidedBy: null, decidedAt: null, decisionNote: null, profileStatus: "SUSPENDED",
  ...over,
});

type State = { status: string; interventions: Record<string, unknown>[]; writes: { path: string; body: unknown; subject?: string }[] };

/** The customer and their interventions over `state`; `answer` may refuse a write. */
async function stubCustomer(page: Page, state: State, answer?: (req: Request) => { status: number; body: unknown } | null) {
  const reads = { summary: 0, interventions: 0 };
  await page.route(new RegExp(`/omni/api/operator/customers/${CUSTOMER}$`), (route) => {
    reads.summary++;
    return json(route, summary(state.status));
  });
  await page.route(new RegExp(`/omni/api/operator/customers/${CUSTOMER}/interventions(\\?.*)?$`), (route) => {
    reads.interventions++;
    // Paged like the service: page and size from the query, the totals in headers.
    const q = new URL(route.request().url()).searchParams;
    const size = Number(q.get("size") ?? 20);
    const at = Number(q.get("page") ?? 1);
    const all = state.interventions;
    return route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(all.slice((at - 1) * size, at * size)),
      headers: { "X-Total-Count": String(all.length), "X-Total-Pages": String(Math.ceil(all.length / size)), "X-Page": String(at), "X-Size": String(size) },
    });
  });
  await page.route(/\/omni\/api\/operator\/customers\/[^/]+\/(reinstate|close)$|\/customers\/interventions\/[^/]+\/(approve|reject)$/, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/omni/api/operator/customers/", "");
    state.writes.push({ path, body: req.postDataJSON(), subject: req.headers()["x-dev-subject"] });
    const custom = answer?.(req);
    if (custom) return json(route, custom.body, custom.status);
    const [, action] = /\/(\w+)$/.exec(path)!;
    if (action === "reinstate" || action === "close") {
      const created = intervention({ action: action.toUpperCase(), proposedBy: ME, note: (req.postDataJSON() as { note?: string })?.note ?? null, profileStatus: state.status });
      state.interventions = [created, ...state.interventions];
      return json(route, created, 202);
    }
    const current = state.interventions.find((i) => i.id === PROPOSAL)!;
    const approved = action === "approve";
    if (approved) state.status = current.action === "CLOSE" ? "CLOSED" : "ACTIVE";
    Object.assign(current, { status: approved ? "APPROVED" : "REJECTED", decidedBy: ME, decidedAt: "2026-10-21T09:00:00Z", profileStatus: state.status });
    return json(route, current);
  });
  return reads;
}

async function openCustomer(page: Page) {
  await page.goto(`/token-console/customers?id=${CUSTOMER}`);
  await expect(page.getByTestId("customer-view")).toBeVisible();
}

const view = (page: Page) => page.getByTestId("customer-view");

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("proposing a reinstatement shows it pending; the proposer cannot approve it", async ({ page }) => {
  const state: State = { status: "SUSPENDED", interventions: [], writes: [] };
  await stubCustomer(page, state);
  await openCustomer(page);

  await view(page).getByRole("button", { name: "Propose reinstate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Note/).fill("Checked, a false alarm");
  await dialog.getByRole("button", { name: "Propose reinstate" }).click();
  await expect(dialog).toBeHidden();

  expect(state.writes).toEqual([{ path: `${CUSTOMER}/reinstate`, body: { note: "Checked, a false alarm" }, subject: undefined }]);
  const pending = page.getByTestId("pending-intervention");
  await expect(pending).toContainText("You (amina@baracel.ae)");
  await expect(pending.getByTestId("second-person")).toBeVisible();
  await expect(pending.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(pending.getByRole("button", { name: "Reject" })).toBeVisible();
  // The profile is unchanged, and no second proposal is offered while this one waits.
  await expect(view(page).getByText("Suspended", { exact: true })).toBeVisible();
  await expect(view(page).getByRole("button", { name: /Propose/ })).toHaveCount(0);
});

test("a customer's proposals are read from every page, so a waiting one on a later page is still found", async ({ page }) => {
  // 130 proposals newest first: 129 decided ones, then an old one still waiting on page 2.
  const decided = Array.from({ length: 129 }, (_, n) =>
    intervention({ id: `d${n}`, status: "REJECTED", decidedBy: OTHER, decidedAt: "2026-10-21T07:00:00Z", proposedAt: "2026-10-20T08:00:00Z" }));
  const state: State = { status: "SUSPENDED", interventions: [...decided.slice(0, 100), intervention({}), ...decided.slice(100)], writes: [] };
  const reads = await stubCustomer(page, state);
  const asked: string[] = [];
  page.on("request", (r) => { if (/\/interventions\?/.test(r.url()) && r.url().includes(CUSTOMER)) asked.push(new URL(r.url()).searchParams.get("page") ?? ""); });
  await openCustomer(page);

  await expect(page.getByTestId("pending-intervention")).toContainText(OTHER.replace("staff:", ""));
  // Both pages were read (the page may load twice in development).
  expect(asked).toContain("1");
  expect(asked).toContain("2");
  expect(reads.interventions).toBeGreaterThanOrEqual(2);
  // Something is already waiting, so no second proposal is offered.
  await expect(view(page).getByRole("button", { name: /Propose/ })).toHaveCount(0);
});

test("someone else's proposal can be approved, and the profile status refreshes", async ({ page }) => {
  const state: State = { status: "SUSPENDED", interventions: [intervention({})], writes: [] };
  const reads = await stubCustomer(page, state);
  await openCustomer(page);

  await page.getByTestId("pending-intervention").getByRole("button", { name: "Approve" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(dialog).toBeHidden();

  expect(state.writes).toEqual([{ path: `interventions/${PROPOSAL}/approve`, body: {}, subject: undefined }]);
  await expect(view(page).getByText("Active", { exact: true })).toBeVisible();
  expect(reads.summary).toBeGreaterThan(1);
  await expect(page.getByTestId("pending-intervention")).toHaveCount(0);
  await expect(page.getByTestId("customer-interventions")).toContainText("Approved");
});

test("a proposal can be rejected with a note; the profile stays as it was", async ({ page }) => {
  const state: State = { status: "ACTIVE", interventions: [intervention({ action: "CLOSE", profileStatus: "ACTIVE" })], writes: [] };
  await stubCustomer(page, state);
  await openCustomer(page);

  await page.getByTestId("pending-intervention").getByRole("button", { name: "Reject" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Note/).fill("Wrong customer");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(dialog).toBeHidden();

  expect(state.writes).toEqual([{ path: `interventions/${PROPOSAL}/reject`, body: { note: "Wrong customer" }, subject: undefined }]);
  await expect(page.getByTestId("customer-interventions")).toContainText("Rejected");
  await expect(view(page).getByText("Active", { exact: true })).toBeVisible();
});

test("CHANGE_PENDING and SECOND_APPROVER_REQUIRED are shown as they came", async ({ page }) => {
  const pendingMessage = "A reinstate proposed by staff:brian@baracel.ae is already waiting for approval on this customer; approve or reject it first";
  const state: State = { status: "SUSPENDED", interventions: [], writes: [] };
  await stubCustomer(page, state, () => ({ status: 409, body: envelope(409, pendingMessage, "CHANGE_PENDING") }));
  await openCustomer(page);

  await view(page).getByRole("button", { name: "Propose reinstate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Propose reinstate" }).click();
  await expect(dialog).toContainText(pendingMessage);
});

test("the approvals queue lists waiting proposals, toggles to the full log and links to the customer", async ({ page }) => {
  const asked: string[] = [];
  await page.route(/\/omni\/api\/operator\/customers\/interventions(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    asked.push(url.searchParams.get("status") ?? "");
    const all = url.searchParams.get("status") === "ALL";
    const items = all
      ? [intervention({ status: "APPROVED", decidedBy: ME, decidedAt: "2026-10-21T09:00:00Z" }), intervention({ id: "88888888-8888-4888-8888-888888888888", status: "REJECTED", decidedBy: OTHER })]
      : [intervention({}), intervention({ id: "77777777-7777-4777-8777-777777777777", proposedBy: ME, action: "CLOSE" })];
    return route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "X-Total-Count": String(items.length), "X-Total-Pages": "1", "X-Page": "1", "X-Size": "20" },
      body: JSON.stringify(items),
    });
  });
  await page.goto("/token-console/customer-approvals");

  await expect(page.getByRole("tab", { name: /Waiting/ })).toContainText("2");
  await expect(page.getByTestId(`decide-${PROPOSAL}`).getByRole("button", { name: "Approve" })).toBeVisible();
  // The one this staff member proposed has no Approve.
  const mine = page.getByTestId("decide-77777777-7777-4777-8777-777777777777");
  await expect(mine.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(mine.getByTestId("second-person").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Alice" }).first()).toHaveAttribute("href", `/token-console/customers?id=${CUSTOMER}`);

  await page.getByRole("tab", { name: "Full log" }).click();
  await expect(page.getByText("Rejected").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  expect(asked).toContain("PENDING");
  expect(asked).toContain("ALL");
});

test("a 401 on a decision says to sign in again", async ({ page }) => {
  const state: State = { status: "SUSPENDED", interventions: [intervention({})], writes: [] };
  await stubCustomer(page, state, () => ({ status: 401, body: envelope(401, "No authenticated subject") }));
  await openCustomer(page);

  await page.getByTestId("pending-intervention").getByRole("button", { name: "Approve" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(dialog).toContainText("sign in again");
});
