import { describe, expect, it } from "vitest";

import { normalizeInternalPath, resolvePostAuthPath } from "./internalNavigation";

describe("internal navigation", () => {
  it("preserves a local path, query, and hash", () => {
    expect(normalizeInternalPath("/dashboard?showMessages=true#latest"))
      .toBe("/dashboard?showMessages=true#latest");
  });

  it.each([
    "https://outside.invalid/path",
    "//outside.invalid/path",
    "/\\outside.invalid/path",
    "/%5coutside.invalid/path",
    "/%2e%2e//outside.invalid",
    " /dashboard",
  ])("rejects unsafe paths", (path) => {
    expect(normalizeInternalPath(path)).toBeNull();
  });

  it("falls back for auth loops and invalid return paths", () => {
    expect(resolvePostAuthPath("/auth?returnTo=%2Fdashboard", "/dashboard"))
      .toBe("/dashboard");
    expect(resolvePostAuthPath("https://outside.invalid", "/tech-app"))
      .toBe("/tech-app");
  });
});
