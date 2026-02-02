import { defineConfig } from "vitest/config"
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
    // Allow per-file environment configuration via comments
    environmentMatchGlobs: [
      // Use jsdom for component tests
      ["**/components/**/*.test.{ts,tsx}", "jsdom"],
      // Some utilities interact with the DOM (e.g. openFlexElementSync, toast libs)
      ["**/src/utils/flex-folders/**/__tests__/**/*.test.{ts,tsx}", "jsdom"],
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
