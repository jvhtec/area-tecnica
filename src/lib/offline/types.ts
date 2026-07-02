import type { Database } from "@/integrations/supabase/types";

export type FestivalArtistRow = Database["public"]["Tables"]["festival_artists"]["Row"];

/**
 * Schema version of the snapshot payload. Bump when the shape of
 * OfflineFestivalSnapshot["data"] changes so stale snapshots are discarded.
 */
export const OFFLINE_SNAPSHOT_SCHEMA_VERSION = 1;

export interface OfflineFestivalSnapshotData {
  job: Record<string, unknown> | null;
  festivalSettings: Record<string, unknown> | null;
  jobDateTypes: Array<Record<string, unknown>>;
  stages: Array<Record<string, unknown>>;
  gearSetups: Array<Record<string, unknown>>;
  stageGearSetups: Array<Record<string, unknown>>;
  artists: Array<Record<string, unknown>>;
  artistFormSubmissions: Array<Record<string, unknown>>;
  artistFiles: Array<Record<string, unknown>>;
  shifts: Array<Record<string, unknown>>;
  shiftAssignments: Array<Record<string, unknown>>;
  logos: Array<Record<string, unknown>>;
  jobDocuments: Array<Record<string, unknown>>;
  hojaVenue: Record<string, unknown> | null;
  location: Record<string, unknown> | null;
}

export interface OfflineFestivalSnapshot {
  jobId: string;
  jobTitle: string;
  schemaVersion: number;
  downloadedAt: string;
  downloadedBy: string | null;
  data: OfflineFestivalSnapshotData;
}

export type OfflineChangeOperation = "insert" | "update" | "delete";

export type OfflineSyncableTable = "festival_artists";

export interface OfflinePendingChange {
  /** Unique id of the queue entry */
  id: string;
  jobId: string;
  table: OfflineSyncableTable;
  operation: OfflineChangeOperation;
  /** Primary key of the affected record (client-generated uuid for inserts) */
  recordId: string;
  /** Row payload for insert/update operations */
  payload: Record<string, unknown> | null;
  /** Server updated_at observed when the record was downloaded/edited (conflict detection) */
  baseUpdatedAt: string | null;
  createdAt: string;
  /** Human-readable label for conflict/sync reporting (e.g. artist name) */
  label?: string;
}

export type OfflineSyncConflictReason =
  | "modified_on_server"
  | "deleted_on_server"
  | "duplicate_on_server";

export interface OfflineSyncConflict {
  changeId: string;
  table: OfflineSyncableTable;
  operation: OfflineChangeOperation;
  recordId: string;
  label?: string;
  reason: OfflineSyncConflictReason;
}

export interface OfflineSyncFailure {
  changeId: string;
  table: OfflineSyncableTable;
  operation: OfflineChangeOperation;
  recordId: string;
  label?: string;
  message: string;
}

export interface OfflineSyncResult {
  applied: number;
  conflicts: OfflineSyncConflict[];
  failed: OfflineSyncFailure[];
}
