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
  "/tokenization/issuance", "/tokenization/lifecycle", "/tokenization/smart-contracts",
  // Baracel Unyt: the investment products and their pricing
  "/token-console/offerings", "/token-console/assets", "/token-console/products", "/token-console/market",
  "/token-console/prices", "/token-console/fx", "/token-console/unit-ledger", "/token-console/nav",
  "/token-console/policies", "/token-console/funds",
  // Market Conduct
  "/market-conduct/market-abuse", "/market-conduct/conflicts", "/market-conduct/employee-trading",
  // Institutional Investment Compliance
  "/institutional-compliance/breaches", "/institutional-compliance/restrictions",
  "/institutional-compliance/counterparties", "/institutional-compliance/clients",
  // Finance and Investments: fund accounting
  "/nav", "/distributions", "/liquidity", "/bond-ladder",
  // Investment Management
  "/investment/products", "/investment/orders", "/investment/portfolio", "/investment/holdings",
  "/investment/valuations", "/investment/redemptions", "/investment/corporate-actions",
  "/investment/ic-approvals", "/investment/mandates",
  // Institutional Funds
  "/institutional/clients", "/institutional/mandates", "/institutional/portfolios",
  "/institutional/fees", "/institutional/reporting",
  // Platform
  "/catalogue",
]);

export const isHiddenPage = (path: string) => HIDDEN_PAGES.has(path);
