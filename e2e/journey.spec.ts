import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { envelope, json, signIn } from "./stubs";
import { BULK_COLUMNS, SAMPLE_FILES, type BulkFlow } from "../src/lib/journeyContract";

/* The farmer journey (journeyContract.ts): register (REGISTRATION), farmer
 * onboarding simulated (ACTIVATION, opens the wallets), fund (PAYMENT), the
 * overview of the three, the farmers list by stage and the single-farmer
 * register. The two new flows and the farmers endpoints are proposals,
 * stubbed here; "not built" is stubbed as today's omnichannel answers it. */

const KTDA = "11111111-1111-4111-8111-111111111111";
const RUN = "33333333-3333-4333-8333-333333333333";
const BULK = /\/omni\/api\/operator\/bulk-loads/;
const FARMERS = /\/omni\/api\/operator\/farmers(\?.*)?$/;

type Obj = Record<string, unknown>;
const run = (over: Obj = {}): Obj => ({
  runId: RUN, flow: "REGISTRATION", institutionId: KTDA, currency: "KES", sourceName: "1-register.csv",
  status: "RUNNING", totalRows: 5, processedCount: 0, skippedCount: 0, failureCount: 0, totalAmount: 0,
  startedAt: "2026-11-06T08:00:00Z", completedAt: null, message: null, ...over,
});
const recon = (over: Obj = {}): Obj => ({
  runId: RUN, flow: "REGISTRATION", institutionId: KTDA, institutionName: "KTDA Holdings", status: "COMPLETED",
  walletCount: 0, processedCount: 5, skippedCount: 0, failureCount: 0, creditedTotal: 0,
  depositDebitTotal: 0, depositCreditTotal: 0, doubleEntryBalanced: true, expectedTotal: null, matchesExpected: null, ...over,
});
const farmer = (growerNo: string, state: string, over: Obj = {}): Obj => ({
  growerNo, fullName: `Test Farmer ${growerNo.slice(-1)}`, phone: `25470000010${growerNo.slice(-1)}`, factory: "Test Factory A",
  state, registeredAt: "2026-11-06T08:00:00Z", activatedAt: state === "REGISTERED" ? null : "2026-11-06T09:00:00Z",
  lastFundedAt: state === "FUNDED" ? "2026-11-06T10:00:00Z" : null, ...over,
});
const COUNTS = { REGISTERED: 2, ACTIVATED: 2, FUNDED: 1 };

type Sent = { method: string; path: string; query: URLSearchParams; body: string | null };

async function stub(page: Page, opts: {
  recent?: Obj[];
  onboarded?: boolean;
  upload?: { status: number; body: unknown };
  polls?: Obj[];
  farmers?: { status: number; body: unknown } | ((q: URLSearchParams) => { status: number; body: unknown });
  register?: { status: number; body: unknown };
} = {}) {
  const sent: Sent[] = [];
  let poll = 0;
  await page.route(/\/tok\/accounting\/institutions$/, (route) => json(route, [{ institutionId: KTDA, name: "KTDA Holdings", localCurrency: "KES" }]));
  await page.route(/\/omni\/api\/operator\/institutions$/, (route) => json(route, [{ id: KTDA, name: "KTDA Holdings", localCurrency: "KES", country: "KE", status: "ACTIVE" }]));
  await page.route(BULK, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/omni\/api\/operator\/bulk-loads/, "");
    sent.push({ method: req.method(), path: `/bulk-loads${path}`, query: url.searchParams, body: req.postData() });
    if (req.method() === "POST" && path === "/upload") {
      const out = opts.upload ?? { status: 202, body: opts.polls?.[0] ?? run() };
      return json(route, out.body, out.status);
    }
    if (req.method() === "POST" && path === `/${RUN}/process`) return json(route, opts.polls?.[0] ?? run());
    if (path === "/onboarding-status") return json(route, { onboardingCompleted: !!opts.onboarded });
    if (path === "") return json(route, opts.recent ?? []);
    if (path === `/${RUN}`) {
      const polls = opts.polls ?? [run()];
      return json(route, polls[Math.min(poll++, polls.length - 1)]);
    }
    if (path === `/${RUN}/reconciliation`) return json(route, recon());
    return json(route, { message: "Not stubbed" }, 404);
  });
  await page.route(FARMERS, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    sent.push({ method: req.method(), path: "/farmers", query: url.searchParams, body: req.postData() });
    if (req.method() === "POST") {
      const out = opts.register ?? { status: 201, body: { growerNo: "TEST000009", status: "REGISTERED" } };
      return json(route, out.body, out.status);
    }
    const f = opts.farmers;
    const out = typeof f === "function" ? f(url.searchParams)
      : f ?? { status: 200, body: { items: [farmer("TEST000001", "FUNDED"), farmer("TEST000002", "ACTIVATED"), farmer("TEST000003", "REGISTERED")], page: 1, size: 20, total: 5, counts: COUNTS } };
    return json(route, out.body, out.status);
  });
  return sent;
}

