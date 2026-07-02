import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { offlineDb, QUEUE_STORE, SNAPSHOT_STORE, __resetOfflineDbForTests } from "../offline-db";
import { getPendingChanges } from "../festival-offline-queue";
import { syncFestivalPendingChanges } from "../festival-sync";
import {
  OFFLINE_SNAPSHOT_SCHEMA_VERSION,
  type OfflineFestivalSnapshot,
  type OfflinePendingChange,
} from "../types";

const JOB_ID = "job-1";

const buildSnapshot = (): OfflineFestivalSnapshot => ({
  jobId: JOB_ID,
  jobTitle: "Festival Test",
  schemaVersion: OFFLINE_SNAPSHOT_SCHEMA_VERSION,
  downloadedAt: new Date().toISOString(),
  downloadedBy: null,
  data: {
    job: { id: JOB_ID, title: "Festival Test" },
    festivalSettings: null,
    jobDateTypes: [],
    stages: [],
    gearSetups: [],
    stageGearSetups: [],
    artists: [],
    artistFormSubmissions: [],
    artistFiles: [],
    shifts: [],
    shiftAssignments: [],
    logos: [],
    jobDocuments: [],
    hojaVenue: null,
    location: null,
  },
});

const seedChange = async (change: Partial<OfflinePendingChange>): Promise<OfflinePendingChange> => {
  const full: OfflinePendingChange = {
    id: change.id ?? `change-${Math.random().toString(16).slice(2)}`,
    jobId: JOB_ID,
    table: "festival_artists",
    operation: "update",
    recordId: "artist-1",
    payload: { stage: 2 },
    baseUpdatedAt: "2026-07-01T10:00:00Z",
    createdAt: new Date().toISOString(),
    ...change,
  };
  await offlineDb.put(QUEUE_STORE, full);
  return full;
};

describe("syncFestivalPendingChanges", () => {
  beforeEach(async () => {
    __resetOfflineDbForTests();
    resetMockSupabase();
    await offlineDb.put(SNAPSHOT_STORE, buildSnapshot());
  });

  it("applies an update when the server row is unchanged", async () => {
    await seedChange({ operation: "update", baseUpdatedAt: "2026-07-01T10:00:00Z" });

    const selectBuilder = createMockQueryBuilder({
      data: { id: "artist-1", updated_at: "2026-07-01T10:00:00Z" },
      error: null,
    });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);

    const result = await syncFestivalPendingChanges(JOB_ID, { skipSnapshotRefresh: true });

    expect(result.applied).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ stage: 2 }));
    expect(await getPendingChanges(JOB_ID)).toHaveLength(0);
  });

  it("reports a conflict when the server row changed since download", async () => {
    await seedChange({ operation: "update", baseUpdatedAt: "2026-07-01T10:00:00Z", label: "Banda Uno" });

    const selectBuilder = createMockQueryBuilder({
      data: { id: "artist-1", updated_at: "2026-07-02T09:00:00Z" },
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce(selectBuilder);

    const result = await syncFestivalPendingChanges(JOB_ID, { skipSnapshotRefresh: true });

    expect(result.applied).toBe(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      reason: "modified_on_server",
      recordId: "artist-1",
      label: "Banda Uno",
    });
    // The conflicting change stays queued for force/discard
    expect(await getPendingChanges(JOB_ID)).toHaveLength(1);
  });

  it("applies a conflicting update when force is enabled", async () => {
    await seedChange({ operation: "update", baseUpdatedAt: "2026-07-01T10:00:00Z" });

    const selectBuilder = createMockQueryBuilder({
      data: { id: "artist-1", updated_at: "2026-07-02T09:00:00Z" },
      error: null,
    });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);

    const result = await syncFestivalPendingChanges(JOB_ID, { force: true, skipSnapshotRefresh: true });

    expect(result.applied).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(await getPendingChanges(JOB_ID)).toHaveLength(0);
  });

  it("reports a conflict when the record was deleted on the server", async () => {
    await seedChange({ operation: "update" });

    const selectBuilder = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(selectBuilder);

    const result = await syncFestivalPendingChanges(JOB_ID, { skipSnapshotRefresh: true });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe("deleted_on_server");
  });

  it("treats deleting an already-deleted record as applied", async () => {
    await seedChange({ operation: "delete", payload: null });

    const selectBuilder = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(selectBuilder);

    const result = await syncFestivalPendingChanges(JOB_ID, { skipSnapshotRefresh: true });

    expect(result.applied).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(await getPendingChanges(JOB_ID)).toHaveLength(0);
  });

  it("inserts offline-created rows with their client-generated id and strips client-only fields", async () => {
    await seedChange({
      operation: "insert",
      recordId: "offline-uuid",
      payload: {
        name: "Banda Nueva",
        artist_submitted: true,
        festival_artist_form_submissions: [],
        updated_at: "stale",
      },
      baseUpdatedAt: null,
    });

    const insertBuilder = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(insertBuilder);

    const result = await syncFestivalPendingChanges(JOB_ID, { skipSnapshotRefresh: true });

    expect(result.applied).toBe(1);
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      { name: "Banda Nueva", id: "offline-uuid" },
    ]);
  });

  it("keeps failed changes queued and reports the error", async () => {
    await seedChange({ operation: "update" });

    const selectBuilder = createMockQueryBuilder({
      data: { id: "artist-1", updated_at: "2026-07-01T10:00:00Z" },
      error: null,
    });
    const updateBuilder = createMockQueryBuilder({ data: null, error: { message: "RLS denied" } });
    // The thenable builder resolves with { error }, which festival-sync turns into a throw
    updateBuilder.__setResult({ data: null, error: new Error("RLS denied") });
    mockSupabase.from.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);

    const result = await syncFestivalPendingChanges(JOB_ID, { skipSnapshotRefresh: true });

    expect(result.applied).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(await getPendingChanges(JOB_ID)).toHaveLength(1);
  });
});
