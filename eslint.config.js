import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const baseExtends = [js.configs.recommended, ...tseslint.configs.recommended];
const browserGlobals = {
  ...globals.browser,
  ...globals.node,
};
const denoGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  crypto: "readonly",
  Deno: "readonly",
  Event: "readonly",
  EventTarget: "readonly",
  fetch: "readonly",
  File: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  ReadableStream: "readonly",
  Request: "readonly",
  Response: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  WebSocket: "readonly",
};
const legacyAnyWarnFiles = [
  "src/components/dashboard/**/*.{ts,tsx}",
  "src/components/festival/**/*.{ts,tsx}",
  "src/components/jobs/**/*.{ts,tsx}",
  "src/components/matrix/**/*.{ts,tsx}",
  "src/components/tasks/**/*.{ts,tsx}",
  "src/components/technician/**/*.{ts,tsx}",
  "src/components/tours/**/*.{ts,tsx}",
  "src/hooks/useGlobalTaskMutations.ts",
  "src/hooks/useOptimizedAuth.tsx",
  "src/hooks/useOptimizedJobCard.ts",
  "src/hooks/useOptimizedMatrixData.ts",
  "src/hooks/useTaskMutations.ts",
  "src/lib/tourPdfExport.ts",
  "src/pages/festival-management/**/*.{ts,tsx}",
  "src/pages/JobAssignmentMatrix.tsx",
  "src/pages/wallboard/**/*.{ts,tsx}",
  "src/services/tourRatesExport.ts",
  "src/utils/flex-folders/**/*.{ts,tsx}",
  "src/utils/hoja-de-ruta/**/*.{ts,tsx}",
  "src/utils/tour-scheduling-pdf-enhanced.ts",
  "src/utils/tour-scheduling-pdf.ts",
];

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "ios/App/App.xcarchive/**",
      "playwright-report/**",
      "streamdeck-plugin/streamdeck-sdk.js",
      "test-results/**",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    extends: baseExtends,
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: browserGlobals,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    extends: baseExtends,
    files: ["src/**/__tests__/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: browserGlobals,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    extends: baseExtends,
    files: ["vite.config.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    extends: baseExtends,
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: denoGlobals,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: legacyAnyWarnFiles,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
