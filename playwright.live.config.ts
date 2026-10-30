import { defineConfig, devices } from "@playwright/test";

/* Read-only check of Baracel Unyt on a deployed BO Admin (UAT). Opt-in: every
 * test skips unless BO_URL, BO_ADMIN_EMAIL and BO_ADMIN_PASS are set, so it
 * never runs in CI by accident. It signs in and only reads: any other write the
 * pages attempt is blocked and fails the run.
 *
 *   set -a; source <path to an env file you keep outside the repo>; set +a
 *   npm run test:e2e:live
 *
 * Never commit the credentials. */
export default defineConfig({
  testDir: "./e2e-live",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BO_URL,
    // UAT sits behind a self-signed certificate.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "live", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
