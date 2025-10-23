import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    include: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx"],
    css: false,
    mockReset: true,
    restoreMocks: true,
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
  },
});
