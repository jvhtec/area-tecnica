// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (payload: Record<string, unknown>) => void;
const manager = vi.hoisted(() => ({
  subscriptions: [] as Array<{ table: string; queryKey: unknown; priority: string; options: { ownerRoute?: string; onPayload?: Handler; invalidateOnPayload?: boolean } }>,
  cleaned: [] as string[],
}));

vi.mock("@/lib/unified-subscription-manager", () => ({
  UnifiedSubscriptionManager: {
    getInstance: () => ({
      subscribeToTable: (table: string, queryKey: unknown, _filter: unknown, priority: string, options = {}) => {
        manager.subscriptions.push({ table, queryKey, priority, options });
      },
      cleanupRouteDependentSubscriptions: (owner: string) => manager.cleaned.push(owner),
    }),
  },
}));

import { jobIdFromPayload, useJobScopedRealtime } from "@/hooks/realtime/useJobScopedRealtime";
import { useJobCardsRealtime } from "@/features/jobs/job-card-new/useJobCardsRealtime";
import { useMatrixJobsRealtime } from "@/pages/job-assignment-matrix/useMatrixJobsRealtime";

const setup = () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
};

const emit = (table: string, payload: Record<string, unknown>) => {
  const sub = manager.subscriptions.find((s) => s.table === table);
  if (!sub?.options.onPayload) throw new Error(`no handler for ${table}`);
  sub.options.onPayload(payload);
};

describe("useJobScopedRealtime", () => {
  beforeEach(() => {
    manager.subscriptions = [];
    manager.cleaned = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("reads the job id from the new row, or the old one on delete", () => {
    expect(jobIdFromPayload({ new: { job_id: "a" } }, "job_id")).toBe("a");
    expect(jobIdFromPayload({ new: {}, old: { job_id: "b" } }, "job_id")).toBe("b");
    expect(jobIdFromPayload({ new: { job_id: "a" } }, null)).toBeNull();
  });

  it("refreshes only the changed job's card query, at once and once more for a burst", () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useJobCardsRealtime(), { wrapper });

    const folders = manager.subscriptions.find((s) => s.table === "flex_folders");
    expect(folders?.options).toMatchObject({ invalidateOnPayload: false });
    expect(folders?.options.ownerRoute).toMatch(/^job-cards-/);

    emit("flex_folders", { new: { job_id: "job-1" } });
    emit("flex_folders", { new: { job_id: "job-1" } });
    emit("flex_folders", { new: { job_id: "job-1" } });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ["folder-existence", "job-1"] });

    vi.advanceTimersByTime(400);
    expect(invalidate).toHaveBeenCalledTimes(2);

    emit("transport_requests", { new: { job_id: "job-2" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["transport-request", "job-2"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["transport-requests-all", "job-2"] });
  });

  it("falls back to the prefix key when a change carries no job id", () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useJobCardsRealtime(), { wrapper });

    emit("festival_artists", { old: { id: "artist-1" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobcard-artists"] });
    emit("tour_documents", { new: { tour_id: "tour-1" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobcard-tour-documents"] });
  });

  it("releases its subscriptions on unmount and does nothing while disabled", () => {
    const { wrapper } = setup();
    const { unmount } = renderHook(() => useJobScopedRealtime("x", [{ table: "jobs", keys: () => [["k"]] }]), { wrapper });
    const owner = manager.subscriptions[0]?.options.ownerRoute;
    unmount();
    expect(manager.cleaned).toEqual([owner]);

    manager.subscriptions = [];
    renderHook(() => useJobScopedRealtime("y", [{ table: "jobs", keys: () => [["k"]] }], false), { wrapper });
    expect(manager.subscriptions).toHaveLength(0);
  });
});

describe("useMatrixJobsRealtime", () => {
  beforeEach(() => {
    manager.subscriptions = [];
    manager.cleaned = [];
  });

  it("keeps the matrix job columns live from jobs, departments and date types", () => {
    const { wrapper } = setup();
    const { unmount } = renderHook(() => useMatrixJobsRealtime(), { wrapper });

    expect(manager.subscriptions.map((s) => [s.table, s.queryKey])).toEqual([
      ["jobs", ["optimized-matrix-jobs"]],
      ["job_departments", ["optimized-matrix-jobs"]],
      ["job_date_types", ["optimized-matrix-jobs"]],
    ]);
    const owner = manager.subscriptions[0]?.options.ownerRoute;
    expect(manager.subscriptions.every((s) => s.options.ownerRoute === owner)).toBe(true);

    unmount();
    expect(manager.cleaned).toEqual([owner]);
  });
});
