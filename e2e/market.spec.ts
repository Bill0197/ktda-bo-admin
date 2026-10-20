import { expect, test, type Page, type Request } from "@playwright/test";
import { ME, OTHER, envelope, json, signIn, stubOfferings } from "./stubs";

const DEFAULTS = {
  tradingOpen: "09:00", tradingClose: "15:00", zone: "Africa/Nairobi", weekendsOpen: false, halted: false,
  haltedOfferings: [] as string[], source: "defaults", changeId: null, since: null,
};

const change = (over: Record<string, unknown>) => ({
  id: "11111111-1111-4111-8111-111111111111", status: "PENDING", tradingOpen: "09:00", tradingClose: "15:00",
  weekendsOpen: false, halted: true, haltedOfferings: [], note: "Repricing", proposedBy: OTHER,
  proposedAt: "2026-10-20T08:00:00Z", decidedBy: null, decidedAt: null, decisionNote: null, ...over,
});

type Market = { settings: Record<string, unknown>; pending: Record<string, unknown> | null; log: Record<string, unknown>[] };

/** The market endpoints over `state`; `onPost` answers the writes. */
async function stubMarket(page: Page, state: Market, onPost: (req: Request) => { status: number; body: unknown }) {
  const reads = { settings: 0, log: 0 };
  await page.route(/\/omni\/api\/operator\/market\/settings$/, (route) => {
    reads.settings++;
    return json(route, { settings: state.settings, pending: state.pending });
  });
  await page.route(/\/omni\/api\/operator\/market\/settings\/changes(\/.*)?(\?.*)?$/, (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      reads.log++;
      return json(route, state.log);
    }
    const { status, body } = onPost(req);
    return json(route, body, status);
  });
  return reads;
}

async function open(page: Page) {
  await page.goto("/token-console/market");
  await expect(page.getByRole("heading", { name: "Market" })).toBeVisible();
  await expect(page.getByTestId("market-current")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await stubOfferings(page);
});

test("the proposer sees no Approve, only that a second person is needed", async ({ page }) => {
  const mine = change({ proposedBy: ME });
  await stubMarket(page, { settings: DEFAULTS, pending: mine, log: [mine] }, () => ({ status: 500, body: {} }));
  await open(page);

  const pending = page.getByTestId("market-pending");
  await expect(pending.getByTestId("second-person")).toContainText("Waiting for a second person");
  await expect(pending.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(pending.getByRole("button", { name: "Reject" })).toBeVisible();
  await expect(page.getByTestId("market-current")).toContainText("Set by defaults");
});

test("someone else's proposal can be approved; a refusal is shown as it came", async ({ page }) => {
  const theirs = change({});
  const state: Market = { settings: DEFAULTS, pending: theirs, log: [theirs] };
  const message = "A change needs a second person to approve it; it was proposed by you";
  let approveBody: unknown;
  let subject: string | undefined;
  const reads = await stubMarket(page, state, (req) => {
    approveBody = req.postDataJSON();
    subject = req.headers()["x-dev-subject"];
    return { status: 409, body: envelope(409, message, "SECOND_APPROVER_REQUIRED") };
  });
  await open(page);

  const pending = page.getByTestId("market-pending");
  await expect(pending).toContainText("Halts the whole market");
  await pending.getByRole("button", { name: "Approve" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(dialog).toContainText(message);
  expect(approveBody).toEqual({});
  expect(subject).toBe(ME);
  // The page reads the setting again after a refusal (someone may have decided it).
  await expect.poll(() => reads.settings).toBeGreaterThan(1);
});

test("a proposal sends only the fields that changed, and the page reloads", async ({ page }) => {
  const state: Market = { settings: DEFAULTS, pending: null, log: [] };
  let body: unknown;
  let subject: string | undefined;
  const reads = await stubMarket(page, state, (req) => {
    body = req.postDataJSON();
    subject = req.headers()["x-dev-subject"];
    const created = change({ proposedBy: ME, halted: false, tradingClose: "16:00", haltedOfferings: ["OF-B"], note: null });
    state.pending = created;
    state.log = [created];
    return { status: 201, body: created };
  });
  await open(page);

  const form = page.getByTestId("market-proposal");
  const submit = form.getByRole("button", { name: "Propose change" });
  await expect(submit).toBeDisabled(); // nothing changed yet
  await form.getByLabel("Dealing closes").fill("16:00");
  await form.getByTestId("halted-offerings").getByText("FXD1/2024/10").click();
  await submit.click();

  await expect(page.getByTestId("market-pending").getByTestId("second-person")).toBeVisible();
  expect(body).toEqual({ tradingClose: "16:00", haltedOfferings: ["OF-B"] });
  expect(subject).toBe(ME);
  expect(reads.log).toBeGreaterThan(1);
  await expect(page.getByTestId("market-pending")).toContainText("Hours 09:00–15:00 → 09:00–16:00");
  await expect(page.getByTestId("market-pending")).toContainText("Halts FXD1/2024/10");
});

test("a 409 on a proposal is shown as it came", async ({ page }) => {
  const message = "A change proposed by staff:brian@baracel.ae is already waiting for approval; approve or reject it first";
  await stubMarket(page, { settings: DEFAULTS, pending: null, log: [] }, () => ({ status: 409, body: envelope(409, message, "CHANGE_PENDING") }));
  await open(page);

  const form = page.getByTestId("market-proposal");
  await form.getByRole("switch", { name: "Halt the whole market" }).click();
  await form.getByRole("button", { name: "Propose change" }).click();
  await expect(form).toContainText(message);
});

test("a close before the open is caught before it is sent", async ({ page }) => {
  let posted = false;
  await stubMarket(page, { settings: DEFAULTS, pending: null, log: [] }, () => { posted = true; return { status: 400, body: {} }; });
  await open(page);

  const form = page.getByTestId("market-proposal");
  await form.getByLabel("Dealing closes").fill("08:00");
  await expect(form).toContainText("The close must be after the open.");
  await expect(form.getByRole("button", { name: "Propose change" })).toBeDisabled();
  expect(posted).toBe(false);
});

test("the setting in force names who approved it, and halted bonds by name", async ({ page }) => {
  const approved = change({
    id: "22222222-2222-4222-8222-222222222222", status: "APPROVED", halted: false, haltedOfferings: ["OF-A"],
    decidedBy: OTHER, decidedAt: "2026-10-20T09:30:00Z",
  });
  const settings = { ...DEFAULTS, haltedOfferings: ["OF-A"], source: "change", changeId: approved.id, since: approved.decidedAt };
  await stubMarket(page, { settings, pending: null, log: [approved] }, () => ({ status: 500, body: {} }));
  await open(page);

  const current = page.getByTestId("market-current");
  await expect(current).toContainText("Approved by brian@baracel.ae");
  await expect(current).toContainText("IFB1/2023/17");
  await expect(page.getByTestId("market-pending")).toContainText("Nothing is waiting");
});