/** Today's omnichannel: no such endpoint, and no such flow value. */
const NO_ENDPOINT = { status: 404, body: envelope(404, "Not Found") };
const NO_FLOW = { status: 400, body: envelope(400, "Parameter 'flow' must be a valid BulkFlow") };

const sample = (flow: BulkFlow) => readFileSync(new URL(`../public/${SAMPLE_FILES[flow]}`, import.meta.url), "utf8");
const csv = (name: string, text: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(text) });

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test.describe("the overview", () => {
  test("nothing run yet: step 1 open, steps 2 and 3 blocked with the reason, and the stage counts", async ({ page }) => {
    await stub(page);
    await page.goto("/journey");
    await expect(page.getByRole("heading", { name: "Farmer journey", level: 1 })).toBeVisible();
    const step = (n: number) => page.getByTestId(`journey-step-${n}`);
    await expect(step(1)).toHaveAttribute("data-open", "true");
    await expect(step(1)).toContainText("Register farmers");
    await expect(step(2)).toHaveAttribute("data-open", "false");
    await expect(step(2)).toContainText("Farmer onboarding (simulated)");
    await expect(step(2).getByTestId("blocked-why")).toContainText("Waiting for step 1");
    await expect(step(3)).toHaveAttribute("data-open", "false");
    await expect(step(3).getByTestId("blocked-why")).toContainText("Waiting for step 2");
    for (const n of [1, 2, 3]) await expect(step(n).getByTestId("last-run")).toContainText("No run yet.");
    await expect(step(3).getByRole("link", { name: /step 3/ })).toHaveAttribute("href", "/bulk/payments");

    const counts = page.getByTestId("stage-counts");
    await expect(counts).toContainText("Registered");
    await expect(counts).toContainText("2");
    await expect(counts).toContainText("Funded");
    // A live page: no demo badge.
    await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
  });

  test("after steps 1 and 2: every step open, each with what its last run did", async ({ page }) => {
    await stub(page, {
      onboarded: true,
      recent: [
        run({ status: "COMPLETED", processedCount: 5, completedAt: "2026-11-06T08:00:05Z" }),
        run({ runId: "44444444-4444-4444-8444-444444444444", flow: "ACTIVATION", sourceName: "2-activate.csv", status: "PARTIAL", processedCount: 4, failureCount: 1, startedAt: "2026-11-06T09:00:00Z" }),
        run({ runId: "55555555-5555-4555-8555-555555555555", flow: "ACTIVATION", sourceName: "older.csv", status: "COMPLETED", processedCount: 1, startedAt: "2026-11-06T07:00:00Z" }),
      ],
    });
    await page.goto("/journey");
    for (const n of [1, 2, 3]) await expect(page.getByTestId(`journey-step-${n}`)).toHaveAttribute("data-open", "true");
    const second = page.getByTestId("journey-step-2").getByTestId("last-run");
    await expect(second).toContainText("2-activate.csv");
    await expect(second).toContainText("Partial");
    await expect(second).toContainText("Wallets opened");
    await expect(page.getByTestId("journey-step-1").getByTestId("last-run")).toContainText("Farmers registered");
  });

  test("an environment without the farmers endpoint says so, and the steps still show", async ({ page }) => {
    await stub(page, { farmers: NO_ENDPOINT });
    await page.goto("/journey");
    await expect(page.getByTestId("stage-counts").getByTestId("not-available")).toContainText("Not available on this environment yet");
    await expect(page.getByTestId("journey-step-1")).toBeVisible();
  });
});

