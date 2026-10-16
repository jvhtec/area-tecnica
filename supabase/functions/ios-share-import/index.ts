import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createHttpHandler } from "../_shared/http.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import { checkEdgeRateLimit } from "../_shared/rateLimit.ts";
import { joinedSingle } from "../_shared/joins.ts";
import {
  acceptsRiders, ApiError, type Destination, escapeLike, type JobRow, jobOption, STALE_UPLOAD_MS, upcomingCutoffIso,
  RIDER_EXCLUDED_JOB_TYPES, validArtistName, validFileName, validIsoDate,
} from "./helpers.ts";
import { documentTarget, type ImportTarget, riderTarget, tourDocumentTarget } from "./destinations.ts";

// Native Shortcuts callers cannot use the PWA's Supabase session. They use an
// opaque, revocable, import-only token in X-Share-Token. Pair/revoke requires
// the user's normal Supabase JWT and never returns existing token secrets.
const ALLOWED_ROLES = new Set(["admin", "management", "logistics", "house_tech"]);
const DEPARTMENTS = new Set(["sound", "lights", "video", "production", "personnel", "logistics", "administrative"]);
const MAX_ACTIVE_TOKENS = 5;
const MAX_FILE_BYTES = 45 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_KEY = /^[a-zA-Z0-9_-]{8,100}$/;
const TOKEN = /^ati_[a-f0-9]{64}$/;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-share-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Cache-Control": "no-store",
};

type DB = SupabaseClient;
type Identity = { id: string; role: string; tokenId?: string };
type Receipt = {
  id: string; token_id: string; request_key: string; user_id: string;
  job_id: string; destination: Destination | "tour_document"; department: string | null; artist_name: string | null;
  artist_id: string | null; file_name: string; file_path: string; file_size: number;
  document_id: string | null; artist_file_id: string | null; tour_document_id: string | null;
  created_at: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}
