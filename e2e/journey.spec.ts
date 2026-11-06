import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { envelope, json, signIn } from "./stubs";
import { BULK_COLUMNS, COLUMNS, SAMPLE_FILES, type BulkFlow } from "../src/lib/journeyContract";

/* The farmer journey (journeyContract.ts): register (REGISTRATION), farmer
 * onboarding simulated (ACTIVATION, opens the wallets), fund (PAYMENT), the
 * overview of the three, the farmers list by stage and the single-farmer
 * register, against omnichannel's journey contract, stubbed. An omnichannel
 * without the journey is stubbed as today's answers it (400 for the flow,
 * 404 for /farmers, no registrationCompleted). */

const KTDA = "11111111-1111-4111-8111-111111111111";
const RUN = "33333333-3333-4333-8333-333333333333";
const BULK = /\/omni\/api\/operator\/bulk-loads/;
const FARMERS = /\/omni\/api\/operator\/farmers(\/[^?]*)?(\?.*)?$/;

type Obj = Record<string, unknown>;
const run = (over: Obj = {}): Obj => ({
  runId: RUN, flow: "REGISTRATION", institutionId: KTDA, currency: "KES", sourceName: "1-register.csv",
  status: "RUNNING", totalRows: 5, processedCount: 0, skippedCount: 0, failureCount: 0, totalAmount: 0,
  startedAt: "2026-11-06T08:00:00Z", completedAt: null, message: null, ...over,
});
const recon = (over: Obj = {}): Obj => ({
  runId: RUN, flow: "ACTIVATION", institutionId: KTDA, institutionName: "KTDA Holdings", status: "COMPLETED",
  walletCount: 5, processedCount: 5, skippedCount: 0, failureCount: 0, creditedTotal: 0,
  depositDebitTotal: 0, depositCreditTotal: 0, doubleEntryBalanced: true, expectedTotal: null, matchesExpected: null, ...over,
});
const farmer = (growerNo: string, status: string, over: Obj = {}): Obj => ({
  growerNo, fullName: `Test Farmer ${growerNo.slice(-1)}`, phone: `+25470000010${growerNo.slice(-1)}`, factory: "Test Factory A",
  status, registeredAt: "2026-11-06T08:00:00Z", activatedAt: status === "REGISTERED" ? null : "2026-11-06T09:00:00Z",
  lastFundedAt: status === "FUNDED" ? "2026-11-06T10:00:00Z" : null, ...over,
});
const SUMMARY = { registered: 2, activated: 2, funded: 1, total: 5 };
const ITEMS = [farmer("TEST000001", "FUNDED"), farmer("TEST000002", "ACTIVATED"), farmer("TEST000003", "REGISTERED")];

type Sent = { method: string; path: string; query: URLSearchParams; body: string | null };
type Answer = { status: number; body: unknown; headers?: Record<string, string> };
const answer = (route: Route, a: Answer) =>
  route.fulfill({ status: a.status, contentType: "application/json", headers: a.headers, body: JSON.stringify(a.body) });
const paged = (items: Obj[], total = items.length, page = 1, size = 20): Answer => ({
  status: 200, body: items,
  headers: { "X-Total-Count": String(total), "X-Page": String(page), "X-Size": String(size), "X-Total-Pages": String(Math.max(1, Math.ceil(total / size))) },
});