test.describe("step 1, register farmers", () => {
  test("uploads the sample as REGISTRATION, processes and shows farmers registered", async ({ page }) => {
    const sent = await stub(page, {
      polls: [run(), run({ status: "COMPLETED", processedCount: 5, completedAt: "2026-11-06T08:00:05Z" })],
    });
    await page.goto("/journey/register");
    await expect(page.getByRole("heading", { name: "Register farmers", level: 1 })).toBeVisible();
    await expect(page.getByText("Farmer journey · step 1 of 3")).toBeVisible();
    await expect(page.getByTestId("step-2")).toContainText(BULK_COLUMNS.REGISTRATION.join(","));

    await page.getByLabel("CSV file").setInputFiles(csv("1-register.csv", sample("REGISTRATION")));
    await expect(page.getByTestId("file-summary")).toContainText("1-register.csv: 5 rows");
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByTestId("run-progress")).toContainText("Completed");
    await expect(page.getByTestId("run-progress")).toContainText("Farmers registered");

    const upload = sent.find((s) => s.method === "POST" && s.path === "/bulk-loads/upload")!;
    expect(upload.body).toContain('name="flow"\r\n\r\nREGISTRATION');
    expect(upload.body).toContain(`name="institutionId"\r\n\r\n${KTDA}`);
  });

  test("a template with the step's header, and the sample file, can be downloaded", async ({ page }) => {
    await stub(page);
    await page.goto("/journey/register");
    const [template] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download template" }).click()]);
    expect(template.suggestedFilename()).toBe("ktda-registration-template.csv");
    expect(readFileSync(await template.path(), "utf8")).toBe(`${BULK_COLUMNS.REGISTRATION.join(",")}\n`);
    await expect(page.getByRole("link", { name: "Sample file (five test farmers)" })).toHaveAttribute("href", `/${SAMPLE_FILES.REGISTRATION}`);
  });

  test("an omnichannel without the flow: 'not available on this environment yet', and nothing is retried as ONBOARDING", async ({ page }) => {
    const sent = await stub(page, { upload: NO_FLOW });
    await page.goto("/journey/register");
    await page.getByLabel("CSV file").setInputFiles(csv("1-register.csv", sample("REGISTRATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByTestId("not-available")).toContainText("Not available on this environment yet");
    await expect(page.getByRole("alert")).toHaveCount(0);
    const uploads = sent.filter((s) => s.method === "POST" && s.path === "/bulk-loads/upload");
    expect(uploads).toHaveLength(1);
    expect(uploads[0].body).not.toContain("ONBOARDING");
    expect(sent.some((s) => s.path.endsWith("/process"))).toBe(false);
  });

  test("an ordinary refusal still reads as the service sent it", async ({ page }) => {
    await stub(page, { upload: { status: 400, body: envelope(400, "Row 3: grower_no is missing") } });
    await page.goto("/journey/register");
    await page.getByLabel("CSV file").setInputFiles(csv("1-register.csv", sample("REGISTRATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByRole("alert")).toContainText("Row 3: grower_no is missing");
    await expect(page.getByTestId("not-available")).toHaveCount(0);
  });
});

test.describe("step 2, farmer onboarding (simulated)", () => {
  test("closed until a registration run has completed, and says why", async ({ page }) => {
    const sent = await stub(page, { recent: [run({ status: "FAILED", message: "Every row failed" })] });
    await page.goto("/journey/activate");
    await expect(page.getByRole("heading", { name: "Farmer onboarding (simulated)", level: 1 })).toBeVisible();
    await expect(page.getByText("in real life each farmer finishes onboarding")).toBeVisible();
    await expect(page.getByText("Step 2 is closed")).toBeVisible();
    await expect(page.getByLabel("CSV file")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Process" })).toBeDisabled();
    expect(sent.some((s) => s.method === "POST")).toBe(false);
  });

  test("open after a completed registration: uploads as ACTIVATION and counts wallets opened", async ({ page }) => {
    const done = run({ status: "COMPLETED", processedCount: 5 });
    const sent = await stub(page, {
      recent: [done],
      polls: [run({ flow: "ACTIVATION" }), run({ flow: "ACTIVATION", status: "COMPLETED", processedCount: 5, completedAt: "2026-11-06T09:00:05Z" })],
    });
    await page.goto("/journey/activate");
    await expect(page.getByText("A registration run has completed. This step is open.")).toBeVisible();
    await page.getByLabel("CSV file").setInputFiles(csv("2-activate.csv", sample("ACTIVATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByTestId("run-progress")).toContainText("Wallets opened");
    const upload = sent.find((s) => s.method === "POST" && s.path === "/bulk-loads/upload")!;
    expect(upload.body).toContain('name="flow"\r\n\r\nACTIVATION');
  });

  test("omnichannel's own 409 (its gate) is shown as it comes", async ({ page }) => {
    await stub(page, {
      recent: [run({ status: "COMPLETED", processedCount: 5 })],
      upload: { status: 409, body: envelope(409, "No registration run has completed for this institution") },
    });
    await page.goto("/journey/activate");
    await page.getByLabel("CSV file").setInputFiles(csv("2-activate.csv", sample("ACTIVATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByRole("alert")).toContainText("No registration run has completed for this institution");
  });
});

test("step 3 is Payment runs: the journey's step, with the sample file", async ({ page }) => {
  await stub(page, { onboarded: false });
  await page.goto("/bulk/payments");
  await expect(page.getByText("Farmer journey · step 3 of 3")).toBeVisible();
  await expect(page.getByText("Payments are closed")).toBeVisible();
  await expect(page.getByRole("link", { name: "step 2, farmer onboarding" })).toHaveAttribute("href", "/journey/activate");
  await expect(page.getByRole("link", { name: "Sample file (five test farmers)" })).toHaveAttribute("href", `/${SAMPLE_FILES.PAYMENT}`);
});

test.describe("farmers by stage", () => {
  test("lists the farmers with their stage and the counts per stage", async ({ page }) => {
    await stub(page);
    await page.goto("/farmers");
    await expect(page.getByRole("heading", { name: "Farmers by stage", level: 1 })).toBeVisible();
    const table = page.getByTestId("farmers-table");
    await expect(table.locator('[data-grower="TEST000001"]')).toContainText("Funded");
    await expect(table.locator('[data-grower="TEST000003"]')).toContainText("Registered");
    await expect(page.getByRole("tab", { name: /Registered/ })).toContainText("2");
    await expect(page.getByRole("tab", { name: /All/ })).toContainText("5");
  });

  test("a stage filter and a search go to omnichannel as state and q", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/farmers");
    await page.getByRole("tab", { name: /Registered/ }).click();
    await expect(page).toHaveURL(/state=REGISTERED/);
    await page.getByLabel("Grower number, name or phone").fill("TEST000003");
    await expect(page).toHaveURL(/q=TEST000003/);
    await expect.poll(() => sent.some((s) => s.path === "/farmers" && s.query.get("state") === "REGISTERED" && s.query.get("q") === "TEST000003")).toBe(true);
  });

  test("opened from a link with a stage, it reads that stage", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/farmers?state=ACTIVATED");
    await expect(page.getByText("Onboarded, wallet open, not paid yet.")).toBeVisible();
    expect(sent.some((s) => s.path === "/farmers" && s.query.get("state") === "ACTIVATED")).toBe(true);
  });

  test("an environment without the endpoint says so, not a broken page", async ({ page }) => {
    await stub(page, { farmers: NO_ENDPOINT });
    await page.goto("/farmers");
    await expect(page.getByTestId("not-available")).toContainText("Not available on this environment yet");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("register farmer", () => {
  const fill = async (page: Page) => {
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Grower number").fill("TEST000009");
    await dialog.getByLabel("National ID").fill("90000009");
    await dialog.getByLabel("Full name").fill("Test Farmer Nine");
    await dialog.getByLabel("Phone").fill("+254700000109");
    await dialog.getByLabel("Factory").fill("Test Factory A");
    return dialog;
  };

  test("posts one farmer to the farmers endpoint (not the bulk one) and shows them registered", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/farmers");
    await page.getByRole("button", { name: "Register farmer" }).click();
    const dialog = await fill(page);
    await dialog.getByRole("button", { name: "Register", exact: true }).click();
    await expect(dialog.getByTestId("registered")).toContainText("TEST000009 is registered and awaiting activation");
    const post = sent.find((s) => s.method === "POST")!;
    expect(post.path).toBe("/farmers");
    expect(JSON.parse(post.body!)).toEqual({ growerNo: "TEST000009", nationalId: "90000009", fullName: "Test Farmer Nine", phone: "254700000109", factory: "Test Factory A" });
    expect(sent.some((s) => s.path.startsWith("/bulk-loads") && s.method === "POST")).toBe(false);
  });

  test("an incomplete form or a wrong phone cannot be sent", async ({ page }) => {
    await stub(page);
    await page.goto("/farmers");
    await page.getByRole("button", { name: "Register farmer" }).click();
    const dialog = await fill(page);
    await dialog.getByLabel("Phone").fill("0700000109");
    await expect(dialog.getByRole("button", { name: "Register", exact: true })).toBeDisabled();
    await expect(dialog.getByTestId("form-problem")).toContainText("254 then 9 digits");
    await dialog.getByLabel("Factory").fill("");
    await expect(dialog.getByTestId("form-problem")).toContainText("Every field is needed.");
  });

  test("an identity clash (409) is shown as omnichannel sent it", async ({ page }) => {
    await stub(page, { register: { status: 409, body: envelope(409, "Grower TEST000009 is registered with a different national ID") } });
    await page.goto("/farmers");
    await page.getByRole("button", { name: "Register farmer" }).click();
    const dialog = await fill(page);
    await dialog.getByRole("button", { name: "Register", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("registered with a different national ID");
  });

  test("an environment without the endpoint says so", async ({ page }) => {
    await stub(page, { register: NO_ENDPOINT });
    await page.goto("/farmers");
    await page.getByRole("button", { name: "Register farmer" }).click();
    const dialog = await fill(page);
    await dialog.getByRole("button", { name: "Register", exact: true }).click();
    await expect(dialog.getByTestId("not-available")).toContainText("Not available on this environment yet");
  });
});

test("the three sample files carry the same five test growers, in each step's columns", () => {
  const rows = (flow: BulkFlow) => sample(flow).trim().split("\n").map((l) => l.split(","));
  const growers = (flow: BulkFlow) => rows(flow).slice(1).map((r) => r[0]);
  for (const flow of ["REGISTRATION", "ACTIVATION", "PAYMENT"] as BulkFlow[]) {
    expect(rows(flow)[0]).toEqual(BULK_COLUMNS[flow]);
    expect(growers(flow)).toEqual(["TEST000001", "TEST000002", "TEST000003", "TEST000004", "TEST000005"]);
  }
  expect(rows("REGISTRATION").slice(1).every((r) => r[1].startsWith("Test Farmer"))).toBe(true);
});
