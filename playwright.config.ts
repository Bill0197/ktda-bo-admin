import { defineConfig, devices } from "@playwright/test";

/* Browser tests of BO Admin pages against stubbed services (page.route):
 * nothing a test does reaches the tokenization service or omnichannel. Every
 * spec installs a catch-all stub first (see e2e/stubs.ts), so a call a page
 * makes that the spec did not expect answers 404 instead of going to UAT.
 *
 *   npm run test:e2e
 *
 * Its own port and Vite cache, so a dev server already running on 5174 is
 * left alone. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5185",
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npm run dev -- --port 5185 --strictPort",
    url: "http://localhost:5185",
    reuseExistingServer: false,
    // Its own Vite cache: re-optimizing into the shared node_modules/.vite
    // would break a dev server already running from this tree.
    env: { BO_ADMIN_VITE_CACHE_DIR: "node_modules/.vite-e2e" },
    timeout: 60_000,
  },
});
