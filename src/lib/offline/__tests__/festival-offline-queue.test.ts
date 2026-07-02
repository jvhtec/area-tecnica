import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { offlineDb, SNAPSHOT_STORE, __resetOfflineDbForTests } from "../offline-db";
import { getFestivalSnapshot } from "../festival-snapshot";
import {
  discardPendingChanges,
  getPendingChanges,
  queueFestivalChange,
} from "../festival-offline-queue";
import { OFFLINE_SNAPSHOT_SCHEMA_VERSION, type OfflineFestivalSnapshot } from "../types";

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
    artists: [
      { id: "artist-1", name: "Banda Uno", date: "2026-07-10", updated_at: "2026-07-01T10:00:00Z" },
    ],
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

describe("festival offline queue", () => {
  beforeEach(async () => {
    __resetOfflineDbForTests();
    resetMockSupabase();
    await offlineDb.put(SNAPSHOT_STORE, buildSnapshot());
  });

  it("queues an insert and reflects it in the snapshot", async () => {
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "insert",
      recordId: "artist-new",
      payload: { name: "Banda Nueva", date: "2026-07-10", job_id: JOB_ID },
      label: "Banda Nueva",
    });

    const pending = await getPendingChanges(JOB_ID);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ operation: "insert", recordId: "artist-new" });

    const snapshot = await getFestivalSnapshot(JOB_ID);
    expect(snapshot?.data.artists.map((artist) => artist.id)).toContain("artist-new");
  });

  it("coalesces insert + update into a single insert with merged payload", async () => {
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "insert",
      recordId: "artist-new",
      payload: { name: "Banda Nueva", stage: 1 },
    });
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "update",
      recordId: "artist-new",
      payload: { stage: 2 },
    });

    const pending = await getPendingChanges(JOB_ID);
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe("insert");
    expect(pending[0].payload).toMatchObject({ name: "Banda Nueva", stage: 2 });
  });

  it("drops the queue entry entirely when an offline insert is deleted", async () => {
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "insert",
      recordId: "artist-new",
      payload: { name: "Banda Nueva", date: "2026-07-10" },
    });
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "delete",
      recordId: "artist-new",
    });

    expect(await getPendingChanges(JOB_ID)).toHaveLength(0);
    const snapshot = await getFestivalSnapshot(JOB_ID);
    expect(snapshot?.data.artists.map((artist) => artist.id)).not.toContain("artist-new");
  });

  it("merges consecutive updates and keeps the original baseUpdatedAt", async () => {
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "update",
      recordId: "artist-1",
      payload: { stage: 2 },
      baseUpdatedAt: "2026-07-01T10:00:00Z",
    });
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "update",
      recordId: "artist-1",
      payload: { notes: "cambio offline" },
      baseUpdatedAt: "irrelevant-second-value",
    });

    const pending = await getPendingChanges(JOB_ID);
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe("update");
    expect(pending[0].payload).toMatchObject({ stage: 2, notes: "cambio offline" });
    expect(pending[0].baseUpdatedAt).toBe("2026-07-01T10:00:00Z");

    const snapshot = await getFestivalSnapshot(JOB_ID);
    const artist = snapshot?.data.artists.find((row) => row.id === "artist-1");
    expect(artist).toMatchObject({ stage: 2, notes: "cambio offline" });
  });

  it("collapses update + delete into a delete that keeps the original baseUpdatedAt", async () => {
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "update",
      recordId: "artist-1",
      payload: { stage: 2 },
      baseUpdatedAt: "2026-07-01T10:00:00Z",
    });
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "delete",
      recordId: "artist-1",
    });

    const pending = await getPendingChanges(JOB_ID);
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe("delete");
    expect(pending[0].baseUpdatedAt).toBe("2026-07-01T10:00:00Z");

    const snapshot = await getFestivalSnapshot(JOB_ID);
    expect(snapshot?.data.artists.map((artist) => artist.id)).not.toContain("artist-1");
  });

  it("discards every pending change of the festival", async () => {
    await queueFestivalChange({
      jobId: JOB_ID,
      table: "festival_artists",
      operation: "update",
      recordId: "artist-1",
      payload: { stage: 3 },
    });

    const discarded = await discardPendingChanges(JOB_ID);
    expect(discarded).toBe(1);
    expect(await getPendingChanges(JOB_ID)).toHaveLength(0);
  });
});
