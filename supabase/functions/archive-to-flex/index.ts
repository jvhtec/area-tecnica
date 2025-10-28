import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Dept = "sound" | "lights" | "video" | "production" | "personnel" | "comercial" | "logistics" | "administrative";

type Body = {
  job_id: string;
  mode?: "by-prefix" | "all-tech"; // default by-prefix
  departments?: Dept[]; // optional explicit target departments
  include_templates?: boolean; // default false
  on_missing_doc_tecnica?: "skip" | "fail"; // default skip
  dry_run?: boolean; // default false
};

type JobDocument = {
  id: string;
  job_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  read_only?: boolean | null;
  template_type?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Flex API config
const FLEX_API_BASE_URL = Deno.env.get("FLEX_API_BASE_URL") || "https://sectorpro.flexrentalsolutions.com/f5/api";
const FLEX_AUTH_TOKEN = Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function ensureAuthHeader(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  return header.replace("Bearer ", "").trim();
}

// Minimal bucket resolver mirroring src/utils/jobDocuments.ts
function resolveJobDocBucket(path: string): string {
  const first = (path || "").split("/")[0];
  if (first === "soundvision-files") return "soundvision-files";
  const DEPT_PREFIXES = new Set(["sound", "lights", "video", "production", "logistics", "administrative"]);
  return DEPT_PREFIXES.has(first) ? "job_documents" : "job-documents";
}

function detectDeptFromPath(path: string): Dept | null {
  const first = (path || "").split("/")[0];
  const allowed: Dept[] = ["sound", "lights", "video", "production", "personnel", "comercial", "logistics", "administrative"];
  return (allowed as string[]).includes(first) ? (first as Dept) : null;
}

async function addRemoteFileLine(remoteFileListId: string, payload: {
  filename: string;
  mimetype: string;
  filesize: number;
  url?: string;
  content?: string[];
  notes?: string;
}): Promise<{ ok: true; data: any } | { ok: false; status: number; error?: any }> {
  if (!FLEX_AUTH_TOKEN) {
    return { ok: false, status: 500, error: "Missing FLEX auth token" };
  }
  try {
    const res = await fetch(`${FLEX_API_BASE_URL}/remote-file/${encodeURIComponent(remoteFileListId)}/add-line`, {
      method: "PUT",
      headers: {
        "accept": "*/*",
        "Content-Type": "application/json",
        "X-Auth-Token": FLEX_AUTH_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, error: err };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 500, error: String(e) };
  }
}

async function getDocTecnicaTargets(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  restrictTo?: Dept[]
): Promise<Map<Dept, string>> {
  const map = new Map<Dept, string>();
  const { data, error } = await sb
    .from("flex_folders")
    .select("department, element_id, folder_type")
    .eq("job_id", jobId)
    .eq("folder_type", "doc_tecnica");
  if (error) {
    console.error("[archive-to-flex] flex_folders query error", error);
    return map;
  }
  for (const row of data || []) {
    const dept = (row.department || "") as Dept;
    if (!dept) continue;
    if (restrictTo && restrictTo.length && !restrictTo.includes(dept)) continue;
    if (row.element_id) map.set(dept, row.element_id);
  }
  return map;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Not found" }, 404);

  // Auth presence check
  try { ensureAuthHeader(req); } catch (e) { return e as Response; }

  let body: Body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const jobId = body?.job_id;
  if (!jobId) return json({ error: "Missing job_id" }, 400);

  const mode = body.mode || "by-prefix";
  const dryRun = Boolean(body.dry_run);
  const includeTemplates = Boolean(body.include_templates);
  const onMissing = body.on_missing_doc_tecnica || "skip";
  const explicitDepts = (body.departments || []) as Dept[];

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Resolve Documentación Técnica remote file list IDs per department
  const targets = await getDocTecnicaTargets(sb, jobId, explicitDepts.length ? explicitDepts : undefined);

  // Load job documents
  const { data: docs, error: docsErr } = await sb
    .from("job_documents")
    .select("id, job_id, file_name, file_path, file_size, file_type, read_only, template_type")
    .eq("job_id", jobId)
    .order("uploaded_at", { ascending: true })
    .returns<JobDocument[]>();

  if (docsErr) {
    console.error("[archive-to-flex] job_documents query error", docsErr);
    return json({ error: "Failed to load job documents" }, 500);
  }

  const result = {
    ok: true,
    attempted: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    perDepartment: {} as Record<string, { attempted: number; uploaded: number; failed: number; skipped: number }>,
    details: [] as Array<{ docId: string; file: string; deptTargets: Dept[]; rflIds: string[]; status: string; error?: unknown }>,
  };

  function bump(dept: string, key: "attempted" | "uploaded" | "failed" | "skipped") {
    if (!result.perDepartment[dept]) result.perDepartment[dept] = { attempted: 0, uploaded: 0, failed: 0, skipped: 0 };
    result.perDepartment[dept][key] += 1;
  }

  const TECH_DEPTS: Dept[] = ["sound", "lights", "video"];

  for (const doc of docs || []) {
    // Skip templates/read-only unless explicitly included
    if (!includeTemplates && (doc.read_only || doc.template_type)) {
      result.skipped += 1;
      result.details.push({ docId: doc.id, file: doc.file_name, deptTargets: [], rflIds: [], status: "skipped_template" });
      continue;
    }

    // Determine departments to target
    let targetDepts: Dept[] = [];
    if (mode === "all-tech") {
      targetDepts = TECH_DEPTS.filter((d) => !explicitDepts.length || explicitDepts.includes(d));
    } else {
      const inferred = detectDeptFromPath(doc.file_path) || ("production" as Dept);
      targetDepts = [inferred].filter((d) => !explicitDepts.length || explicitDepts.includes(d));
    }
    if (!targetDepts.length) {
      result.skipped += 1;
      result.details.push({ docId: doc.id, file: doc.file_name, deptTargets: [], rflIds: [], status: "skipped_no_target_dept" });
      continue;
    }

    // Resolve remote file list IDs to send into
    const rflIds: string[] = [];
    const effectiveDepts: Dept[] = [];
    let missingForAny = false;
    for (const dept of targetDepts) {
      const rfl = targets.get(dept);
      if (!rfl) {
        missingForAny = true;
        if (onMissing === "fail") {
          // Mark failure for this dept
          bump(dept, "failed");
        } else {
          bump(dept, "skipped");
        }
        continue;
      }
      effectiveDepts.push(dept);
      rflIds.push(rfl);
    }

    if (!rflIds.length) {
      result.skipped += 1;
      result.details.push({ docId: doc.id, file: doc.file_name, deptTargets: targetDepts, rflIds: [], status: onMissing === "fail" && missingForAny ? "failed_missing_doc_tecnica" : "skipped_missing_doc_tecnica" });
      continue;
    }

    // Prepare payload fields
    const filename = doc.file_name || doc.file_path.split("/").pop() || "document";
    const mimetype = doc.file_type || "application/octet-stream";
    const filesize = typeof doc.file_size === "number" && doc.file_size >= 0 ? doc.file_size : 0;

    // Signed URL from Supabase storage
    const bucket = resolveJobDocBucket(doc.file_path);
    const { data: signed, error: signedErr } = await sb.storage
      .from(bucket)
      .createSignedUrl(doc.file_path, 60 * 30); // 30 minutes

    if (signedErr || !signed?.signedUrl) {
      console.error("[archive-to-flex] signed URL error", { bucket, path: doc.file_path, error: signedErr });
      result.failed += 1;
      for (const d of effectiveDepts) bump(d, "failed");
      result.details.push({ docId: doc.id, file: filename, deptTargets: effectiveDepts, rflIds, status: "failed_signed_url", error: signedErr });
      continue;
    }

    // Upload to Flex for each target department
    result.attempted += 1;
    for (const d of effectiveDepts) bump(d, "attempted");

    if (dryRun) {
      result.uploaded += 1;
      for (const d of effectiveDepts) bump(d, "uploaded");
      result.details.push({ docId: doc.id, file: filename, deptTargets: effectiveDepts, rflIds, status: "dry_run" });
      continue;
    }

    let allOk = true;
    for (let i = 0; i < rflIds.length; i++) {
      const payload = {
        filename,
        mimetype,
        filesize,
        url: signed.signedUrl,
        notes: `Imported from Sector Pro (job ${jobId})`,
      };
      const res = await addRemoteFileLine(rflIds[i], payload);
      if (!res.ok) {
        allOk = false;
        console.error("[archive-to-flex] add-line failed", { rflId: rflIds[i], status: res.status, error: res.error });
      }
    }

    if (!allOk) {
      result.failed += 1;
      for (const d of effectiveDepts) bump(d, "failed");
      result.details.push({ docId: doc.id, file: filename, deptTargets: effectiveDepts, rflIds, status: "failed_upload" });
      continue;
    }

    // Cleanup: delete file in storage and DB row
    const rm = await sb.storage.from(bucket).remove([doc.file_path]);
    if (rm.error) {
      console.warn("[archive-to-flex] storage remove error", { bucket, path: doc.file_path, error: rm.error });
      // still proceed to delete DB row, but report warning
    }
    const { error: delErr } = await sb.from("job_documents").delete().eq("id", doc.id);
    if (delErr) {
      console.warn("[archive-to-flex] DB delete error", { id: doc.id, error: delErr });
    }

    result.uploaded += 1;
    for (const d of effectiveDepts) bump(d, "uploaded");
    result.details.push({ docId: doc.id, file: filename, deptTargets: effectiveDepts, rflIds, status: "uploaded_and_deleted" });
  }

  return json(result);
});

