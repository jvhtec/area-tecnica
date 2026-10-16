import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { logEvent } from "../_shared/structuredLogger.ts";
import { ApiError, escapeLike, madridDate, objectPath, riderPath } from "./helpers.ts";

type DB = SupabaseClient;

export type StoredRecord = { path: string; name: string; mime: string; size: number; actorId: string };

/**
 * Where an imported file lands. Both destinations share the same upload,
 * idempotency and cleanup flow in index.ts; only storage and metadata differ.
 */
export interface ImportTarget {
  bucket: string;
  /** Receipt column that stores the confirmed metadata row id. */
  confirmColumn: "document_id" | "artist_file_id";
  /** Columns merged into the receipt row when it is first inserted. */
  receiptFields: Record<string, unknown>;
  newPath(name: string): string;
  /** Metadata row already registered for this storage path, if any. */
  findRecord(path: string): Promise<string | null>;
  insertRecord(record: StoredRecord): Promise<string>;
  /** Extra response fields. */
  response(): Record<string, unknown>;
  /** Runs once after the import is confirmed; failures must not fail the import. */
  afterConfirm(name: string, actorId: string): Promise<void>;
  /** Undo side effects created for an import that never produced a record. */
  rollback(): Promise<void>;
}

export function documentTarget(admin: DB, jobId: string, department: string): ImportTarget {
  return {
    bucket: "job_documents",
    confirmColumn: "document_id",
    receiptFields: { destination: "document", department },
    newPath: (name) => objectPath(department, jobId, name, crypto.randomUUID()),
    async findRecord(path) {
      const { data, error } = await admin.from("job_documents").select("id")
        .eq("job_id", jobId).eq("file_path", path).maybeSingle();
      if (error) throw new ApiError(500, "database_error");
      return data?.id ?? null;
    },
    async insertRecord(record) {
      // visible_to_tech is left to the column default (false), like the web upload.
      const { data, error } = await admin.from("job_documents").insert({
        job_id: jobId, file_name: record.name, file_path: record.path,
        file_type: record.mime, file_size: record.size, uploaded_by: record.actorId,
        original_type: null,
      }).select("id").single();
      if (error || !data) {
        logEvent("error", "ios_share_import.document_insert_failed");
        throw new ApiError(500, "document_registration_failed");
      }
      return data.id;
    },
    response: () => ({ destination: "document", job_id: jobId, department }),
    async afterConfirm(name, actorId) {
      // Same notification the web upload broadcasts; best-effort by design.
      try {
        const { error } = await admin.functions.invoke("push", {
          body: { action: "broadcast", type: "document.uploaded", job_id: jobId, file_name: name, actor_id: actorId },
        });
        if (error) logEvent("warn", "ios_share_import.push_failed");
      } catch {
        logEvent("warn", "ios_share_import.push_failed");
      }
    },
    rollback: async () => {},
  };
}

export type RiderInput = {
  job: { id: string; start_time: string | null; job_type: string | null };
  artistName: string;
  artistDate: string | null;
  stage: number | null;
  /** Artist already bound to a previous attempt of this request, if any. */
  existingArtistId: string | null;
};

/** Resolves (or creates) the festival artist, then returns a rider target bound to it. */
export async function riderTarget(admin: DB, input: RiderInput): Promise<ImportTarget> {
  const { job, artistName } = input;
  if (job.job_type !== "festival") throw new ApiError(400, "rider_requires_festival_job");

  let artistId = input.existingArtistId;
  let artistCreated = false;
  if (artistId) {
    const { data, error } = await admin.from("festival_artists").select("id").eq("id", artistId).maybeSingle();
    if (error) throw new ApiError(500, "database_error");
    if (!data) throw new ApiError(409, "artist_no_longer_exists");
  } else {
    const date = input.artistDate ?? (job.start_time ? madridDate(job.start_time) : null);
    if (!date) throw new ApiError(400, "artist_date_required");
    // Re-use the artist if it is already on the festival that day (retries, extra riders).
    const { data: found, error: findError } = await admin.from("festival_artists").select("id")
      .eq("job_id", job.id).eq("date", date).ilike("name", escapeLike(artistName))
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (findError) throw new ApiError(500, "database_error");
    if (found) {
      artistId = found.id;
    } else {
      const { data: created, error: createError } = await admin.from("festival_artists").insert({
        job_id: job.id, name: artistName, date, stage: input.stage ?? 1,
      }).select("id").single();
      if (createError || !created) {
        logEvent("error", "ios_share_import.artist_create_failed");
        throw new ApiError(500, "artist_creation_failed");
      }
      artistId = created.id;
      artistCreated = true;
    }
  }
  const id = artistId as string;

  return {
    bucket: "festival_artist_files",
    confirmColumn: "artist_file_id",
    receiptFields: { destination: "rider", artist_name: artistName, artist_id: id },
    newPath: (name) => riderPath(id, name, crypto.randomUUID()),
    async findRecord(path) {
      const { data, error } = await admin.from("festival_artist_files").select("id")
        .eq("artist_id", id).eq("file_path", path).maybeSingle();
      if (error) throw new ApiError(500, "database_error");
      return data?.id ?? null;
    },
    async insertRecord(record) {
      const { data, error } = await admin.from("festival_artist_files").insert({
        artist_id: id, file_name: record.name, file_path: record.path,
        file_type: record.mime, file_size: record.size, uploaded_by: record.actorId,
      }).select("id").single();
      if (error || !data) {
        logEvent("error", "ios_share_import.rider_insert_failed");
        throw new ApiError(500, "rider_registration_failed");
      }
      return data.id;
    },
    response: () => ({ destination: "rider", job_id: job.id, artist_id: id, artist_name: artistName, artist_created: artistCreated }),
    async afterConfirm() {
      // A rider now exists: clear the missing/outdated flags, as the web upload does.
      const { error } = await admin.from("festival_artists").update({
        rider_missing: false, rider_outdated: false,
        rider_copied_from_date: null, rider_outdated_dismissed: false,
      }).eq("id", id);
      if (error) logEvent("warn", "ios_share_import.rider_state_update_failed");
    },
    async rollback() {
      // Only an artist created by this very request is removed, and only while it has no files.
      if (!artistCreated) return;
      const { count } = await admin.from("festival_artist_files")
        .select("id", { count: "exact", head: true }).eq("artist_id", id);
      if ((count ?? 0) === 0) await admin.from("festival_artists").delete().eq("id", id);
    },
  };
}
