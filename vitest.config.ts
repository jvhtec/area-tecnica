import { configDefaults, defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const environmentGlobs = [
  "**/components/**/*.test.{ts,tsx}",
  "**/src/utils/flex-folders/**/__tests__/**/*.test.{ts,tsx}",
]
const excludedGlobs = [
  ...configDefaults.exclude,
  "tests/e2e/**",
  "playwright-report/**",
  "test-results/**",
]

export default defineConfig({
  test: {
    // Default to node environment for faster tests
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: excludedGlobs,
    projects: [
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: environmentGlobs,
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          exclude: [...excludedGlobs, ...environmentGlobs],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}", "supabase/functions/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/test/**",
        "src/vite-env.d.ts",
        "supabase/functions/**/__tests__/**",
        "tests/**",
      ],
      thresholds: {
        "supabase/functions/_shared/auth.ts": {
          branches: 75, functions: 100, lines: 90, statements: 90,
        },
        "supabase/functions/_shared/rateLimit.ts": {
          branches: 75, functions: 100, lines: 90, statements: 90,
        },
        "supabase/functions/_shared/hojaLinkToken.ts": {
          branches: 75, functions: 100, lines: 95, statements: 95,
        },
        "supabase/functions/_shared/emailHtmlPolicy.ts": {
          branches: 100, functions: 100, lines: 100, statements: 100,
        },
        "supabase/functions/_shared/memoriaSecurity.ts": {
          branches: 90, functions: 100, lines: 95, statements: 95,
        },
        "src/services/deleteJobAssignments.ts": {
          branches: 80,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        "src/services/jobDeletionService.ts": {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        "supabase/functions/staffing-orchestrator/policyUtils.ts": {
          branches: 75,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        "supabase/functions/_shared/flexFetch.ts": {
          branches: 85,
          functions: 100,
          lines: 90,
          statements: 90,
        },
        "supabase/functions/_shared/whatsappQuota.ts": {
          branches: 75,
          functions: 100,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
