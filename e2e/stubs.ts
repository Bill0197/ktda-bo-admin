import type { Page, Route } from "@playwright/test";

/* Stubbed services for BO Admin's browser tests. `signIn` must run first in
 * every test: its catch-alls make sure no call leaves the browser (the dev
 * proxy would otherwise forward it to UAT). Playwright tries the most
 * recently added route first, so the specific stubs added after it win. */

export const STAFF = { email: "amina@baracel.ae", fullName: "Amina Ops" };
/** What omnichannel records for the signed-in staff member. */
export const ME = `staff:${STAFF.email}`;
export const OTHER = "staff:brian@baracel.ae";

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** The omnichannel error envelope. */
export const envelope = (status: number, message: string, code?: string, field?: string) => ({
  timestamp: new Date().toISOString(), status, error: "Conflict", message, ...(code ? { code } : {}), ...(field ? { field } : {}),
});

export async function signIn(page: Page) {
  await page.route(/\/tok\//, (route) => json(route, []));
  await page.route(/\/omni\//, (route) => json(route, { message: "Not stubbed" }, 404));
  await page.route(/\/tok\/auth\/me$/, (route) => json(route, { email: STAFF.email, fullName: STAFF.fullName, roles: ["ADMIN"], admin: true }));
}

export async function stubOfferings(page: Page) {
  await page.route(/\/tok\/accounting\/offerings$/, (route) => json(route, [
    { offeringId: "OF-A", assetId: "asset-a", productId: "BOND-A", status: "OPEN", currency: "KES" },
    { offeringId: "OF-B", assetId: "asset-b", productId: "BOND-B", status: "OPEN", currency: "KES" },
  ]));
  await page.route(/\/tok\/accounting\/assets(\?.*)?$/, (route) => json(route, [
    { assetId: "asset-a", name: "IFB1/2023/17" },
    { assetId: "asset-b", name: "FXD1/2024/10" },
  ]));
}
