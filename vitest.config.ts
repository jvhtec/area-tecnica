import { configDefaults, defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    // Default to node environment for faster tests
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "tests/e2e/**",
      "playwright-report/**",
      "test-results/**",
    ],
    // Allow per-file environment configuration via comments
    environmentMatchGlobs: [
      // Use jsdom for component tests
      ["**/components/**/*.test.{ts,tsx}", "jsdom"],
      // Some utilities interact with the DOM (e.g. openFlexElementSync, toast libs)
      ["**/src/utils/flex-folders/**/__tests__/**/*.test.{ts,tsx}", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      all: true,
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
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
