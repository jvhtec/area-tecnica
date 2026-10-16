import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Native Shortcuts callers cannot use the PWA's Supabase session. They use an
// opaque, revocable, import-only token in X-Share-Token. Pair/revoke requires
// the user's normal Supabase JWT and never returns existing token secrets.
const ALLOWED_ROLES = new Set(["admin", "management", "logistics", "house_tech"]);
const DEPARTMENTS = new Set(["sound", "lights", "video", "production", "personnel", "logistics", "administrative"]);
const TOKEN_TTL_DAYS = 90;
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
  job_id: string; department: string; file_name: string; file_path: string;
  file_size: number; document_id: string | null; created_at: string;
};

class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}
function fail(error: unknown): Response {
  if (error instanceof ApiError) return json({ ok: false, error: error.code }, error.status);
  console.error("[ios-share-import] unexpected error", error);
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
  if (error) { console.error("[ios-share-import] database operation failed", error.message); throw new ApiError(500, code); }
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
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) {
    throw new ApiError(401, "expired_or_revoked_token");
  }
  const role = await currentRole(admin, data.user_id);
  // Non-critical bookkeeping must never interfere with a completed upload.
  void admin.from("ios_share_import_tokens").update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id).then(({ error: e }) => { if (e) console.warn("[ios-share-import] last-used update", e.message); });
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
    raw = new TextDecoder().decode(new Blob(chunks) ? await new Blob(chunks).arrayBuffer() : new Uint8Array());
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
    body: new Blob(chunks),
  });
  try { return await safeRequest.formData(); } catch { throw new ApiError(400, "invalid_form_data"); }
}
function fileName(value: string): string {
  // Keep human-readable original name. A slash or control character cannot
  // legitimately belong to an iOS filename. Never use this name as a path.
  if (!value || value.length > 255 || /[\\/\x00-\x1F\x7F]/.test(value) || value === "." || value === "..") {
    throw new ApiError(400, "invalid_file_name");
  }
  return value;
}
function objectPath(dept: string, jobId: string, name: string, objectId: string): string {
  // Storage key is separate from file_name. Unknown and Unicode extensions
  // are allowed; the key safely omits characters unsuitable for Storage.
  const suffix = name.includes(".") ? name.split(".").at(-1)?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) : "";
  return `${dept}/${jobId}/${objectId}${suffix ? "." + suffix : ""}`;
}
async function pair(req: Request, admin: DB, body: Record<string, unknown>): Promise<Response> {
  const user = await sessionIdentity(req, admin);
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "iPhone";
  if (!label) throw new ApiError(400, "invalid_label");
  const { count, error: countError } = await admin.from("ios_share_import_tokens")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id)
    .is("revoked_at", null).gt("expires_at", new Date().toISOString());
  requireResult(countError);
  if ((count || 0) >= MAX_ACTIVE_TOKENS) throw new ApiError(409, "too_many_devices");
  const secret = `ati_${hexRandom(32)}`;
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin.from("ios_share_import_tokens")
    .insert({ user_id: user.id, label, token_hash: await sha256(secret), expires_at: expiresAt })
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
async function jobs(req: Request, admin: DB): Promise<Response> {
  await shortcutIdentity(req, admin);
  const url = new URL(req.url);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  let query = admin.from("jobs")
    .select("id,title,start_time,job_type,tour_id,tour_date_id,status");
  if (search) {
    // Escape LIKE metacharacters, retaining literal title searching.
    const literal = search.replace(/[\\%_]/g, "\\$&");
    query = query.ilike("title", `%${literal}%`).order("start_time", { ascending: false });
  } else {
    const oldest = new Date(Date.now() - 14 * 86_400_000).toISOString();
    query = query.gte("start_time", oldest).order("start_time", { ascending: true });
  }
  const { data, error } = await query.limit(100);
  requireResult(error);
  const rows = (data ?? []).map((job) => {
    const date = job.start_time ? String(job.start_time).slice(0, 10) : "sin fecha";
    const title = String(job.title ?? "Sin título").replace(/[\r\n|]/g, " ").slice(0, 110);
    const type = job.job_type === "tourdate" ? "Fecha de gira" : String(job.job_type || "Trabajo");
    return {
      id: job.id, title: job.title, date, job_type: job.job_type,
      tour_id: job.tour_id, tour_date_id: job.tour_date_id,
      // First field is UUID so Shortcuts can Split Text by " | " and take First Item.
      option: `${job.id} | ${date} | ${type} | ${title}`,
    };
  });
  return json({ ok: true, jobs: rows, options: rows.map((row) => row.option) });
}
async function upload(req: Request, admin: DB): Promise<Response> {
  const actor = await shortcutIdentity(req, admin);
  const form = await readForm(req);
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "missing_file");
  if (file.size <= 0) throw new ApiError(400, "empty_file");
  if (file.size > MAX_FILE_BYTES) throw new ApiError(413, "file_too_large");
  const name = fileName(String(form.get("file_name") || file.name));
  const jobId = String(form.get("job_id") || "");
  const dept = String(form.get("department") || "");
  const key = String(form.get("request_id") || "");
  if (!UUID.test(jobId)) throw new ApiError(400, "invalid_job_id");
  if (!DEPARTMENTS.has(dept)) throw new ApiError(400, "invalid_department");
  if (!REQUEST_KEY.test(key)) throw new ApiError(400, "invalid_request_id");

  const { data: job, error: jobError } = await admin.from("jobs")
    .select("id").eq("id", jobId).maybeSingle();
  requireResult(jobError);
  if (!job) throw new ApiError(404, "job_not_found");

  const tokenId = actor.tokenId!;
  const { data: existing, error: existingError } = await admin
    .from("ios_share_import_receipts").select("*").eq("token_id", tokenId)
    .eq("request_key", key).maybeSingle();
  requireResult(existingError);
  if (existing && (existing.job_id !== jobId || existing.department !== dept ||
      existing.file_name !== name || Number(existing.file_size) !== file.size)) {
    throw new ApiError(409, "idempotency_key_reused");
  }
  if (existing?.document_id) {
    return json({ ok: true, document_id: existing.document_id, file_name: name, reused: true });
  }
  if (existing && Date.now() - Date.parse(existing.created_at) < 120_000) {
    throw new ApiError(409, "upload_in_progress");
  }
  const path = existing?.file_path || objectPath(dept, jobId, name, crypto.randomUUID());
  let receipt: Receipt;
  if (existing) {
    receipt = existing as Receipt;
    // Recover a completed metadata insert if receipt confirmation failed.
    const { data: orphanedRow, error: rowError } = await admin.from("job_documents")
      .select("id").eq("job_id", jobId).eq("file_path", path).maybeSingle();
    requireResult(rowError);
    if (orphanedRow) {
      const { error } = await admin.from("ios_share_import_receipts")
        .update({ document_id: orphanedRow.id, completed_at: new Date().toISOString() }).eq("id", receipt.id);
      requireResult(error);
      return json({ ok: true, document_id: orphanedRow.id, file_name: name, reused: true });
    }
    // The abandoned upload is older than 2 minutes and has no metadata row.
    const { error: removeError } = await admin.storage.from("job_documents").remove([path]);
    if (removeError) throw new ApiError(503, "stale_upload_cleanup_failed");
  } else {
    const { data, error } = await admin.from("ios_share_import_receipts")
      .insert({
        token_id: tokenId, request_key: key, user_id: actor.id, job_id: jobId,
        department: dept, file_name: name, file_path: path, file_size: file.size,
      }).select("*").single();
    // A simultaneous retry is not allowed to create a second storage object.
    if (error?.code === "23505") throw new ApiError(409, "upload_in_progress");
    requireResult(error);
    receipt = data as Receipt;
  }
  const mime = file.type || "application/octet-stream";
  try {
    const { error: storageError } = await admin.storage.from("job_documents")
      .upload(path, file, { cacheControl: "0", contentType: mime, upsert: false });
    if (storageError) {
      console.error("[ios-share-import] storage upload", storageError.message);
      throw new ApiError(502, "storage_upload_failed");
    }
    const { data: inserted, error: insertError } = await admin.from("job_documents")
      .insert({
        job_id: jobId, file_name: name, file_path: path,
        file_type: mime, file_size: file.size, uploaded_by: actor.id,
        original_type: null, visible_to_tech: true,
      }).select("id").single();
    if (insertError || !inserted) {
      await admin.storage.from("job_documents").remove([path]);
      requireResult(insertError, "document_registration_failed");
      throw new ApiError(500, "document_registration_failed");
    }
    const { error: confirmationError } = await admin.from("ios_share_import_receipts")
      .update({ document_id: inserted.id, completed_at: new Date().toISOString() })
      .eq("id", receipt.id);
    requireResult(confirmationError, "receipt_confirmation_failed");
    return json({ ok: true, document_id: inserted.id, job_id: jobId, department: dept, file_name: name }, 201);
  } catch (error) {
    // On a failed upload/DB insert there is no durable document. Release
    // the receipt so an immediate retry with the same request_id can proceed.
    const { data: documentRow } = await admin.from("job_documents")
      .select("id").eq("job_id", jobId).eq("file_path", path).maybeSingle();
    if (!documentRow) await admin.from("ios_share_import_receipts").delete().eq("id", receipt.id);
    throw error;
  }
}
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const admin = createAdmin();
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
});
