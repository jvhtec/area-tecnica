// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { useCalendarIcsToken } from "../useCalendarIcsToken";

describe("useCalendarIcsToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the token from the self-scoped read RPC", async () => {
    rpc.mockResolvedValueOnce({ data: "existing-token", error: null });

    const { result } = renderHook(() => useCalendarIcsToken());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBe("existing-token");
    expect(rpc).toHaveBeenCalledWith("get_my_calendar_ics_token");
  });

  it("treats a missing token row as an empty token so the caller can generate one lazily", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useCalendarIcsToken());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBe("");
  });

  // Regression: the initial read is fired on mount and can still be in flight
  // when the user rotates. If its response is applied afterwards it restores a
  // token the server has already revoked, and the calendar URL 403s until
  // reload. Without the guard in the hook this test fails with "stale-token".
  it("does not let an in-flight initial read overwrite a token that was rotated first", async () => {
    let resolveInitialRead: (value: { data: string | null; error: null }) => void = () => {};
    const pendingInitialRead = new Promise<{ data: string | null; error: null }>((resolve) => {
      resolveInitialRead = resolve;
    });

    rpc.mockImplementation((fn: string) => {
      if (fn === "get_my_calendar_ics_token") return pendingInitialRead;
      if (fn === "rotate_my_calendar_ics_token") {
        return Promise.resolve({ data: "rotated-token", error: null });
      }
      throw new Error(`unexpected rpc: ${fn}`);
    });

    const { result } = renderHook(() => useCalendarIcsToken());

    // Rotate while the initial read has not resolved yet.
    await act(async () => {
      await result.current.rotate();
    });
    expect(result.current.token).toBe("rotated-token");

    // The initial read now lands, carrying the pre-rotation value.
    await act(async () => {
      resolveInitialRead({ data: "stale-token", error: null });
      await pendingInitialRead;
    });

    expect(result.current.token).toBe("rotated-token");
  });

  it("propagates a rotation failure instead of clearing the current token", async () => {
    rpc.mockResolvedValueOnce({ data: "existing-token", error: null });
    const { result } = renderHook(() => useCalendarIcsToken());
    await waitFor(() => expect(result.current.loading).toBe(false));

    rpc.mockResolvedValueOnce({ data: null, error: new Error("nope") });
    await expect(result.current.rotate()).rejects.toThrow("nope");
    expect(result.current.token).toBe("existing-token");
  });
});
