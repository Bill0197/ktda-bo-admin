import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, OTHER, envelope, json, signIn } from "./stubs";
import { customerSummary, reportingRuns, surveillanceAlerts } from "./unyt-fixtures";

/* Reports and Surveillance: the reporting service through omnichannel. */

const ALERT = surveillanceAlerts[0];
const NOT_CONFIGURED = "Reports and alerts are not available: the reporting service is not configured (omnichannel.reporting.enabled)";
const R = /\/omni\/api\/operator\/reporting/;

const reportingPath = (route: Route) => new URL(route.request().url()).pathname.replace(/^\/omni\/api\/operator\/reporting/, "");

type Sent = { method: string; path: string; query: URLSearchParams; body: unknown; subject?: string };

/** Answers the reporting calls from `state`, recording every one. */
async function stubReporting(page: Page, opts: {
  alerts?: () => unknown[];
  onPost?: (path: string, query: URLSearchParams, body: unknown) => { status: number; body: unknown };
  onReport?: (path: string, query: URLSearchParams) => { status: number; body: string; filename?: string };
} = {}) {
  const sent: Sent[] = [];
  await page.route(R, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = reportingPath(route);
    let body: unknown = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    sent.push({ method: req.method(), path, query: url.searchParams, body, subject: req.headers()["x-dev-subject"] });
    if (req.method() === "POST") {
      const { status, body: out } = opts.onPost?.(path, url.searchParams, body) ?? { status: 500, body: {} };
      return json(route, out, status);
    }
    if (path === "/alerts") return json(route, opts.alerts?.() ?? surveillanceAlerts);
    if (path.startsWith("/alerts/")) return json(route, (opts.alerts?.() ?? surveillanceAlerts)[0]);
    if (path === "/runs") return json(route, reportingRuns);
    if (path.startsWith("/reports/")) {
      const r = opts.onReport?.(path, url.searchParams) ?? { status: 200, body: "a,b\n1,2\n" };
      if (r.status !== 200) return json(route, envelope(r.status, r.body), r.status);
      return route.fulfill({
        status: 200, contentType: "text/csv", body: r.body,
        headers: { "Content-Disposition": `attachment; filename="${r.filename ?? "report.csv"}"` },
      });
    }
    return json(route, { message: "Not stubbed" }, 404);
  });
  await page.route(new RegExp(`/omni/api/operator/customers/${customerSummary.profileId}$`), (route) => json(route, customerSummary));
  return sent;
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("while reporting is not switched on, both pages say so and offer nothing to run", async ({ page }) => {
  await page.route(R, (route) => json(route, envelope(503, NOT_CONFIGURED), 503));
  await page.goto("/token-console/surveillance");
  await expect(page.getByText("Reporting is not switched on yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Snapshot now" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run rules now" })).toBeDisabled();
  await expect(page.getByText("Could not load")).toHaveCount(0);

  await page.goto("/token-console/reports");
  await expect(page.getByText("Reporting is not switched on yet")).toBeVisible();
  for (const card of ["transactions", "holdings", "token-supply", "suspicious-activity"]) {
    await expect(page.getByTestId(`report-${card}`).getByRole("button", { name: "Download CSV" })).toBeDisabled();
  }
});

test("an omnichannel without the reporting endpoints (404) reads as unavailable, not as a broken page", async ({ page }) => {
  await page.route(R, (route) => json(route, envelope(404, "No static resource api/operator/reporting/alerts."), 404));
  await page.goto("/token-console/surveillance");
  await expect(page.getByText("Reporting is unavailable")).toBeVisible();
  await expect(page.getByText("does not serve reports and alerts yet")).toBeVisible();
  await expect(page.getByText("Could not load")).toHaveCount(0);
});

test("an alert opens with the customer's name, is assigned to me and closed with a note", async ({ page }) => {
  let alert = { ...ALERT };
  const sent = await stubReporting(page, {
    alerts: () => [alert],
    onPost: (path, _q, body) => {
      if (path.endsWith("/assign")) alert = { ...alert, status: "ASSIGNED", assigned_to: ME };
      if (path.endsWith("/close")) alert = { ...alert, status: "CLOSED", closed_by: ME, close_note: (body as { note?: string }).note ?? null, closed_at: new Date().toISOString() };
      return { status: 200, body: alert };
    },
  });
  await page.goto("/token-console/surveillance");
  await page.getByText(ALERT.summary).first().click();
  const panel = page.getByTestId("alert-panel");
  await expect(panel.getByRole("link", { name: "Alice Wanjiru" })).toHaveAttribute("href", `/token-console/customers?id=${ALERT.subject_id}`);
  await expect(panel).toContainText("threshold 10000");

  await panel.getByRole("button", { name: "Assign to me" }).click();
  // The panel stays on the alert though it has left the Open tab.
  await expect(panel.getByText("Assigned to you.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Assign to me" })).toHaveCount(0);

  await panel.getByRole("button", { name: "Close with a note" }).click();
  await page.getByLabel("What was found").fill("Salary split across two phones; documented.");
  await page.getByRole("button", { name: "Close alert" }).click();
  await expect(panel.getByText("Salary split across two phones; documented.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close with a note" })).toHaveCount(0);

  const posts = sent.filter((s) => s.method === "POST");
  expect(posts.map((p) => p.path)).toEqual([`/alerts/${ALERT.id}/assign`, `/alerts/${ALERT.id}/close`]);
  expect(posts[1].body).toEqual({ note: "Salary split across two phones; documented." });
  expect(posts.every((p) => p.subject === undefined)).toBe(true);
});

