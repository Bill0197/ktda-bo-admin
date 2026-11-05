import { expect, test, type Page } from "@playwright/test";
import { json, signIn } from "./stubs";
import { HIDDEN_PAGES } from "../src/lib/hiddenPages";

/* The KTDA shell: placeholder branding, the trimmed navigation, and the
 * investment pages hidden from it but still reachable by their address. */

const nav = (page: Page) => page.locator("aside nav, aside").first();

test("the sign-in page is KTDA's, with nothing of the source back office", async ({ page }) => {
  await page.route(/\/tok\//, (route) => json(route, { error: "signed out" }, 401));
  await page.route(/\/omni\//, (route) => json(route, {}, 404));
  await page.goto("/login");
  await expect(page).toHaveTitle("KTDA Back Office");
  await expect(page.getByRole("img", { name: "KTDA Back Office" })).toBeVisible();
  await expect(page.getByText("KTDA Digital Tea Payment Solution")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Investcent|Investment Bank|Capital Markets Authority/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/");
    await expect(page.getByRole("img", { name: "KTDA Back Office" }).first()).toBeVisible();
  });

  test("the sidebar is KTDA's: no Investcent name or regulator line", async ({ page }) => {
    await expect(page.locator("aside").first()).toContainText("KTDA Digital Tea Payment Solution.");
    await expect(page.locator("body")).not.toContainText(/Investcent|Capital Markets Authority/);
  });

  test("Farmer Payments and Farmers are in the menu", async ({ page }) => {
    const menu = nav(page);
    await menu.getByRole("button", { name: "Farmer Payments" }).click();
    await expect(menu.getByRole("link", { name: "Bulk onboarding" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Bulk payments" })).toBeVisible();
    await menu.getByRole("button", { name: "Farmer Services" }).click();
    await expect(menu.getByRole("link", { name: "Farmers", exact: true })).toHaveAttribute("href", "/clients");
    await expect(menu.getByRole("link", { name: "Clients", exact: true })).toHaveCount(0);
  });

  test("no hidden page has a menu link, and no investment section is left", async ({ page }) => {
    const hrefs = await page.locator("aside a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.filter((h) => h && HIDDEN_PAGES.has(h))).toEqual([]);
    for (const section of ["Investment Management", "Institutional Funds", "Market Conduct", "Tokenization Compliance", "Investments"]) {
      await expect(nav(page).getByRole("button", { name: section, exact: true })).toHaveCount(0);
    }
  });

  test("a hidden page still opens by its address", async ({ page }) => {
    await page.goto("/bond-ladder");
    await expect(page.getByText("Access denied")).toHaveCount(0);
    await expect(page.locator("main h1").first()).toBeVisible();
  });

  test("the Farmers page and its record say farmers", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "Farmers", level: 1 })).toBeVisible();
    await expect(page.getByText(/of \d+ farmers/)).toBeVisible();
  });
});
