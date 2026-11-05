/* Pages the KTDA back office keeps but does not show. The routes stay
   registered (a direct link still opens them); they leave the navigation
   (navConfig.tsx) and every role's page list (mock/fixtures/admin.ts). The
   investment-only pages that used to be listed here have been deleted. */

export const HIDDEN_PAGES: ReadonlySet<string> = new Set([
  // Farmer Services: the demo farmer register. The live one is the engine's,
  // under Baracel Unyt (/token-console/investors, labelled Farmers). Demo
  // pages (screening, KYC, cases) still link to its records.
  "/clients",
  // Baracel Unyt: kept for KTDA requirements (Policies drive the batch runs;
  // Funds is where institutions are created and given a tariff domain).
  "/token-console/policies", "/token-console/funds",
]);

export const isHiddenPage = (path: string) => HIDDEN_PAGES.has(path);
