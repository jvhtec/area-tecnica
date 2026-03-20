import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

import {
  logSecurityEvent,
  logSuspiciousActivity,
} from "../security-audit";

describe("security-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("invokes the edge function with sanitized metadata", async () => {
    await logSecurityEvent({
      user_id: null,
      action: "auth_login",
      resource: "authentication",
      severity: "low",
      metadata: {
        at: new Date("2026-03-20T18:00:00.000Z"),
        failure: new Error("boom"),
        unsupported: () => "skip",
      },
    });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      "security-audit",
      expect.objectContaining({
        body: expect.objectContaining({
          user_id: null,
          action: "auth_login",
          resource: "authentication",
          severity: "low",
          metadata: {
            at: "2026-03-20T18:00:00.000Z",
            failure: {
              name: "Error",
              message: "boom",
            },
            unsupported: null,
          },
        }),
      }),
    );
  });

  it("swallows invoke failures", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("failed"),
    });

    await expect(
      logSecurityEvent({
        user_id: "user-1",
        action: "auth_logout",
        resource: "authentication",
        severity: "low",
      }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("includes the activity string in suspicious activity metadata", async () => {
    await logSuspiciousActivity("user-1", "unexpected_permission_escalation", {
      source: "tests",
    });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      "security-audit",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "suspicious_activity",
          metadata: expect.objectContaining({
            activity: "unexpected_permission_escalation",
            source: "tests",
          }),
        }),
      }),
    );
  });
});
