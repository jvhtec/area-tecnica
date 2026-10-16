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

import { scopeIdsFromPayload, useJobScopedRealtime } from "@/hooks/realtime/useJobScopedRealtime";
import { useJobCardsRealtime } from "@/features/jobs/job-card-new/useJobCardsRealtime";
import { useMatrixJobsRealtime } from "@/pages/job-assignment-matrix/useMatrixJobsRealtime";
import { useSkillCatalogRealtime } from "@/hooks/realtime/useSkillCatalogRealtime";

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

  it("reads the scope ids from the new row and the old one", () => {
    expect(scopeIdsFromPayload({ new: { job_id: "a" } }, "job_id")).toEqual(["a"]);
    expect(scopeIdsFromPayload({ new: {}, old: { job_id: "b" } }, "job_id")).toEqual(["b"]);
    expect(scopeIdsFromPayload({ new: { job_id: "a" }, old: { job_id: "a" } }, "job_id")).toEqual(["a"]);
    expect(scopeIdsFromPayload({ new: { job_id: "a" }, old: { job_id: "b" } }, "job_id")).toEqual(["a", "b"]);
    expect(scopeIdsFromPayload({ new: { job_id: "a" } }, null)).toEqual([]);
  });

  it("refreshes both cards when a row moves to another job", () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useJobCardsRealtime(), { wrapper });

    emit("logistics_events", { new: { job_id: "job-new" }, old: { job_id: "job-old" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["logistics-events-for-job", "job-new"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["logistics-events-for-job", "job-old"] });
  });

  it("covers WhatsApp groups and calculator defaults per card", () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useJobCardsRealtime(), { wrapper });

    emit("job_whatsapp_groups", { new: { job_id: "job-3" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["job-whatsapp-group", "job-3"] });
    emit("tour_default_sets", { new: { tour_id: "tour-9" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tour-default-exists", "tour-9"] });
    emit("transport_request_items", { new: { request_id: "req-1" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["transport-request"] });
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

  it("keeps job columns, required personnel, technicians, skills and fridge live", () => {
    const { wrapper } = setup();
    const { unmount } = renderHook(() => useMatrixJobsRealtime(), { wrapper });

    expect(manager.subscriptions.map((s) => [s.table, s.queryKey])).toEqual([
      ["jobs", ["optimized-matrix-jobs"]],
      ["job_departments", ["optimized-matrix-jobs"]],
      ["job_date_types", ["optimized-matrix-jobs"]],
      ["job_required_roles", ["matrix-open-slots"]],
      ["job_required_roles", ["matrix-staffing-summary"]],
      ["job_assignments", ["matrix-staffing-summary"]],
      ["profiles", ["optimized-matrix-technicians"]],
      ["profile_skills", ["optimized-matrix-technicians"]],
      ["skills", ["optimized-matrix-technicians"]],
      ["skills", ["skill_catalog"]],
      ["profiles", ["technician-fridge-status"]],
      ["technician_fridge", ["technician-fridge-status"]],
    ]);
    const owner = manager.subscriptions[0]?.options.ownerRoute;
    expect(manager.subscriptions.every((s) => s.options.ownerRoute === owner)).toBe(true);

    unmount();
    expect(manager.cleaned).toEqual([owner]);
  });
});

describe("useSkillCatalogRealtime", () => {
  beforeEach(() => {
    manager.subscriptions = [];
    manager.cleaned = [];
  });

  it("refreshes the shared skill catalog and role mappings on any change", () => {
    const { wrapper } = setup();
    const { unmount } = renderHook(() => useSkillCatalogRealtime(), { wrapper });

    expect(manager.subscriptions.map((s) => [s.table, s.queryKey])).toEqual([
      ["skills", ["skill_catalog"]],
      ["role_skill_mapping", ["role_skill_mappings"]],
    ]);
    // Default (prefix) invalidation, so ['skill_catalog', 'active'] refreshes too.
    expect(manager.subscriptions.every((s) => s.options.invalidateOnPayload === undefined)).toBe(true);

    const owner = manager.subscriptions[0]?.options.ownerRoute;
    unmount();
    expect(manager.cleaned).toEqual([owner]);
  });

  it("does not subscribe while disabled", () => {
    const { wrapper } = setup();
    renderHook(() => useSkillCatalogRealtime(false), { wrapper });
    expect(manager.subscriptions).toHaveLength(0);
  });
});
