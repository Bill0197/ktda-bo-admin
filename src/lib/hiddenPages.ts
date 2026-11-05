/* Pages the KTDA back office does not show: the investment-only pages of the
   back office it was copied from. They are hidden, not deleted, so later
   changes from that codebase still merge: the routes stay registered (a
   direct link still opens them), they leave the navigation (navConfig.tsx)
   and every role's page list (mock/fixtures/admin.ts). Delete a page only
   once that is agreed, then drop it from here. */

export const HIDDEN_PAGES: ReadonlySet<string> = new Set([
  // Farmer Services: the demo farmer register. The live one is the engine's,
  // under Baracel Unyt (/token-console/investors, labelled Farmers).
  "/clients",
  // Client Services and Business Development: investment sales
  // Tokenization Compliance
  // Baracel Unyt: the investment products and their pricing
  "/token-console/policies", "/token-console/funds",
  // Market Conduct
  // Institutional Investment Compliance
  // Finance and Investments: fund accounting
  // Investment Management
  
  // Institutional Funds
  "/institutional/clients", "/institutional/mandates", "/institutional/portfolios",
  "/institutional/fees", "/institutional/reporting",
  // Platform
  "/catalogue",
]);

export const isHiddenPage = (path: string) => HIDDEN_PAGES.has(path);
