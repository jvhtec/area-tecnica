import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { flexApiFetch } from "./flex-api-client";

describe("flexApiFetch timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("bounds stalled POST header updates", async () => {
    invokeMock.mockReturnValue(new Promise(() => undefined));

    const request = flexApiFetch("/element/element-1/header-update", {
      method: "POST",
      body: JSON.stringify({ fieldType: "name", payloadValue: "Updated" }),
    });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;
  });

  it("does not abandon non-idempotent folder creation", async () => {
    let resolveInvocation: ((value: {
      data: {
        success: boolean;
        status: number;
        data: { elementId: string };
      };
      error: null;
    }) => void) | undefined;
    invokeMock.mockReturnValue(
      new Promise((resolve) => {
        resolveInvocation = resolve;
      })
    );

    const request = flexApiFetch("/element", {
      method: "POST",
      body: JSON.stringify({ name: "New folder" }),
    });

    await vi.advanceTimersByTimeAsync(20_000);
    resolveInvocation?.({
      data: {
        success: true,
        status: 201,
        data: { elementId: "folder-1" },
      },
      error: null,
    });

    await expect(request).resolves.toMatchObject({ ok: true, status: 201 });
  });
});