async function stub(page: Page, opts: {
  recent?: Obj[];
  /** onboarding-status; `legacy` answers as an omnichannel without the journey. */
  status?: { onboardingCompleted?: boolean; registrationCompleted?: boolean } | "legacy";
  upload?: Answer;
  polls?: Obj[];
  reconciliation?: Answer;
  farmers?: Answer | ((q: URLSearchParams) => Answer);
  summary?: Answer;
  register?: Answer;
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
    if (req.method() === "POST" && path === "/upload") return answer(route, opts.upload ?? { status: 202, body: opts.polls?.[0] ?? run() });
    if (req.method() === "POST" && path === `/${RUN}/process`) return json(route, opts.polls?.[0] ?? run());
    if (path === "/onboarding-status") {
      const st = opts.status ?? {};
      return json(route, st === "legacy" ? { onboardingCompleted: false } : { onboardingCompleted: !!st.onboardingCompleted, registrationCompleted: !!st.registrationCompleted });
    }
    if (path === "") return json(route, opts.recent ?? []);
    if (path === `/${RUN}`) {
      const polls = opts.polls ?? [run()];
      return json(route, polls[Math.min(poll++, polls.length - 1)]);
    }
    if (path === `/${RUN}/reconciliation`) return answer(route, opts.reconciliation ?? { status: 200, body: recon() });
    return json(route, { message: "Not stubbed" }, 404);
  });
  await page.route(FARMERS, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/omni\/api\/operator/, "");
    sent.push({ method: req.method(), path, query: url.searchParams, body: req.postData() });
    if (req.method() === "POST") return answer(route, opts.register ?? { status: 201, body: farmer("TEST000009", "REGISTERED") });
    if (path === "/farmers/summary") return answer(route, opts.summary ?? { status: 200, body: SUMMARY });
    const f = opts.farmers;
    return answer(route, typeof f === "function" ? f(url.searchParams) : f ?? paged(ITEMS, 5));
  });
  return sent;
}

/** An omnichannel without the journey. */
const NO_ENDPOINT: Answer = { status: 404, body: envelope(404, "Not Found") };
const NO_FLOW: Answer = { status: 400, body: envelope(400, "Parameter 'flow' must be a valid BulkFlow") };

const sample = (flow: BulkFlow) => readFileSync(new URL(`../public/${SAMPLE_FILES[flow]}`, import.meta.url), "utf8");
const csv = (name: string, text: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(text) });

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test.describe("the overview", () => {
  const step = (page: Page, n: number) => page.getByTestId(`journey-step-${n}`);

  test("nothing run yet: step 1 open, steps 2 and 3 blocked with the reason, and the stage counts", async ({ page }) => {
    await stub(page);
    await page.goto("/journey");
    await expect(page.getByRole("heading", { name: "Farmer journey", level: 1 })).toBeVisible();
    await expect(step(page, 1)).toHaveAttribute("data-open", "true");
    await expect(step(page, 1)).toContainText("Register farmers");
    await expect(step(page, 2)).toHaveAttribute("data-open", "false");
    await expect(step(page, 2)).toContainText("Farmer onboarding (simulated)");
    await expect(step(page, 2).getByTestId("blocked-why")).toContainText("Waiting for step 1");
    await expect(step(page, 3)).toHaveAttribute("data-open", "false");
    await expect(step(page, 3).getByTestId("blocked-why")).toContainText("Waiting for step 2");
    for (const n of [1, 2, 3]) await expect(step(page, n).getByTestId("last-run")).toContainText("No run yet.");
    await expect(step(page, 3).getByRole("link", { name: /step 3/ })).toHaveAttribute("href", "/bulk/payments");

    const counts = page.getByTestId("stage-counts");
    await expect(counts).toContainText("Registered");
    await expect(counts).toContainText("2");
    await expect(counts).toContainText("Funded");
    await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
  });

  test("steps open on omnichannel's answer, each with what its last run did", async ({ page }) => {
    await stub(page, {
      status: { registrationCompleted: true, onboardingCompleted: true },
      recent: [
        run({ status: "COMPLETED", processedCount: 5, completedAt: "2026-11-06T08:00:05Z" }),
        run({ runId: "44444444-4444-4444-8444-444444444444", flow: "ACTIVATION", sourceName: "2-activate.csv", status: "PARTIAL", processedCount: 4, failureCount: 1, startedAt: "2026-11-06T09:00:00Z" }),
        run({ runId: "55555555-5555-4555-8555-555555555555", flow: "ACTIVATION", sourceName: "older.csv", status: "COMPLETED", processedCount: 1, startedAt: "2026-11-06T07:00:00Z" }),
      ],
    });
    await page.goto("/journey");
    for (const n of [1, 2, 3]) await expect(step(page, n)).toHaveAttribute("data-open", "true");
    const second = step(page, 2).getByTestId("last-run");
    await expect(second).toContainText("2-activate.csv");
    await expect(second).toContainText("Partial");
    await expect(second).toContainText("Wallets opened");
    await expect(step(page, 1).getByTestId("last-run")).toContainText("Farmers registered");
  });

  test("a farmer registered singly opens step 2 with no registration run at all", async ({ page }) => {
    await stub(page, { status: { registrationCompleted: true } });
    await page.goto("/journey");
    await expect(step(page, 2)).toHaveAttribute("data-open", "true");
    await expect(step(page, 3)).toHaveAttribute("data-open", "false");
  });

  test("an omnichannel without the journey says so, and the steps still show", async ({ page }) => {
    await stub(page, { status: "legacy", summary: NO_ENDPOINT, farmers: NO_ENDPOINT });
    await page.goto("/journey");
    await expect(page.getByTestId("stage-counts").getByTestId("not-available")).toContainText("Not available on this environment yet");
    await expect(step(page, 2).getByTestId("blocked-why")).toContainText("Not available on this environment yet");
    await expect(step(page, 1)).toBeVisible();
  });
});