function fail(error: unknown): Response {
  if (error instanceof ApiError) return json({ ok: false, error: error.code }, error.status);
  logEvent("error", "ios_share_import.unexpected_error", { error_name: error instanceof Error ? error.name : "unknown" });
  return json({ ok: false, error: "internal_error" }, 500);
}
function getEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_${name}`);
  return value;
}
function createAdmin(): DB {
  return createClient(getEnvironment("SUPABASE_URL"), getEnvironment("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
function requireResult(error: { message?: string } | null, code = "database_error"): void {
  if (error) { logEvent("error", "ios_share_import.database_failure", { error_code: code }); throw new ApiError(500, code); }
}
async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexRandom(length: number): string {
  return [...crypto.getRandomValues(new Uint8Array(length))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function currentRole(admin: DB, userId: string): Promise<string> {
  const { data, error } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  requireResult(error);
  const role = typeof data?.role === "string" ? data.role : "";
  if (!ALLOWED_ROLES.has(role)) throw new ApiError(403, "not_authorized_to_upload");
  return role;
}
async function sessionIdentity(req: Request, admin: DB): Promise<Identity> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || bearer.startsWith("ati_")) throw new ApiError(401, "login_required");
  const auth = createClient(getEnvironment("SUPABASE_URL"), getEnvironment("SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await auth.auth.getUser(bearer);
  if (error || !data.user) throw new ApiError(401, "invalid_session");
  return { id: data.user.id, role: await currentRole(admin, data.user.id) };
}
async function shortcutIdentity(req: Request, admin: DB): Promise<Identity> {
  const token = req.headers.get("x-share-token")?.trim() || "";
  if (!TOKEN.test(token)) throw new ApiError(401, "invalid_shortcut_token");
  const tokenHash = await sha256(token);
  const { data, error } = await admin.from("ios_share_import_tokens")
    .select("id,user_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash).maybeSingle();
  requireResult(error);
  // expires_at is null for the default non-expiring device credential.
  if (!data || data.revoked_at || (data.expires_at && Date.parse(data.expires_at) <= Date.now())) {
    throw new ApiError(401, "expired_or_revoked_token");
  }
  const role = await currentRole(admin, data.user_id);
  // Non-critical bookkeeping must never fail an upload, but it is awaited:
  // the runtime may drop a floating promise once the response is sent.
  const { error: touchError } = await admin.from("ios_share_import_tokens")
    .update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  if (touchError) logEvent("warn", "ios_share_import.last_used_update_failed");
  return { id: data.user_id, role, tokenId: data.id };
}
async function readJson(req: Request): Promise<Record<string, unknown>> {
  const length = Number(req.headers.get("content-length") || "0");
  if (length > 8_192) throw new ApiError(413, "body_too_large");
  let raw = "";
  if (req.body) {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 8_192) { await reader.cancel(); throw new ApiError(413, "body_too_large"); }
      chunks.push(value);
    }
    const decoder = new TextDecoder();
    raw = chunks.map((part, i) => decoder.decode(part, { stream: i !== chunks.length - 1 })).join("");
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new ApiError(400, "invalid_json"); }
  if (!body || Array.isArray(body) || typeof body !== "object") throw new ApiError(400, "invalid_json");
  return body as Record<string, unknown>;
}
async function readForm(req: Request): Promise<FormData> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;")) throw new ApiError(415, "multipart_required");
  const length = Number(req.headers.get("content-length") || "0");
  if (length > MAX_MULTIPART_BYTES) throw new ApiError(413, "file_too_large");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "missing_body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MULTIPART_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "file_too_large");
    }
    chunks.push(value);
  }
  const safeRequest = new Request(req.url, {
    method: "POST",
    headers: { "content-type": type },
    // Copy the pooled stream chunks into owned ArrayBuffers for strict Deno BlobPart typing.
    body: new Blob(chunks.map((chunk) => {
      const bytes = new Uint8Array(chunk.byteLength);
      bytes.set(chunk);
      return bytes.buffer;
    })),
  });
  try { return await safeRequest.formData(); } catch { throw new ApiError(400, "invalid_form_data"); }
}
function fileName(value: string): string {
  const name = validFileName(value);
  if (!name) throw new ApiError(400, "invalid_file_name");
  return name;
}
async function pair(req: Request, admin: DB, body: Record<string, unknown>): Promise<Response> {
  const user = await sessionIdentity(req, admin);
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "iPhone";
  if (!label) throw new ApiError(400, "invalid_label");
  const { count, error: countError } = await admin.from("ios_share_import_tokens")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id)
    .is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  requireResult(countError);
  if ((count || 0) >= MAX_ACTIVE_TOKENS) throw new ApiError(409, "too_many_devices");
  const secret = `ati_${hexRandom(32)}`;
  const { data, error } = await admin.from("ios_share_import_tokens")
    .insert({ user_id: user.id, label, token_hash: await sha256(secret), expires_at: null })
    .select("id,label,expires_at").single();
  requireResult(error);
  return json({ ok: true, token: secret, device: data }, 201);
}
async function devices(req: Request, admin: DB): Promise<Response> {
  const user = await sessionIdentity(req, admin);
  const { data, error } = await admin.from("ios_share_import_tokens")
    .select("id,label,created_at,expires_at,revoked_at,last_used_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
  requireResult(error);
  return json({ ok: true, devices: data ?? [] });
}
async function revoke(req: Request, admin: DB, body: Record<string, unknown>): Promise<Response> {
  const user = await sessionIdentity(req, admin);
  const tokenId = String(body.token_id ?? "");
  if (!UUID.test(tokenId)) throw new ApiError(400, "invalid_token_id");
  const { data, error } = await admin.from("ios_share_import_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId).eq("user_id", user.id).is("revoked_at", null)
    .select("id").maybeSingle();
  requireResult(error);
  if (!data) throw new ApiError(404, "token_not_found");
  return json({ ok: true, revoked: tokenId });
}
const JOB_COLUMNS = "id,title,start_time,job_type,tour_id,tour_date_id,status,tour:tours(name)";
type JobQueryRow = Omit<JobRow, "tourName"> & { tour?: { name: string | null } | { name: string | null }[] | null };

// Only jobs that are still ahead: not cancelled or completed, and not already finished.
function upcomingJobs<T extends { or: (filters: string) => T }>(query: T): T {
  const cutoff = upcomingCutoffIso();
  return query
    .or("status.is.null,status.in.(Tentativa,Confirmado)")
    .or(`end_time.gte.${cutoff},and(end_time.is.null,start_time.gte.${cutoff})`);
}

async function jobs(req: Request, admin: DB): Promise<Response> {
  await shortcutIdentity(req, admin);
  const url = new URL(req.url);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  // Riders have no place on dry hire jobs, so that destination does not offer them.
  const forRider = url.searchParams.get("destination") === "rider";
  const base = () => {
    let query = upcomingJobs(admin.from("jobs").select(JOB_COLUMNS));
    if (forRider) query = query.not("job_type", "in", `(${RIDER_EXCLUDED_JOB_TYPES.join(",")})`);
    return query.order("start_time", { ascending: true }).limit(100);
  };
  let rows: JobQueryRow[];
  if (search) {
    // Match the job title or its tour name; LIKE metacharacters stay literal.
    const pattern = `%${escapeLike(search)}%`;
    const byTitle = await base().ilike("title", pattern);
    requireResult(byTitle.error);
    const { data: tours, error: toursError } = await admin.from("tours").select("id")
      .ilike("name", pattern).limit(50);
    requireResult(toursError);
    const tourIds = (tours ?? []).map((tour) => tour.id as string);
    let byTour: JobQueryRow[] = [];
    if (tourIds.length > 0) {
      const result = await base().in("tour_id", tourIds);
      requireResult(result.error);
      byTour = (result.data ?? []) as unknown as JobQueryRow[];
    }
    const merged = new Map<string, JobQueryRow>();
    for (const row of [...((byTitle.data ?? []) as unknown as JobQueryRow[]), ...byTour]) merged.set(row.id, row);
    rows = [...merged.values()]
      .sort((a, b) => String(a.start_time ?? "").localeCompare(String(b.start_time ?? "")))
      .slice(0, 100);
  } else {
    const { data, error } = await base();
    requireResult(error);
    rows = (data ?? []) as unknown as JobQueryRow[];
  }
  const result = rows.map((job) => {
    const { tour, ...rest } = job;
    const tourName = joinedSingle(tour)?.name ?? null;
    return {
      id: job.id, title: job.title,
      date: job.start_time ? String(job.start_time).slice(0, 10) : "sin fecha",
      job_type: job.job_type, tour_id: job.tour_id, tour_date_id: job.tour_date_id,
      tour_name: tourName,
      option: jobOption({ ...rest, tourName }),
    };
  });
  return json({ ok: true, jobs: result, options: result.map((row) => row.option) });
}
type UploadParams = {
  file: File; name: string; jobId: string; key: string; destination: Destination;
  department: string; artistName: string; artistDate: string | null; stage: number | null;
};

function parseUpload(form: FormData): UploadParams {
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "missing_file");
  if (file.size <= 0) throw new ApiError(400, "empty_file");
  if (file.size > MAX_FILE_BYTES) throw new ApiError(413, "file_too_large");
  const name = fileName(String(form.get("file_name") || file.name));
  const jobId = String(form.get("job_id") || "");
  const key = String(form.get("request_id") || "");
  // Without a destination the request behaves as the original document import.
  const destination = String(form.get("destination") || "document");
  if (!UUID.test(jobId)) throw new ApiError(400, "invalid_job_id");
  if (!REQUEST_KEY.test(key)) throw new ApiError(400, "invalid_request_id");
  if (destination !== "document" && destination !== "rider") throw new ApiError(400, "invalid_destination");
  const params: UploadParams = {
    file, name, jobId, key, destination, department: "", artistName: "", artistDate: null, stage: null,
  };
  if (destination === "document") {
    params.department = String(form.get("department") || "");
    if (!DEPARTMENTS.has(params.department)) throw new ApiError(400, "invalid_department");
    return params;
  }
  const artistName = validArtistName(String(form.get("artist_name") || ""));
  if (!artistName) throw new ApiError(400, "invalid_artist_name");
  params.artistName = artistName;
  const rawDate = String(form.get("artist_date") || "").trim();
  if (rawDate) {
    params.artistDate = validIsoDate(rawDate);
    if (!params.artistDate) throw new ApiError(400, "invalid_artist_date");
  }
  const rawStage = String(form.get("stage") || "").trim();
  if (rawStage) {
    const stage = Number(rawStage);
    if (!Number.isInteger(stage) || stage < 1 || stage > 4) throw new ApiError(400, "invalid_stage");
    params.stage = stage;
  }
  return params;
}

// Riders sent to a tour date are stored as tour documents; everything else follows the request.
function resolveKind(p: UploadParams, jobType: string | null): "document" | "rider" | "tour_document" {
  if (p.destination === "document") return "document";
  return jobType === "tourdate" ? "tour_document" : "rider";
}

function sameRequest(existing: Receipt, kind: string, p: UploadParams): boolean {
  return existing.job_id === p.jobId && existing.destination === kind &&
    existing.file_name === p.name && Number(existing.file_size) === p.file.size &&
    (kind === "document"
      ? existing.department === p.department
      : existing.artist_name === p.artistName);
}

async function upload(req: Request, admin: DB): Promise<Response> {
  const actor = await shortcutIdentity(req, admin);
  const quota = await checkEdgeRateLimit({
    req, supabase: admin, scope: "ios-share-import.upload",
    identifierParts: [actor.tokenId], includeIp: false, includeUserAgent: false,
    windowSeconds: 3600, maxRequests: 120,
    salt: Deno.env.get("EDGE_RATE_LIMIT_HASH_SECRET") ?? getEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  });
  if (!quota.allowed) throw new ApiError(429, "rate_limited");
  const p = parseUpload(await readForm(req));
  const { file, name, jobId, key } = p;

  const { data: job, error: jobError } = await admin.from("jobs")
    .select("id,start_time,job_type,tour_id").eq("id", jobId).maybeSingle();
  requireResult(jobError);
  if (!job) throw new ApiError(404, "job_not_found");

  const tokenId = actor.tokenId!;
  const { data: existingRow, error: existingError } = await admin
    .from("ios_share_import_receipts").select("*").eq("token_id", tokenId)
    .eq("request_key", key).maybeSingle();
  requireResult(existingError);
  const existing = existingRow as Receipt | null;
  const kind = resolveKind(p, job.job_type);
  if (kind !== "document" && !acceptsRiders(job.job_type)) throw new ApiError(400, "rider_not_allowed_for_job_type");
  if (existing && !sameRequest(existing, kind, p)) throw new ApiError(409, "idempotency_key_reused");

  const target: ImportTarget = kind === "document"
    ? documentTarget(admin, jobId, p.department)
    : kind === "tour_document"
    ? tourDocumentTarget(admin, job, p.artistName)
    : await riderTarget(admin, {
      job, artistName: p.artistName, artistDate: p.artistDate, stage: p.stage,
      existingArtistId: existing?.artist_id ?? null,
    });
  const completed = (r: Receipt | null) => r?.[target.confirmColumn] ?? null;
  const reusedResponse = (id: string) =>
    json({ ok: true, ...target.response(), [target.confirmColumn]: id, file_name: name, reused: true });

  if (existing && completed(existing)) return reusedResponse(completed(existing) as string);

  const path = existing?.file_path || target.newPath(name);
  let receipt: Receipt;
  if (existing) {
    receipt = existing;
    // Recover a completed metadata insert if receipt confirmation failed.
    const orphanedId = await target.findRecord(path);
    if (orphanedId) {
      const { error } = await admin.from("ios_share_import_receipts")
        .update({ [target.confirmColumn]: orphanedId, completed_at: new Date().toISOString() }).eq("id", receipt.id);
      requireResult(error);
      return reusedResponse(orphanedId);
    }
    if (Date.now() - Date.parse(existing.created_at) < STALE_UPLOAD_MS) {
      throw new ApiError(409, "upload_in_progress");
    }
    // The abandoned upload is older than STALE_UPLOAD_MS and has no metadata row.
    const { error: removeError } = await admin.storage.from(target.bucket).remove([path]);
    if (removeError) throw new ApiError(503, "stale_upload_cleanup_failed");
  } else {
    const { data, error } = await admin.from("ios_share_import_receipts")
      .insert({
        token_id: tokenId, request_key: key, user_id: actor.id, job_id: jobId,
        file_name: name, file_path: path, file_size: file.size, ...target.receiptFields,
      }).select("*").single();
    // A simultaneous retry is not allowed to create a second storage object.
    if (error?.code === "23505") {
      await target.rollback();
      throw new ApiError(409, "upload_in_progress");
    }
    if (error) await target.rollback();
    requireResult(error);
    receipt = data as Receipt;
  }
  const mime = file.type || "application/octet-stream";
  try {
    const { error: storageError } = await admin.storage.from(target.bucket)
      .upload(path, file, { cacheControl: "0", contentType: mime, upsert: false });
    if (storageError) {
      logEvent("error", "ios_share_import.storage_failure");
      throw new ApiError(502, "storage_upload_failed");
    }
    let recordId: string;
    try {
      recordId = await target.insertRecord({ path, name, mime, size: file.size, actorId: actor.id });
    } catch (insertError) {
      await admin.storage.from(target.bucket).remove([path]);
      throw insertError;
    }
    const { error: confirmationError } = await admin.from("ios_share_import_receipts")
      .update({ [target.confirmColumn]: recordId, completed_at: new Date().toISOString() })
      .eq("id", receipt.id);
    requireResult(confirmationError, "receipt_confirmation_failed");
    await target.afterConfirm(name, actor.id);
    return json({ ok: true, ...target.response(), [target.confirmColumn]: recordId, file_name: name }, 201);
  } catch (error) {
    // On a failed upload/DB insert there is no durable record. Release the
    // receipt (and an artist created only for it) so an immediate retry with
    // the same request_id can proceed.
    if (!(await target.findRecord(path))) {
      await admin.from("ios_share_import_receipts").delete().eq("id", receipt.id);
      await target.rollback();
    }
    throw error;
  }
}
serve(createHttpHandler(async (req: Request): Promise<Response> => {
  try {
    const admin = createAdmin();
    // Public gateway: impose a durable ingress limit before token lookup or parsing.
    const ingress = await checkEdgeRateLimit({
      req, supabase: admin, scope: "ios-share-import.ingress",
      windowSeconds: 60, maxRequests: 120,
      salt: Deno.env.get("EDGE_RATE_LIMIT_HASH_SECRET") ?? getEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    });
    if (!ingress.allowed) throw new ApiError(429, "rate_limited");
    const url = new URL(req.url);
    if (req.method === "GET" && url.searchParams.get("action") === "jobs") {
      return await jobs(req, admin);
    }
    if (req.method === "POST" && req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      return await upload(req, admin);
    }
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      const body = await readJson(req);
      switch (body.action) {
        case "pair": return await pair(req, admin, body);
        case "devices": return await devices(req, admin);
        case "revoke": return await revoke(req, admin, body);
        default: throw new ApiError(400, "invalid_action");
      }
    }
    throw new ApiError(405, "unsupported_request");
  } catch (error) {
    return fail(error);
  }
}, { allowedMethods: ["GET", "POST"] }));
