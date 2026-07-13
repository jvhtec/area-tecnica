import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_TEST_PORT || 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  // The shared mocked Supabase state and Vite dev server are intentionally
  // process-global; parallel files race and overload the local server.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/e2e/start-test-server.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      // Opt-in mobile-viewport project. Not run by `npm run test:e2e` (CI pins
      // --project=chromium) — use `npm run test:e2e:mobile` or
      // `--project=mobile-chromium` to exercise the app below the 768px
      // mobile/desktop breakpoint (see src/hooks/use-mobile.tsx).
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
  ],
});
