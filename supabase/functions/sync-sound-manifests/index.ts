import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createHttpHandler } from "../_shared/http.ts";
import { requireServiceRoleRequest } from "../_shared/auth.ts";
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import { findQuoteEquipmentListCandidates, isPullSheetKeyInfo } from "./discovery.ts";
import { readRunOptions } from "./runOptions.ts";
import { decodeFlexPdf, headerText, isPublishableStatus, manifestReportUrl, manifestStatusId, soundManifestFileName } from "./manifest.ts";

const FLEX_BASE = "https://sectorpro.flexrentalsolutions.com/f5/api";
const BUCKET = "job-documents";
const PREFIX = "flex-reports/sound-manifests";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOUR = 3_600_000;
const BATCH_SIZE = 200;

type Row = Record<string, unknown>;
/** Reject arrays and primitive Flex responses before reading named header fields. */
const asRecord = (value: unknown): Row | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;

/** Authenticate server-side Flex requests using the established desktop API headers. */
function flexHeaders(token: string): HeadersInit {
  return { "X-Auth-Token": token, apikey: token, "X-Requested-With": "XMLHttpRequest", "X-API-Client": "flex5-desktop" };
}

/** Fetch Flex JSON with shared retry bounds; unsuccessful responses never qualify a manifest. */
async function flexJson(path: string, token: string): Promise<unknown> {
  const response = await fetchWithRetry(FLEX_BASE + path, { headers: flexHeaders(token) });
  if (!response.ok) throw new Error(`Flex ${path}: HTTP ${response.status}`);
  return response.json();
}

/** Download and validate the manifest PDF before any publication mutation. */
async function fetchPdf(manifestId: string, token: string): Promise<Uint8Array> {
  const response = await fetchWithRetry(manifestReportUrl(manifestId), { headers: flexHeaders(token) });
  if (!response.ok) throw new Error(`Flex PDF HTTP ${response.status}`);
  const raw = new Uint8Array(await response.arrayBuffer());
  if (raw.byteLength > 30_000_000) throw new Error("Flex PDF exceeds 30 MB");
  return decodeFlexPdf(raw);
}

/** Fingerprint validated PDF bytes to identify immutable versions and unchanged runs. */
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Retire only orphaned objects after metadata deletion, preserving shared job paths. */
async function removeUnreferencedPdfs(db: SupabaseClient, candidates: string[]): Promise<void> {
  const paths = [...new Set(candidates)];
  if (!paths.length) return;
  const { data: remaining, error: remainingError } = await db.from("job_documents")
    .select("file_path").in("file_path", paths);
  if (remainingError) throw remainingError;
  const referenced = new Set((remaining ?? []).map((doc) => doc.file_path));
  const removable = paths.filter((path) => !referenced.has(path));
  if (!removable.length) return;
  const { error: storageError } = await db.storage.from(BUCKET).remove(removable);
  if (storageError) throw storageError;
}

