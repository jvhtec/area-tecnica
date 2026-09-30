// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fromMock,
  rpcMock,
  getSessionMock,
  invokeMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getSessionMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getSession: getSessionMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("@/lib/api-config", () => ({
  SUPABASE_URL: "https://project.supabase.test",
  SUPABASE_ANON_KEY: "anon-key",
}));

import {
  ConflictError,
  useCancelStaffingRequest,
  useSendStaffingEmail,
  useStaffingStatus,
} from "../useStaffing";

type BuilderResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

type ThenableBuilder = PromiseLike<BuilderResult> & {
  calls: Array<[string, ...unknown[]]>;
  select: (...args: unknown[]) => ThenableBuilder;
  update: (...args: unknown[]) => ThenableBuilder;
  eq: (...args: unknown[]) => ThenableBuilder;
  neq: (...args: unknown[]) => ThenableBuilder;
  maybeSingle: () => Promise<BuilderResult>;
};

const makeThenableBuilder = (result: BuilderResult): ThenableBuilder => {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = {} as ThenableBuilder;
  builder.calls = calls;
  builder.select = vi.fn((...args: unknown[]) => {
    calls.push(["select", ...args]);
    return builder;
  });
  builder.update = vi.fn((...args: unknown[]) => {
    calls.push(["update", ...args]);
    return builder;
  });
  builder.eq = vi.fn((...args: unknown[]) => {
    calls.push(["eq", ...args]);
    return builder;
  });
  builder.neq = vi.fn((...args: unknown[]) => {
    calls.push(["neq", ...args]);
    return builder;
  });
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
};

const runMutation = async <T,>(mutation: () => Promise<T>) => {
  let value: T | undefined;
  let error: unknown;
  await act(async () => {
    try {
      value = await mutation();
    } catch (caught) {
      error = caught;
    }
  });
  return { value, error };
};

const createHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const refetchSpy = vi.spyOn(queryClient, "refetchQueries");

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, invalidateSpy, refetchSpy, wrapper };
};

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: "session-token" } },
    error: null,
  });
  invokeMock.mockResolvedValue({ data: null, error: null });
});

