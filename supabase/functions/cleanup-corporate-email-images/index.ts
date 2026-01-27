import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_INLINE_IMAGE_RETENTION_HOURS = 24 * 7; // 7 days
const INLINE_IMAGE_RETENTION_MS = resolveInlineImageRetentionHours() * 60 * 60 * 1000;
const MAX_LOG_BATCH = 100;
const STORAGE_BUCKET = "corporate-emails-temp";
const STORAGE_PREFIX = "temp";

interface CleanupSummary {
  processedLogIds: string[];
  deletedFiles: number;
  errors: string[];
}

interface OrphanCleanupSummary {
  attempted: number;
  deleted: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const nowIso = new Date().toISOString();

    const cleanupSummary = await cleanupDueInlineImages(supabase, nowIso);
    const activePaths = await fetchActiveImagePaths(supabase);
    const orphanSummary = await cleanupOrphanedFiles(supabase, activePaths);

    const responseBody = {
      success: true,
      processedLogCount: cleanupSummary.processedLogIds.length,
      processedLogIds: cleanupSummary.processedLogIds,
      deletedFiles: cleanupSummary.deletedFiles,
      orphanedFilesDeleted: orphanSummary.deleted,
      errors: [...cleanupSummary.errors, ...orphanSummary.errors],
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cleanup-corporate-email-images] Unhandled error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function resolveInlineImageRetentionHours(): number {
  const raw = Deno.env.get("CORPORATE_EMAIL_IMAGE_RETENTION_HOURS");
  if (!raw) {
    return DEFAULT_INLINE_IMAGE_RETENTION_HOURS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[cleanup-corporate-email-images] Invalid CORPORATE_EMAIL_IMAGE_RETENTION_HOURS value "${raw}" – falling back to default (${DEFAULT_INLINE_IMAGE_RETENTION_HOURS}h)`
    );
    return DEFAULT_INLINE_IMAGE_RETENTION_HOURS;
  }

  return parsed;
}

async function cleanupDueInlineImages(
  supabase: SupabaseClient,
  nowIso: string
): Promise<CleanupSummary> {
  const processedLogIds: string[] = [];
  let deletedFiles = 0;
  const errors: string[] = [];
  const skippedIds = new Set<string>();

  while (true) {
    const { data: logs, error } = await supabase
      .from("corporate_email_logs")
      .select("id, inline_image_paths, inline_image_retention_until")
      .not("inline_image_paths", "is", null)
      .is("inline_image_cleanup_completed_at", null)
      .lte("inline_image_retention_until", nowIso)
      .order("inline_image_retention_until", { ascending: true })
      .limit(MAX_LOG_BATCH);

    if (error) {
      errors.push(`Failed to fetch logs for cleanup: ${error.message}`);
      break;
    }

    if (!logs || logs.length === 0) {
      break;
    }

    const batch = logs.filter((log) => !skippedIds.has(log.id));
    if (batch.length === 0) {
      break;
    }

    for (const log of batch) {
      const paths = Array.isArray(log.inline_image_paths) ? log.inline_image_paths : [];
      if (paths.length === 0) {
        const updateResult = await supabase
          .from("corporate_email_logs")
          .update({
            inline_image_paths: null,
            inline_image_cleanup_completed_at: new Date().toISOString(),
          })
          .eq("id", log.id);

        if (updateResult.error) {
          const message = `Failed to update log ${log.id} with empty paths: ${updateResult.error.message}`;
          console.error(`[cleanup-corporate-email-images] ${message}`);
          errors.push(message);
          skippedIds.add(log.id);
          continue;
        }

        processedLogIds.push(log.id);
        continue;
      }

      const { deletedCount, remainingPaths, errorMessages } = await removeStorageFiles(supabase, paths);
      deletedFiles += deletedCount;

      if (errorMessages.length > 0) {
        errors.push(...errorMessages.map((msg) => `Log ${log.id}: ${msg}`));
      }

      const updatePayload: Record<string, unknown> = {};
      if (remainingPaths.length === 0) {
        updatePayload.inline_image_paths = null;
        updatePayload.inline_image_cleanup_completed_at = new Date().toISOString();
      } else {
        updatePayload.inline_image_paths = remainingPaths;
        updatePayload.inline_image_retention_until = new Date(Date.now() + INLINE_IMAGE_RETENTION_MS).toISOString();
      }

      const { error: updateError } = await supabase
        .from("corporate_email_logs")
        .update(updatePayload)
        .eq("id", log.id);

      if (updateError) {
        const message = `Failed to update log ${log.id} after cleanup: ${updateError.message}`;
        console.error(`[cleanup-corporate-email-images] ${message}`);
        errors.push(message);
        skippedIds.add(log.id);
        continue;
      }

      if (remainingPaths.length === 0) {
        processedLogIds.push(log.id);
      } else {
        skippedIds.add(log.id);
      }
    }
  }

  return { processedLogIds, deletedFiles, errors };
}

async function removeStorageFiles(
  supabase: SupabaseClient,
  paths: string[]
): Promise<{ deletedCount: number; remainingPaths: string[]; errorMessages: string[] }> {
  let deletedCount = 0;
  const remainingPaths: string[] = [];
  const errorMessages: string[] = [];

  for (const path of paths) {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    if (error) {
      const message = `Failed to delete ${path}: ${error.message}`;
      console.warn(`[cleanup-corporate-email-images] ${message}`);
      errorMessages.push(message);
      remainingPaths.push(path);
    } else {
      deletedCount += 1;
    }
  }

  return { deletedCount, remainingPaths, errorMessages };
}

async function fetchActiveImagePaths(supabase: SupabaseClient): Promise<Set<string>> {
  const activePaths = new Set<string>();
  const { data, error } = await supabase
    .from("corporate_email_logs")
    .select("inline_image_paths")
    .not("inline_image_paths", "is", null)
    .is("inline_image_cleanup_completed_at", null);

  if (error) {
    console.error("[cleanup-corporate-email-images] Failed to fetch active image paths", error);
    return activePaths;
  }

  for (const row of data ?? []) {
    const paths = Array.isArray(row.inline_image_paths) ? (row.inline_image_paths as string[]) : [];
    for (const path of paths) {
      activePaths.add(path);
    }
  }

  return activePaths;
}

async function cleanupOrphanedFiles(
  supabase: SupabaseClient,
  activePaths: Set<string>
): Promise<OrphanCleanupSummary> {
  const errors: string[] = [];
  const allObjects = await listTempObjects(supabase);
  const cutoff = Date.now() - INLINE_IMAGE_RETENTION_MS;

  const stalePaths = allObjects
    .map((obj) => `${STORAGE_PREFIX}/${obj.name}`)
    .filter((path, idx) => {
      const obj = allObjects[idx];
      if (activePaths.has(path)) {
        return false;
      }
      const createdAt = new Date(obj.created_at ?? "").getTime();
      return Number.isFinite(createdAt) && createdAt <= cutoff;
    });

  let deleted = 0;
  for (let i = 0; i < stalePaths.length; i += MAX_LOG_BATCH) {
    const batch = stalePaths.slice(i, i + MAX_LOG_BATCH);
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).remove(batch);
    if (error) {
      const message = `Failed to delete orphaned batch starting at index ${i}: ${error.message}`;
      console.warn(`[cleanup-corporate-email-images] ${message}`);
      errors.push(message);
      continue;
    }
    if (data && data.length > 0) {
      deleted += data.length;
    } else {
      deleted += batch.length;
    }
  }

  return {
    attempted: stalePaths.length,
    deleted,
    errors,
  };
}

async function listTempObjects(
  supabase: SupabaseClient
): Promise<Array<{ name: string; created_at: string }>> {
  const objects: Array<{ name: string; created_at: string }> = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(STORAGE_PREFIX, {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "created_at", order: "asc" },
    });

    if (error) {
      console.error("[cleanup-corporate-email-images] Failed to list storage objects", error);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      if (!item || !item.name || !item.created_at) {
        continue;
      }
      objects.push({ name: item.name, created_at: item.created_at });
    }

    if (data.length < pageSize) {
      break;
    }

    page += 1;
  }

  return objects;
}