test.describe("step 1, register farmers", () => {
  test("uploads the sample as REGISTRATION, shows farmers registered and asks for no reconciliation", async ({ page }) => {
    const sent = await stub(page, {
      polls: [run(), run({ status: "COMPLETED", processedCount: 4, skippedCount: 1, completedAt: "2026-11-06T08:00:05Z", message: "4 registered, 1 already registered" })],
    });
    await page.goto("/journey/register");
    await expect(page.getByRole("heading", { name: "Register farmers", level: 1 })).toBeVisible();
    await expect(page.getByText("Farmer journey · step 1 of 3")).toBeVisible();
    const fileStep = page.getByTestId("step-2");
    await expect(fileStep).toContainText(`Needed: ${COLUMNS.REGISTRATION.required.join(", ")}`);
    await expect(fileStep).toContainText(`optional: ${COLUMNS.REGISTRATION.optional.join(", ")}`);

    await page.getByLabel("CSV file").setInputFiles(csv("1-register.csv", sample("REGISTRATION")));
    await expect(page.getByTestId("file-summary")).toContainText("1-register.csv: 5 rows");
    await page.getByRole("button", { name: "Process" }).click();
    const progress = page.getByTestId("run-progress");
    await expect(progress).toContainText("Completed");
    await expect(progress).toContainText("Farmers registered");
    await expect(progress).toContainText("Already registered with the same phone");
    await expect(page.getByTestId("no-recon")).toContainText("posts nothing to the ledger");

    const upload = sent.find((s) => s.method === "POST" && s.path === "/bulk-loads/upload")!;
    expect(upload.body).toContain('name="flow"\r\n\r\nREGISTRATION');
    expect(upload.body).toContain(`name="institutionId"\r\n\r\n${KTDA}`);
    expect(sent.some((s) => s.path.endsWith("/reconciliation"))).toBe(false);
  });

  test("columns are found by name: any order and extra columns pass, a missing one is caught before upload", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/journey/register");
    await page.getByLabel("CSV file").setInputFiles(csv("ok.csv", "msisdn,notes,full_name,grower_no\n0700000101,x,Test Farmer One,TEST000001\n"));
    await expect(page.getByTestId("file-summary")).toContainText("ok.csv: 1 row");
    await expect(page.getByRole("button", { name: "Process" })).toBeEnabled();

    await page.getByLabel("CSV file").setInputFiles(csv("bad.csv", "grower_no,full_name,factory\nTEST000001,Test Farmer One,Test Factory A\n"));
    await expect(page.getByTestId("file-summary")).toContainText("The file's header row has no msisdn column.");
    await expect(page.getByRole("button", { name: "Process" })).toBeDisabled();
    expect(sent.some((s) => s.method === "POST")).toBe(false);
  });

  test("a run that fails on process shows omnichannel's reasons", async ({ page }) => {
    await stub(page, {
      polls: [run(), run({ status: "FAILED", failureCount: 5, completedAt: "2026-11-06T08:00:02Z", message: "0 registered, 5 failed.\nrow 2: grower number TEST000001 is held with a different phone" })],
    });
    await page.goto("/journey/register");
    await page.getByLabel("CSV file").setInputFiles(csv("1-register.csv", sample("REGISTRATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByTestId("run-message")).toContainText("row 2: grower number TEST000001 is held with a different phone");
  });

  test("a template with the step's columns, and the sample file, can be downloaded", async ({ page }) => {
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
    await stub(page, { upload: { status: 400, body: envelope(400, "file is empty") } });
    await page.goto("/journey/register");
    await page.getByLabel("CSV file").setInputFiles(csv("1-register.csv", sample("REGISTRATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByRole("alert")).toContainText("file is empty");
    await expect(page.getByTestId("not-available")).toHaveCount(0);
  });
});

test.describe("step 2, farmer onboarding (simulated)", () => {
  test("closed until anyone is registered, and says why", async ({ page }) => {
    const sent = await stub(page, { status: { registrationCompleted: false } });
    await page.goto("/journey/activate");
    await expect(page.getByRole("heading", { name: "Farmer onboarding (simulated)", level: 1 })).toBeVisible();
    await expect(page.getByText("in real life each farmer finishes onboarding")).toBeVisible();
    await expect(page.getByText("Step 2 is closed")).toBeVisible();
    await expect(page.getByLabel("CSV file")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Process" })).toBeDisabled();
    expect(sent.some((s) => s.method === "POST")).toBe(false);
  });

  test("an omnichannel without the journey: not available, not 'closed'", async ({ page }) => {
    await stub(page, { status: "legacy" });
    await page.goto("/journey/activate");
    await expect(page.getByTestId("not-available")).toContainText("Not available on this environment yet");
    await expect(page.getByText("Step 2 is closed")).toHaveCount(0);
    await expect(page.getByLabel("CSV file")).toBeDisabled();
  });

  test("open once anyone is registered: uploads as ACTIVATION, counts wallets opened, shows the reconciliation", async ({ page }) => {
    const sent = await stub(page, {
      status: { registrationCompleted: true },
      polls: [run({ flow: "ACTIVATION" }), run({ flow: "ACTIVATION", status: "COMPLETED", processedCount: 5, completedAt: "2026-11-06T09:00:05Z" })],
    });
    await page.goto("/journey/activate");
    await expect(page.getByText("Farmers are on the register. This step is open.")).toBeVisible();
    await expect(page.getByTestId("step-2")).toContainText("date_of_birth as YYYY-MM-DD");
    await page.getByLabel("CSV file").setInputFiles(csv("2-activate.csv", sample("ACTIVATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByTestId("run-progress")).toContainText("Wallets opened");
    await expect(page.getByTestId("recon-panel")).toContainText("Wallets held");
    const upload = sent.find((s) => s.method === "POST" && s.path === "/bulk-loads/upload")!;
    expect(upload.body).toContain('name="flow"\r\n\r\nACTIVATION');
  });

  test("a run where nobody was eligible: no reconciliation (409), said plainly", async ({ page }) => {
    await stub(page, {
      status: { registrationCompleted: true },
      polls: [run({ flow: "ACTIVATION" }), run({ flow: "ACTIVATION", status: "FAILED", failureCount: 5, completedAt: "2026-11-06T09:00:05Z", message: "0 activated, 5 failed.\nrow 2: not registered" })],
      reconciliation: { status: 409, body: envelope(409, "Nothing to reconcile") },
    });
    await page.goto("/journey/activate");
    await page.getByLabel("CSV file").setInputFiles(csv("2-activate.csv", sample("ACTIVATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByTestId("no-recon")).toContainText("no wallet was opened");
    await expect(page.getByTestId("run-message")).toContainText("row 2: not registered");
  });

  test("a date of birth not in YYYY-MM-DD is flagged before upload", async ({ page }) => {
    await stub(page, { status: { registrationCompleted: true } });
    await page.goto("/journey/activate");
    await page.getByLabel("CSV file").setInputFiles(csv("dates.csv", "grower_no,national_id,date_of_birth\nTEST000001,90000001,01/01/1980\nTEST000002,90000002,1981-02-02\n"));
    await expect(page.getByTestId("file-summary")).toContainText("1 row with a date_of_birth not in YYYY-MM-DD form will fail.");
  });

  test("omnichannel's own 409 (its gate) is shown as it comes", async ({ page }) => {
    await stub(page, {
      status: { registrationCompleted: true },
      upload: { status: 409, body: envelope(409, "Nobody is registered for this institution yet") },
    });
    await page.goto("/journey/activate");
    await page.getByLabel("CSV file").setInputFiles(csv("2-activate.csv", sample("ACTIVATION")));
    await page.getByRole("button", { name: "Process" }).click();
    await expect(page.getByRole("alert")).toContainText("Nobody is registered for this institution yet");
  });
});

test("step 3 is Payment runs: the journey's step, with the sample file", async ({ page }) => {
  await stub(page, { status: { registrationCompleted: true, onboardingCompleted: false } });
  await page.goto("/bulk/payments");
  await expect(page.getByText("Farmer journey · step 3 of 3")).toBeVisible();
  await expect(page.getByText("Payments are closed")).toBeVisible();
  await expect(page.getByRole("link", { name: "step 2, farmer onboarding" })).toHaveAttribute("href", "/journey/activate");
  await expect(page.getByRole("link", { name: "Sample file (five test farmers)" })).toHaveAttribute("href", `/${SAMPLE_FILES.PAYMENT}`);
});

test.describe("farmers by stage", () => {
  test("lists the farmers with their stage, and the institution-wide counts from the summary", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/farmers");
    await expect(page.getByRole("heading", { name: "Farmers by stage", level: 1 })).toBeVisible();
    const table = page.getByTestId("farmers-table");
    await expect(table.locator('[data-grower="TEST000001"]')).toContainText("Funded");
    await expect(table.locator('[data-grower="TEST000001"]')).toContainText("+254700000101");
    await expect(table.locator('[data-grower="TEST000003"]')).toContainText("Registered");
    await expect(page.getByRole("tab", { name: /Registered/ })).toContainText("2");
    await expect(page.getByRole("tab", { name: /All/ })).toContainText("5");
    const read = sent.find((s) => s.path === "/farmers")!;
    expect(read.query.get("page")).toBe("1");
    expect(read.query.get("size")).toBe("20");
    expect(sent.some((s) => s.path === "/farmers/summary")).toBe(true);
  });

  test("pages through the X-Total-* headers", async ({ page }) => {
    const sent = await stub(page, { farmers: (q) => paged(ITEMS, 45, Number(q.get("page")), 20) });
    await page.goto("/farmers");
    await expect(page.getByText("45 farmers · page 1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("45 farmers · page 2 of 3")).toBeVisible();
    expect(sent.some((s) => s.path === "/farmers" && s.query.get("page") === "2")).toBe(true);
  });

  test("a stage filter and a search go to omnichannel as state and q", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/farmers");
    await page.getByRole("tab", { name: /Registered/ }).click();
    await expect(page).toHaveURL(/state=REGISTERED/);
    await page.getByLabel("Grower number, name or phone").fill("0700000103");
    await expect(page).toHaveURL(/q=0700000103/);
    await expect.poll(() => sent.some((s) => s.path === "/farmers" && s.query.get("state") === "REGISTERED" && s.query.get("q") === "0700000103")).toBe(true);
  });

  test("opened from a link with a stage, it reads that stage", async ({ page }) => {
    const sent = await stub(page);
    await page.goto("/farmers?state=ACTIVATED");
    await expect(page.getByText("Wallet open, not paid yet.")).toBeVisible();
    expect(sent.some((s) => s.path === "/farmers" && s.query.get("state") === "ACTIVATED")).toBe(true);
  });

  test("an environment without the endpoint says so, not a broken page", async ({ page }) => {
    await stub(page, { farmers: NO_ENDPOINT, summary: NO_ENDPOINT });
    await page.goto("/farmers");
    await expect(page.getByTestId("not-available")).toContainText("Not available on this environment yet");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("register farmer", () => {
  const open = async (page: Page) => {
    await page.goto("/farmers");
    await page.getByRole("button", { name: "Register farmer" }).click();
    return page.getByRole("dialog");
  };
  const fillRequired = async (page: Page, phone = "0700000109") => {
    const dialog = await open(page);
    await dialog.getByLabel("Grower number").fill("TEST000009");
    await dialog.getByLabel("Full name").fill("Test Farmer Nine");
    await dialog.getByLabel("Phone").fill(phone);
    return dialog;
  };
  const submit = (page: Page) => page.getByRole("dialog").getByRole("button", { name: "Register", exact: true }).click();

  test("posts one farmer to the farmers endpoint (not the bulk one), the phone as typed, and shows them registered", async ({ page }) => {
    const sent = await stub(page);
    const dialog = await fillRequired(page);
    await dialog.getByLabel("Factory").fill("Test Factory A");
    await submit(page);
    await expect(dialog.getByTestId("registered")).toContainText("TEST000009 is registered and awaiting activation");
    const post = sent.find((s) => s.method === "POST")!;
    expect(post.path).toBe("/farmers");
    // Only what was filled: no empty national ID.
    expect(JSON.parse(post.body!)).toEqual({ growerNo: "TEST000009", fullName: "Test Farmer Nine", phone: "0700000109", factory: "Test Factory A" });
    expect(sent.some((s) => s.path.startsWith("/bulk-loads") && s.method === "POST")).toBe(false);
  });

  test("already registered with the same phone (200): says so, nothing changed", async ({ page }) => {
    await stub(page, { register: { status: 200, body: farmer("TEST000009", "ACTIVATED") } });
    const dialog = await fillRequired(page, "+254700000109");
    await submit(page);
    await expect(dialog.getByTestId("registered")).toContainText("was already registered with this phone");
    await expect(dialog.getByTestId("registered")).toContainText("Stage: Activated");
  });

  test("grower number, name and phone are needed; national ID and factory are not", async ({ page }) => {
    await stub(page);
    const dialog = await open(page);
    await dialog.getByLabel("Grower number").fill("TEST000009");
    await expect(dialog.getByTestId("form-problem")).toContainText("Grower number, full name and phone are needed.");
    await expect(dialog.getByRole("button", { name: "Register", exact: true })).toBeDisabled();
    await dialog.getByLabel("Full name").fill("Test Farmer Nine");
    await dialog.getByLabel("Phone").fill("not a phone");
    await expect(dialog.getByTestId("form-problem")).toContainText("does not look like a phone number");
    await dialog.getByLabel("Phone").fill("254700000109");
    await expect(dialog.getByRole("button", { name: "Register", exact: true })).toBeEnabled();
  });

  test("a clash (409) or a bad value (400) is shown as omnichannel sent it", async ({ page }) => {
    await stub(page, { register: { status: 409, body: envelope(409, "Grower TEST000009 is held with a different phone") } });
    const dialog = await fillRequired(page);
    await submit(page);
    await expect(dialog.getByRole("alert")).toContainText("held with a different phone");
  });

  test("an environment without the endpoint says so", async ({ page }) => {
    await stub(page, { register: NO_ENDPOINT });
    const dialog = await fillRequired(page);
    await submit(page);
    await expect(dialog.getByTestId("not-available")).toContainText("Not available on this environment yet");
  });
});

test("the three sample files carry the same five test growers, and every column each step needs", () => {
  const rows = (flow: BulkFlow) => sample(flow).trim().split(/\r?\n/).map((l) => l.split(","));
  for (const flow of ["REGISTRATION", "ACTIVATION", "PAYMENT"] as BulkFlow[]) {
    const [header, ...body] = rows(flow);
    for (const c of COLUMNS[flow].required) expect(header).toContain(c);
    expect(body.map((r) => r[header.indexOf("grower_no")])).toEqual(["TEST000001", "TEST000002", "TEST000003", "TEST000004", "TEST000005"]);
  }
  const [header, ...body] = rows("ACTIVATION");
  expect(body.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[header.indexOf("date_of_birth")]))).toBe(true);
});