describe("staffing hooks Phase 1 characterization", () => {
  describe("useStaffingStatus", () => {
    it("maps pending availability and offer states to matrix-facing labels", async () => {
      const rpcBuilder = makeThenableBuilder({
        data: {
          availability_status: "pending",
          offer_status: "pending",
        },
        error: null,
      });
      rpcMock.mockReturnValue(rpcBuilder);

      const { wrapper } = createHarness();
      const { result } = renderHook(
        () => useStaffingStatus("job-1", "tech-1"),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        availability_status: "requested",
        offer_status: "sent",
      });
      expect(rpcMock).toHaveBeenCalledWith(
        "get_assignment_matrix_staffing_filtered",
        {
          p_job_ids: ["job-1"],
          p_profile_ids: ["tech-1"],
        },
      );
    });

    it("treats expired request states as cleared", async () => {
      rpcMock.mockReturnValue(
        makeThenableBuilder({
          data: {
            availability_status: "expired",
            offer_status: "expired",
          },
          error: null,
        }),
      );

      const { wrapper } = createHarness();
      const { result } = renderHook(
        () => useStaffingStatus("job-1", "tech-1"),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        availability_status: null,
        offer_status: null,
      });
    });

    it("falls back to empty status when the RPC returns no row even with an error", async () => {
      rpcMock.mockReturnValue(
        makeThenableBuilder({
          data: null,
          error: { message: "view unavailable" },
        }),
      );

      const { wrapper } = createHarness();
      const { result } = renderHook(
        () => useStaffingStatus("job-1", "tech-1"),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        availability_status: null,
        offer_status: null,
      });
    });

    it("does not query until both job and profile ids exist", async () => {
      const { wrapper } = createHarness();
      const { result } = renderHook(
        () => useStaffingStatus("", "tech-1"),
        { wrapper },
      );

      expect(result.current.fetchStatus).toBe("idle");
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe("useSendStaffingEmail", () => {
    it("sends the authenticated request with the configured anon key", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, staffing_request_id: "req-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useSendStaffingEmail(), { wrapper });

      const payload = {
        job_id: "job-1",
        profile_id: "tech-1",
        phase: "availability" as const,
        channel: "email" as const,
      };

      let response: unknown;
      await act(async () => {
        response = await result.current.mutateAsync(payload);
      });

      expect(response).toEqual({ success: true, staffing_request_id: "req-1" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://project.supabase.test/functions/v1/send-staffing-email",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer session-token",
            apikey: "anon-key",
          },
          body: JSON.stringify(payload),
        }),
      );
    });

    it("surfaces structured 409 conflicts as ConflictError with details", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              error: "Technician unavailable",
              details: {
                conflict_type: "timesheet",
                conflicts: [{ date: "2026-10-10" }],
              },
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useSendStaffingEmail(), { wrapper });

      let caught: unknown;
      await act(async () => {
        try {
          await result.current.mutateAsync({
            job_id: "job-1",
            profile_id: "tech-1",
            phase: "offer",
          });
        } catch (error) {
          caught = error;
        }
      });

      expect(caught).toBeInstanceOf(ConflictError);
      expect(caught).toMatchObject({
        message: "Technician unavailable",
        details: {
          conflict_type: "timesheet",
          conflicts: [{ date: "2026-10-10" }],
        },
      });
    });

    it("uses ordinary HTTP errors for unstructured 409 responses", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Conflict" }), {
            status: 409,
            statusText: "Conflict",
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useSendStaffingEmail(), { wrapper });

      const outcome = await runMutation(() =>
        result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "offer",
        }),
      );
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toBe("Conflict");
    });

    it("treats a 200 response carrying an API error as a failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Logical failure" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useSendStaffingEmail(), { wrapper });

      const outcome = await runMutation(() =>
        result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "availability",
        }),
      );
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toBe("Logical failure");
    });

    it("invalidates all staffing/assignment caches and dispatches staffing-updated on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const eventSpy = vi.fn();
      window.addEventListener("staffing-updated", eventSpy);

      const { wrapper, invalidateSpy } = createHarness();
      const { result } = renderHook(() => useSendStaffingEmail(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "availability",
        });
      });

      expect(invalidateSpy).toHaveBeenCalledTimes(5);
      expect(
        invalidateSpy.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey)),
      ).toEqual(
        expect.arrayContaining([
          JSON.stringify(["staffing", "job-1", "tech-1"]),
          JSON.stringify(["staffing-by-date", "tech-1"]),
          JSON.stringify(["staffing-matrix"]),
          JSON.stringify(["assignment-matrix"]),
          JSON.stringify(["optimized-matrix-assignments"]),
        ]),
      );
      expect(eventSpy).toHaveBeenCalledTimes(1);
      window.removeEventListener("staffing-updated", eventSpy);
    });
  });

  describe("useCancelStaffingRequest", () => {
    it("expires every non-expired request for the exact job/profile/phase tuple", async () => {
      const existingBuilder = makeThenableBuilder({
        data: [
          { id: "req-1", status: "confirmed", single_day: false, target_date: null },
          { id: "req-2", status: "declined", single_day: false, target_date: null },
        ],
        error: null,
      });
      const updateBuilder = makeThenableBuilder({
        data: [{ id: "req-1" }, { id: "req-2" }],
        error: null,
        count: 2,
      });
      fromMock
        .mockReturnValueOnce(existingBuilder)
        .mockReturnValueOnce(updateBuilder);

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useCancelStaffingRequest(), { wrapper });

      let response: unknown;
      await act(async () => {
        response = await result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "offer",
        });
      });

      expect(response).toEqual({ success: true, rowsAffected: 2 });
      expect(updateBuilder.update).toHaveBeenCalledWith({ status: "expired" });
      expect(updateBuilder.calls).toEqual(
        expect.arrayContaining([
          ["eq", "job_id", "job-1"],
          ["eq", "profile_id", "tech-1"],
          ["eq", "phase", "offer"],
          ["neq", "status", "expired"],
          ["select", "id"],
        ]),
      );
    });

    it("returns success with zero affected rows when nothing can be expired", async () => {
      fromMock
        .mockReturnValueOnce(makeThenableBuilder({ data: [], error: null }))
        .mockReturnValueOnce(makeThenableBuilder({ data: [], error: null, count: 0 }));

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useCancelStaffingRequest(), { wrapper });

      const outcome = await runMutation(() =>
        result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "availability",
        }),
      );
      expect(outcome.error).toBeUndefined();
      expect(outcome.value).toEqual({ success: true, rowsAffected: 0 });
    });

    it("propagates the staffing-request update error and does not send cancellation notification", async () => {
      fromMock
        .mockReturnValueOnce(makeThenableBuilder({ data: [], error: null }))
        .mockReturnValueOnce(
          makeThenableBuilder({
            data: null,
            error: new Error("update failed"),
          }),
        );

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useCancelStaffingRequest(), { wrapper });

      const outcome = await runMutation(() =>
        result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "offer",
        }),
      );
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toBe("update failed");
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("ignores cancellation-notification delivery failure after the DB update succeeds", async () => {
      fromMock
        .mockReturnValueOnce(makeThenableBuilder({ data: [], error: null }))
        .mockReturnValueOnce(
          makeThenableBuilder({
            data: [{ id: "req-1" }],
            error: null,
          }),
        );
      invokeMock.mockRejectedValueOnce(new Error("notification unavailable"));

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useCancelStaffingRequest(), { wrapper });

      const outcome = await runMutation(() =>
        result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "offer",
        }),
      );
      expect(outcome.error).toBeUndefined();
      expect(outcome.value).toEqual({ success: true, rowsAffected: 1 });
    });

    it("invalidates/refetches staffing caches and emits both cancellation notification and push on success", async () => {
      fromMock
        .mockReturnValueOnce(makeThenableBuilder({ data: [], error: null }))
        .mockReturnValueOnce(
          makeThenableBuilder({
            data: [{ id: "req-1" }],
            error: null,
          }),
        );

      const eventSpy = vi.fn();
      window.addEventListener("staffing-updated", eventSpy);

      const { wrapper, invalidateSpy, refetchSpy } = createHarness();
      const { result } = renderHook(() => useCancelStaffingRequest(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "availability",
        });
      });

      expect(invalidateSpy).toHaveBeenCalledTimes(5);
      expect(refetchSpy).toHaveBeenCalledWith({
        queryKey: ["staffing-matrix"],
        type: "active",
      });
      expect(invokeMock).toHaveBeenCalledWith("notify-staffing-cancellation", {
        body: {
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "availability",
        },
      });
      expect(invokeMock).toHaveBeenCalledWith("push", {
        body: {
          action: "broadcast",
          type: "staffing.availability.cancelled",
          job_id: "job-1",
          recipient_id: "tech-1",
        },
      });
      expect(eventSpy).toHaveBeenCalledTimes(1);
      window.removeEventListener("staffing-updated", eventSpy);
    });

    it("uses the offer-specific cancellation push type", async () => {
      fromMock
        .mockReturnValueOnce(makeThenableBuilder({ data: [], error: null }))
        .mockReturnValueOnce(
          makeThenableBuilder({
            data: [{ id: "req-1" }],
            error: null,
          }),
        );

      const { wrapper } = createHarness();
      const { result } = renderHook(() => useCancelStaffingRequest(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "offer",
        });
      });

      expect(invokeMock).toHaveBeenCalledWith("push", {
        body: expect.objectContaining({
          type: "staffing.offer.cancelled",
        }),
      });
    });
  });
});