test("someone else closed it first: the 409 is shown and the panel shows it closed", async ({ page }) => {
  const closed = { ...ALERT, status: "CLOSED", closed_by: OTHER, close_note: "Known payroll pattern", closed_at: ALERT.created_at };
  // Someone else closes it the moment this person tries to.
  let current: typeof ALERT = ALERT;
  await stubReporting(page, {
    alerts: () => [current],
    onPost: () => {
      current = closed;
      return { status: 409, body: envelope(409, `Alert ${ALERT.id} is already closed`) };
    },
  });
  await page.goto("/token-console/surveillance");
  await page.getByText(ALERT.summary).first().click();
  const panel = page.getByTestId("alert-panel");
  await panel.getByRole("button", { name: "Close with a note" }).click();
  await page.getByRole("button", { name: "Close alert" }).click();
  await expect(page.getByText("is already closed")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(panel.getByText("Known payroll pattern")).toBeVisible();
  await expect(panel).toContainText("brian@baracel.ae");
});

test("the rules run by hand over a chosen day, and the result is said", async ({ page }) => {
  const sent = await stubReporting(page, { onPost: (_p, q) => ({ status: 200, body: { day: q.get("day"), newAlerts: 1 } }) });
  await page.goto("/token-console/surveillance");
  await page.getByRole("button", { name: "Run rules now" }).click();
  await page.getByLabel("Day").fill("2026-10-27");
  await page.getByRole("button", { name: "Run rules", exact: true }).click();
  await expect(page.getByText("Rules run over 2026-10-27: 1 new alert.")).toBeVisible();
  const post = sent.find((s) => s.method === "POST");
  expect(post?.path).toBe("/runs/surveillance");
  expect(post?.query.get("day")).toBe("2026-10-27");
});

test("a report downloads for one customer and period, under the service's file name", async ({ page }) => {
  await page.route(/\/omni\/api\/operator\/customers(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "X-Total-Pages": "1" }, body: JSON.stringify([customerSummary]) }));
  const sent = await stubReporting(page, {
    onReport: (_p, q) => ({ status: 200, body: "type,id\nPAYMENT,1\n", filename: `transactions-${q.get("from")}-to-${q.get("to")}.csv` }),
  });
  await page.goto("/token-console/reports");
  await page.getByLabel("From").fill("2026-10-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-28");
  await page.getByLabel("Customer: phone, email, investor id or profile id").fill("alice@example.com");
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByTestId("customer-filter")).toContainText("Alice Wanjiru");

  const card = page.getByTestId("report-transactions");
  await expect(card).toContainText("Alice Wanjiru, 2026-10-01 to 2026-10-28");
  const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Download CSV" }).click()]);
  expect(download.suggestedFilename()).toBe("transactions-2026-10-01-to-2026-10-28.csv");
  const call = sent.find((s) => s.path === "/reports/transactions.csv");
  expect(Object.fromEntries(call!.query)).toEqual({ from: "2026-10-01", to: "2026-10-28", customer: customerSummary.profileId });
});

test("a period over 400 days cannot be asked for, and a day with no snapshot says how to get one", async ({ page }) => {
  await stubReporting(page, { onReport: () => ({ status: 404, body: "No holdings snapshot for 2026-10-01" }) });
  await page.goto("/token-console/reports");
  await page.getByLabel("From").fill("2025-01-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-28");
  await expect(page.getByText("At most 400 days per report.")).toBeVisible();
  await expect(page.getByTestId("report-transactions").getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await expect(page.getByTestId("report-token-supply").getByRole("button", { name: "Download CSV" })).toBeEnabled();

  const holdings = page.getByTestId("report-holdings");
  await holdings.getByLabel("As of the end of").fill("2026-10-01");
  await holdings.getByRole("button", { name: "Download CSV" }).click();
  await expect(holdings.getByRole("alert")).toContainText("No holdings snapshot was taken for 2026-10-01");
  await expect(holdings.getByRole("link", { name: "Surveillance → Runs" })).toBeVisible();
});
