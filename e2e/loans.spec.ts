import { expect, test, type Page, type Request } from "@playwright/test";
import { json, signIn } from "./stubs";

/* Baracel Unyt → Loans against a stubbed engine (/tok/accounting/loans/*).
 * The stub keeps a tiny loan book so each action's re-read shows its effect;
 * the interest-first split and the refusals are the engine's (LoanService),
 * mirrored here only far enough to drive the page. */

const LOAN = "AC-LOAN-1";
const RATE = { annualRate: 0.15, dayCount: "ACTUAL_365", rateSource: "TD-LOAN-DEFAULT" };

type Book = { principal: number; interest: number; status: string; disbursed: boolean };

const view = (b: Book) => ({
  contractId: LOAN, productId: "LOAN-KES-TERM", currency: "KES",
  status: b.status === "CLOSED" ? "CLOSED" : !b.disbursed ? "PENDING" : b.principal + b.interest === 0 ? "SETTLED" : "ACTIVE",
  outstandingPrincipal: b.principal, outstandingInterest: b.interest, totalOutstanding: b.principal + b.interest,
  pendingApproval: false, ...RATE,
});

async function stubConsole(page: Page) {
  await page.route(/\/tok\/accounting\/products$/, (route) => json(route, [
    { productId: "LOAN-KES-TERM", name: "KES Term Loan", currency: "KES", assetClass: "LOAN" },
    { productId: "BRF-KES-INC", name: "BRF-KES Income Fund", currency: "KES", assetClass: "BOND" },
  ]));
  await page.route(/\/tok\/accounting\/contracts$/, (route) => json(route, [
    { contractId: LOAN, investorRef: "INV-77", productId: "LOAN-KES-TERM", currency: "KES", contractStatus: "ACTIVE", openedAt: "2026-10-29" },
    { contractId: "AC-FUND-1", investorRef: "INV-77", productId: "BRF-KES-INC", currency: "KES", contractStatus: "ACTIVE", openedAt: "2026-10-29" },
  ]));
  await page.route(/\/tok\/accounting\/investors$/, (route) => json(route, []));
}

/** The loan endpoints over `book`; every write is recorded in `sent`. */
async function stubLoan(page: Page, book: Book, sent: { path: string; body: unknown }[]) {
  await page.route(/\/tok\/accounting\/loans\/[^/]+(\/\w+)?$/, (route) => {
    const req: Request = route.request();
    const action = new URL(req.url()).pathname.split("/").pop();
    if (req.method() === "GET") return json(route, view(book));
    const body = req.postDataJSON() as { amount?: number; days?: number };
    sent.push({ path: action ?? "", body });
    switch (action) {
      case "disburse":
        book.principal += body.amount ?? 0;
        book.disbursed = true;
        return json(route, view(book));
      case "accrue":
        book.interest += Math.round(book.principal * 0.15 * (body.days ?? 0) / 365 * 100) / 100;
        return json(route, view(book));
      case "repay": {
        const amount = body.amount ?? 0;
        if (amount > book.principal + book.interest) {
          return json(route, { error: `Repayment ${amount} exceeds the outstanding balance of ${book.principal + book.interest}` }, 400);
        }
        const interestPaid = Math.min(amount, book.interest);
        const principalPaid = Math.round((amount - interestPaid) * 100) / 100;
        book.interest = Math.round((book.interest - interestPaid) * 100) / 100;
        book.principal = Math.round((book.principal - principalPaid) * 100) / 100;
        return json(route, { interestPaid, principalPaid, loan: view(book) });
      }
      case "close":
        book.status = "CLOSED";
        return json(route, view(book));
      default:
        return json(route, { error: "unexpected" }, 500);
    }
  });
}

async function openLoan(page: Page) {
  await page.goto("/token-console/loans");
  await expect(page.getByRole("heading", { name: "Loans" })).toBeVisible();
  await page.getByRole("row").filter({ hasText: LOAN }).click();
  return page.getByRole("dialog");
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await stubConsole(page);
});