serve(createHttpHandler(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const token = Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN");
  if (!serviceKey || !url || !token) return new Response("Service configuration unavailable", { status: 503 });
  requireServiceRoleRequest(request, serviceKey);
  const options = await readRunOptions(request);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = Date.now();
  const results = { checked: 0, published: 0, unchanged: 0, pending: 0, errors: [] as string[] };
  const previews: Row[] = [];
  // Scan upcoming jobs, never depend on a user opening the application.
  let jobQuery = db.from("jobs")
    .select("id,title,start_time,status")
    .gte("start_time", new Date(now - 48 * HOUR).toISOString())
    .lte("start_time", new Date(now + 48 * HOUR).toISOString())
    .order("start_time", { ascending: true }).limit(BATCH_SIZE);
  if (options.jobId) jobQuery = jobQuery.eq("id", options.jobId);
  const { data: jobs, error: jobsError } = await jobQuery;
  if (jobsError) return new Response("Job discovery failed", { status: 500 });
  for (const job of jobs ?? []) {
    if (["cancelled", "canceled", "cancelado"].includes(String(job.status ?? "").toLowerCase())) continue;
    try {
      const { data: sheets, error: folderError } = await db.from("flex_folders")
        .select("element_id,folder_type").eq("job_id", job.id).eq("department", "sound")
        .in("folder_type", ["pull_sheet", "comercial_presupuesto", "dryhire_presupuesto"]);
      if (folderError) throw folderError;
      const sheetIds = new Set<string>();
      for (const source of sheets ?? []) {
        if (!UUID.test(source.element_id ?? "")) continue;
        if (source.folder_type === "pull_sheet") { sheetIds.add(source.element_id.toLowerCase()); continue; }
        try {
          const tree = await flexJson(`/element/${encodeURIComponent(source.element_id)}/tree`, token);
          for (const id of findQuoteEquipmentListCandidates(tree, source.element_id)) {
            try {
              const info = await flexJson(`/element/${encodeURIComponent(id)}/key-info/`, token);
              if (isPullSheetKeyInfo(info, id)) sheetIds.add(id);
            } catch {
              if (!results.errors.includes(job.id)) results.errors.push(job.id);
            }
          }
        } catch {
          if (!results.errors.includes(job.id)) results.errors.push(job.id);
        }
      }
      for (const elementId of sheetIds) {
        const sheet = { element_id: elementId };
        if (!UUID.test(sheet.element_id ?? "")) continue;
        results.checked++;
        const warehouse = asRecord(await flexJson(
          `/equipment-list/warehouse-state/${encodeURIComponent(sheet.element_id)}`, token,
        ));
        if (!warehouse) { results.pending++; continue; }
        // Prefer the shipping manifest when present, but verify its own status.
        const ids = [warehouse.shipManifestId, warehouse.prepManifestId]
          .filter((value): value is string => typeof value === "string" && UUID.test(value));
        let manifestId: string | undefined;
        let manifestNumber: string | null = null;
        for (const candidate of [...new Set(ids)]) {
          const header = await flexJson(`/element/${encodeURIComponent(candidate)}/header-data/?codeList=statusId&codeList=documentNumber`, token);
          if (isPublishableStatus(manifestStatusId(header))) {
            manifestId = candidate;
            manifestNumber = headerText(asRecord(header)?.documentNumber);
            break;
          }
        }
        if (!manifestId) { results.pending++; continue; }
        if (options.dryRun) {
          const pdf = await fetchPdf(manifestId, token);
          previews.push({ job_id: job.id, sheet_id: sheet.element_id, manifest_id: manifestId,
            document_number: manifestNumber, pdf_bytes: pdf.byteLength, sha256: await sha256(pdf) });
          continue;
        }
        const lockToken = crypto.randomUUID();
        const { data: acquired, error: lockError } = await db.rpc("claim_sound_manifest_slot", { p_job_id: job.id, p_sheet_id: sheet.element_id, p_token: lockToken });
        if (lockError) throw lockError;
        if (!acquired) { results.pending++; continue; }
        try {
        const pdf = await fetchPdf(manifestId, token);
        const fingerprint = await sha256(pdf);
        const base = `${PREFIX}/${job.id}/${sheet.element_id}`;
        const path = `${base}/${fingerprint}.pdf`;
        const { data: previous, error: previousError } = await db.from("job_documents")
          .select("id,file_path").eq("job_id", job.id).like("file_path", `${base}/%`);
        if (previousError) throw previousError;
        if (previous?.some((doc) => doc.file_path === path)) {
          const redundant = previous.filter((doc) => doc.file_path !== path);
          if (redundant.length) {
            const { error: staleError } = await db.from("job_documents").delete().in("id", redundant.map((doc) => doc.id));
            if (staleError) throw staleError;
            await removeUnreferencedPdfs(db, redundant.map((doc) => doc.file_path));
          }
          results.unchanged++; continue;
        }
        const { error: uploadError } = await db.storage.from(BUCKET)
          .upload(path, pdf, { contentType: "application/pdf", upsert: false, cacheControl: "0" });
        if (uploadError && !String(uploadError.message).toLowerCase().includes("already exists")) throw uploadError;
        const { data: created, error: insertError } = await db.from("job_documents").insert({
          job_id: job.id,
          file_name: soundManifestFileName({ jobTitle: job.title ?? "Trabajo", startTime: job.start_time, manifestId, documentNumber: manifestNumber }),
          file_path: path,
          file_type: "application/pdf",
          file_size: pdf.byteLength,
          original_type: "pdf",
          uploaded_by: null,
          visible_to_tech: true,
          read_only: true,
        }).select("id").single();
        if (insertError || !created) throw insertError ?? new Error("Document insert failed");
        // New document is visible before any predecessor is removed.
        if (previous?.length) {
          const { error: deletionError } = await db.from("job_documents").delete()
            .in("id", previous.map((doc) => doc.id));
          if (deletionError) throw deletionError;
          await removeUnreferencedPdfs(db, previous.map((doc) => doc.file_path));
        }
        results.published++;
        } finally {
          const { error: releaseError } = await db.rpc("release_sound_manifest_slot", { p_job_id: job.id, p_sheet_id: sheet.element_id, p_token: lockToken });
          if (releaseError && !results.errors.includes(job.id)) results.errors.push(job.id);
        }
      }
    } catch (error) {
      void error;
      if (!results.errors.includes(job.id)) results.errors.push(job.id);
    }
  }
  logEvent(results.errors.length ? "warn" : "info", "sound_manifest_sync.completed", {
    checked: results.checked, published: results.published, unchanged: results.unchanged,
    pending: results.pending, failed: results.errors.length,
  });
  return new Response(JSON.stringify(options.dryRun ? { ...results, dry_run: true, previews } : results), { status: results.errors.length ? 500 : 200, headers: { "Content-Type": "application/json" } });
}, { allowedMethods: ["POST"] }));
