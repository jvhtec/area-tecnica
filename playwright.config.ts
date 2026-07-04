import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `VITE_SUPABASE_URL=${baseURL}/supabase VITE_SUPABASE_ANON_KEY=test-anon-key npm run dev -- --host 127.0.0.1 --port ${port}`,
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
      },
    },
  ],
});