test("only loan-product accounts are listed", async ({ page }) => {
  await stubLoan(page, { principal: 0, interest: 0, status: "ACTIVE", disbursed: false }, []);
  await page.goto("/token-console/loans");
  await expect(page.getByRole("row").filter({ hasText: LOAN })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "AC-FUND-1" })).toHaveCount(0);
});

test("disburse → accrue → repay interest first → close", async ({ page }) => {
  const book: Book = { principal: 0, interest: 0, status: "ACTIVE", disbursed: false };
  const sent: { path: string; body: unknown }[] = [];
  await stubLoan(page, book, sent);
  const dialog = await openLoan(page);

  await expect(dialog).toContainText("Pending");
  await expect(dialog).toContainText("TD-LOAN-DEFAULT");

  await dialog.getByLabel("Disburse amount").fill("200000");
  await dialog.getByRole("button", { name: "Disburse" }).click();
  await expect(dialog.getByText("Active", { exact: true })).toBeVisible();

  await dialog.getByLabel("Accrue interest (days)").fill("30");
  await dialog.getByRole("button", { name: "Accrue" }).click();
  await expect(dialog).toContainText("2,465.75");

  await dialog.getByLabel("Repay amount").fill("10000");
  await dialog.getByRole("button", { name: "Repay" }).click();
  await expect(page.getByText(/Repaid — interest .*2,465\.75.*principal .*7,534\.25/)).toBeVisible();

  // Still owed, so Close stays shut and says why.
  await expect(dialog.getByRole("button", { name: "Close loan" })).toBeDisabled();
  await expect(dialog).toContainText("A loan can be closed once nothing is outstanding");

  await dialog.getByLabel("Repay amount").fill("192465.75");
  await dialog.getByRole("button", { name: "Repay" }).click();
  await expect(dialog.getByText("Settled", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close loan" }).click();
  await expect(dialog.getByText("Closed", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Disburse" })).toBeDisabled();

  expect(sent.map((s) => s.path)).toEqual(["disburse", "accrue", "repay", "repay", "close"]);
  expect(sent[0].body).toEqual({ amount: 200000 });
  expect(sent[1].body).toEqual({ days: 30 });
});

test("the engine's refusal is shown as it came", async ({ page }) => {
  await stubLoan(page, { principal: 1000, interest: 0, status: "ACTIVE", disbursed: true }, []);
  const dialog = await openLoan(page);
  await dialog.getByLabel("Repay amount").fill("5000");
  await dialog.getByRole("button", { name: "Repay" }).click();
  await expect(dialog).toContainText("Repayment 5000 exceeds the outstanding balance of 1000");
});

test("a posting held for approval is flagged and blocks closing", async ({ page }) => {
  await page.route(/\/tok\/accounting\/loans\/[^/]+$/, (route) => json(route, {
    ...view({ principal: 0, interest: 0, status: "ACTIVE", disbursed: false }), pendingApproval: true,
  }));
  const dialog = await openLoan(page);
  await expect(dialog).toContainText("Held for approval");
  await expect(dialog.getByRole("button", { name: "Close loan" })).toBeDisabled();
});

test("an engine without the loan endpoints says so instead of 'Not found'", async ({ page }) => {
  // Spring's own 404 (it carries `path`) — the route is not deployed.
  await page.route(/\/tok\/accounting\/loans\/[^/]+$/, (route) => json(route, {
    timestamp: "2026-10-29T08:00:00Z", status: 404, error: "Not Found", path: `/api/accounting/loans/${LOAN}`,
  }, 404));
  const dialog = await openLoan(page);
  await expect(dialog).toContainText("Not available yet");
  await expect(dialog).toContainText("predates the loan endpoints");
  await expect(dialog).not.toContainText("Not found.");
});
