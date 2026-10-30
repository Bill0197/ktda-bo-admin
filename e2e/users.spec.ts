import { expect, test, type Page } from "@playwright/test";
import { json } from "./stubs";
import { sentFrom, stubUnyt, type Sent } from "./unyt-fixtures";
import type { AdminUserResponse } from "../src/lib/tokenConsole/types.gen";

/* Tokenization users: who may sign in to BO Admin. Signups are approved or
 * rejected here, accounts disabled and re-enabled, and the per-account session
 * limit set — all on the engine's /admin API, which only an ADMIN may call. */

const AT = "2026-10-28T08:00:00Z";
const user = (id: string, email: string, status: string, over: Partial<AdminUserResponse> = {}): AdminUserResponse => ({
  id, email, fullName: email.split("@")[0], status, roles: ["ACCOUNTANT"], root: false, createdAt: AT, ...over,
});

type Book = { users: AdminUserResponse[]; limit: number; sent: Sent[]; refuse?: string };

async function stubUsers(page: Page, book: Book) {
  await stubUnyt(page, "data");
  await page.route(/\/tok\/admin\/users$/, (route) => json(route, book.users));
  await page.route(/\/tok\/admin\/users\/[^/]+\/(approve|reject|enable|disable)$/, (route) => {
    const s = sentFrom(route);
    book.sent.push(s);
    if (book.refuse) return json(route, { error: book.refuse }, 409);
    const [, , , id, action] = s.path.split("/");
    const u = book.users.find((x) => x.id === id)!;
    u.status = { approve: "ACTIVE", reject: "REJECTED", enable: "ACTIVE", disable: "DISABLED" }[action]!;
    return json(route, u);
  });
  await page.route(/\/tok\/admin\/config$/, (route) => {
    if (route.request().method() === "GET") return json(route, { maxConcurrentSessions: book.limit });
    const s = sentFrom(route);
    book.sent.push(s);
    book.limit = (s.body as { maxConcurrentSessions: number }).maxConcurrentSessions;
    return json(route, { maxConcurrentSessions: book.limit });
  });
}

const row = (page: Page, email: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: "Accounts", exact: true }) }).getByRole("row").filter({ hasText: email });

async function open(page: Page) {
  await page.goto("/token-console/users");
  await expect(page.getByRole("heading", { name: "Tokenization users", level: 1 })).toBeVisible();
}

test("a pending signup is approved at once, and the list is read again", async ({ page }) => {
  const book: Book = { users: [user("U-1", "amina@baracel.ae", "ACTIVE", { roles: ["ADMIN"] }), user("U-2", "peter@baracel.ae", "PENDING")], limit: 0, sent: [] };
  await stubUsers(page, book);
  await open(page);
  await row(page, "peter@baracel.ae").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("peter@baracel.ae: approved.")).toBeVisible();
  expect(book.sent.map((s) => `${s.method} ${s.path}`)).toEqual(["POST /admin/users/U-2/approve"]);
  await expect(row(page, "peter@baracel.ae").getByRole("button", { name: "Disable" })).toBeVisible();
});

test("rejecting a signup and disabling an account ask first; enabling does not", async ({ page }) => {
  const book: Book = {
    users: [user("U-2", "peter@baracel.ae", "PENDING"), user("U-3", "joy@baracel.ae", "ACTIVE"), user("U-4", "sam@baracel.ae", "DISABLED")],
    limit: 0, sent: [],
  };
  await stubUsers(page, book);
  await open(page);

  await row(page, "peter@baracel.ae").getByRole("button", { name: "Reject" }).click();
  const reject = page.getByRole("dialog", { name: "Reject this signup?" });
  await expect(reject).toContainText("peter@baracel.ae will not be able to sign in.");
  await reject.getByRole("button", { name: "Cancel" }).click();
  expect(book.sent).toEqual([]);

  await row(page, "joy@baracel.ae").getByRole("button", { name: "Disable" }).click();
  await page.getByRole("dialog", { name: "Disable this account?" }).getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText("joy@baracel.ae: disabled.")).toBeVisible();

  await row(page, "sam@baracel.ae").getByRole("button", { name: "Enable" }).click();
  await expect(page.getByText("sam@baracel.ae: enabled.")).toBeVisible();

  expect(book.sent.map((s) => s.path)).toEqual(["/admin/users/U-3/disable", "/admin/users/U-4/enable"]);
});

test("there is no way to lock out yourself or the root account", async ({ page }) => {
  const book: Book = {
    users: [user("U-1", "amina@baracel.ae", "ACTIVE", { roles: ["ADMIN"] }), user("U-0", "root@baracel.ae", "ACTIVE", { root: true, roles: ["ADMIN"] })],
    limit: 0, sent: [],
  };
  await stubUsers(page, book);
  await open(page);
  await expect(row(page, "amina@baracel.ae").getByRole("button")).toHaveCount(0);
  await expect(row(page, "amina@baracel.ae")).toContainText("You");
  await expect(row(page, "root@baracel.ae").getByRole("button")).toHaveCount(0);
  await expect(row(page, "root@baracel.ae")).toContainText("Root");
});

test("the engine's refusal is shown and nothing changes", async ({ page }) => {
  const book: Book = { users: [user("U-2", "peter@baracel.ae", "PENDING")], limit: 0, sent: [], refuse: "This signup was already decided" };
  await stubUsers(page, book);
  await open(page);
  await row(page, "peter@baracel.ae").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("This signup was already decided")).toBeVisible();
  await expect(page.getByText("peter@baracel.ae: approved.")).toHaveCount(0);
});

test("the session limit takes a whole number, is saved, and the page says what it now means", async ({ page }) => {
  const book: Book = { users: [], limit: 0, sent: [] };
  await stubUsers(page, book);
  await open(page);
  await expect(page.getByText("Unlimited — an account can be signed in anywhere at once.")).toBeVisible();
  await page.getByRole("button", { name: "Change limit" }).click();
  const form = page.getByRole("dialog", { name: "Sessions per account" });
  await form.getByLabel(/^Limit/).fill("-1");
  await expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(form).toContainText("A whole number, 0 or more.");
  await form.getByLabel(/^Limit/).fill("2");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Session limit saved.")).toBeVisible();
  expect(book.sent.map((s) => `${s.method} ${s.path}`)).toEqual(["PUT /admin/config"]);
  expect(book.sent[0].body).toEqual({ maxConcurrentSessions: 2 });
  await expect(page.getByText(/^2 at a time\./)).toBeVisible();
});

test("someone without ADMIN on the engine is told so and offered no account actions", async ({ page }) => {
  await stubUnyt(page, "data");
  await page.route(/\/tok\/auth\/me$/, (route) => json(route, { email: "joy@baracel.ae", fullName: "Joy", roles: ["ACCOUNTANT"], admin: false }));
  await open(page);
  await expect(page.getByText("This page needs the ADMIN role on the tokenization service.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change limit" })).toHaveCount(0);
  await expect(page.getByText("peter@baracel.ae")).toHaveCount(0);
});
