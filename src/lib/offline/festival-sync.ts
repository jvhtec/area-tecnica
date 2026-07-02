import { supabase } from "@/integrations/supabase/client";

import { downloadFestivalSnapshot } from "./festival-snapshot";
import { getPendingChanges, removePendingChange } from "./festival-offline-queue";
import { isBrowserOnline, notifyOfflineFestivalChanged } from "./offline-events";
import type {
  OfflinePendingChange,
  OfflineSyncConflictReason,
  OfflineSyncResult,
} from "./types";

type Row = Record<string, unknown>;

/**
 * Columns that exist only on the client (joins/derived flags) and must be
 * stripped before writing a row back to the server.
 */
const CLIENT_ONLY_FIELDS = new Set([
  "artist_submitted",
  "festival_artist_form_submissions",
]);

const sanitizePayload = (payload: Row | null): Row => {
  const clean: Row = {};
  Object.entries(payload ?? {}).forEach(([key, value]) => {
    if (!CLIENT_ONLY_FIELDS.has(key)) {
      clean[key] = value;
    }
  });
  // updated_at is maintained by the server; sending the stale local value
  // would defeat conflict detection for later syncs.
  delete clean.updated_at;
  return clean;
};

type ApplyOutcome =
  | { status: "applied" }
  | { status: "conflict"; reason: OfflineSyncConflictReason };

const fetchServerUpdatedAt = async (
  change: OfflinePendingChange,
): Promise<{ exists: boolean; updatedAt: string | null }> => {
  const { data, error } = await supabase
    .from(change.table)
    .select("id, updated_at")
    .eq("id", change.recordId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { exists: false, updatedAt: null };
  return { exists: true, updatedAt: (data as Row).updated_at as string | null };
};

const applyChange = async (change: OfflinePendingChange, force: boolean): Promise<ApplyOutcome> => {
  if (change.operation === "insert") {
    const payload = sanitizePayload(change.payload);
    payload.id = change.recordId;
    const { error } = await supabase.from(change.table).insert([payload as never]);
    if (error) {
      if (error.code === "23505") {
        return { status: "conflict", reason: "duplicate_on_server" };
      }
      throw error;
    }
    return { status: "applied" };
  }

  const server = await fetchServerUpdatedAt(change);

  if (change.operation === "update") {
    if (!server.exists) {
      return { status: "conflict", reason: "deleted_on_server" };
    }
    if (!force && change.baseUpdatedAt && server.updatedAt && server.updatedAt !== change.baseUpdatedAt) {
      return { status: "conflict", reason: "modified_on_server" };
    }
    const { error } = await supabase
      .from(change.table)
      .update(sanitizePayload(change.payload) as never)
      .eq("id", change.recordId);
    if (error) throw error;
    return { status: "applied" };
  }

  // delete
  if (!server.exists) {
    // Already gone on the server: nothing to do.
    return { status: "applied" };
  }
  if (!force && change.baseUpdatedAt && server.updatedAt && server.updatedAt !== change.baseUpdatedAt) {
    return { status: "conflict", reason: "modified_on_server" };
  }
  const { error } = await supabase.from(change.table).delete().eq("id", change.recordId);
  if (error) throw error;
  return { status: "applied" };
};

export interface SyncOptions {
  /** Apply changes even when the server row changed since download. */
  force?: boolean;
  /** Skip the snapshot refresh after a clean sync (used by tests). */
  skipSnapshotRefresh?: boolean;
}

/**
 * Pushes the queued offline changes of a festival to the server, in the
 * order they were made. Changes whose server row was modified (or deleted)
 * since the download are reported as conflicts and stay queued so the user
 * can retry with `force` or discard them. After a fully clean sync the
 * snapshot is re-downloaded so local data matches the server again.
 */
export const syncFestivalPendingChanges = async (
  jobId: string,
  options: SyncOptions = {},
): Promise<OfflineSyncResult> => {
  if (!isBrowserOnline()) {
    throw new Error("Sin conexión: no se pueden sincronizar los cambios");
  }

  const changes = await getPendingChanges(jobId);
  const result: OfflineSyncResult = { applied: 0, conflicts: [], failed: [] };

  for (const change of changes) {
    try {
      const outcome = await applyChange(change, options.force ?? false);
      if (outcome.status === "applied") {
        await removePendingChange(change.id);
        result.applied += 1;
      } else {
        result.conflicts.push({
          changeId: change.id,
          table: change.table,
          operation: change.operation,
          recordId: change.recordId,
          label: change.label,
          reason: outcome.reason,
        });
      }
    } catch (error) {
      result.failed.push({
        changeId: change.id,
        table: change.table,
        operation: change.operation,
        recordId: change.recordId,
        label: change.label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!options.skipSnapshotRefresh && result.conflicts.length === 0 && result.failed.length === 0) {
    try {
      await downloadFestivalSnapshot(jobId);
    } catch (error) {
      // The sync itself succeeded; a failed refresh only leaves the local
      // copy slightly stale, so report it without failing the operation.
      console.warn("No se pudo actualizar la copia offline tras la sincronización:", error);
    }
  }

  notifyOfflineFestivalChanged(jobId);
  return result;
};
