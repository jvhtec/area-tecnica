import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveFlexAuthToken } from "../_shared/flexAuthToken.ts";

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Flex API config
const FLEX_API_BASE_URL = Deno.env.get("FLEX_API_BASE_URL") || "https://sectorpro.flexrentalsolutions.com/f5/api";

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

function detectDeptFromFilename(name: string): Dept | null {
  const n = (name || '').toLowerCase();
  if (n.includes('sound') || n.includes('sonido')) return 'sound';
  if (n.includes('lights') || n.includes('light') || n.includes('iluminacion') || n.includes('iluminación')) return 'lights';
  if (n.includes('video') || n.includes('vídeo')) return 'video';
  if (n.includes('rigging') || n.includes('prod')) return 'production';
  return null;
}

type FlexAddLinePayload = {
  filename: string;
  mimetype: string;
  filesize: number;
  url?: string;
  // Flex API accepts raw byte content as JSON array of numbers too
  content?: number[] | number[][];
  notes?: string;
};

async function addRemoteFileLine(remoteFileListId: string, payload: FlexAddLinePayload, flexAuthToken: string): Promise<{ ok: true; data: any } | { ok: false; status: number; error?: any }> {
  if (!flexAuthToken) {
    return { ok: false, status: 500, error: "Missing FLEX auth token" };
  }
  try {
    const res = await fetch(`${FLEX_API_BASE_URL}/remote-file/${encodeURIComponent(remoteFileListId)}/add-line`, {
      method: "PUT",
      headers: {
        "accept": "*/*",
        "Content-Type": "application/json",
        "X-Auth-Token": flexAuthToken,
        "apikey": flexAuthToken,
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

async function fetchFileBytes(url: string): Promise<number[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch file failed ${res.status}`);
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  // Convert to plain numbers for JSON
  return Array.from(bytes);
}

// Flex element definition IDs we care about
const DEF_ID_DOCUMENTACION_TECNICA = "3787806c-af2d-11df-b8d5-00e08175e43e"; // same id used in FE constants

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

// Simple cache helpers
const deptFolderCache = new Map<string, string | null>(); // key `${jobId}:${dept}` -> element_id
const docTecCache = new Map<string, string | null>(); // key deptFolderElementId -> doc_tecnica element id

async function getDepartmentFolderElementId(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  dept: Dept,
): Promise<string | null> {
  const key = `${jobId}:${dept}`;
  if (deptFolderCache.has(key)) return deptFolderCache.get(key)!;
  const { data, error } = await sb
    .from("flex_folders")
    .select("element_id")
    .eq("job_id", jobId)
    .eq("department", dept)
    .eq("folder_type", "department")
    .maybeSingle();
  const val = error ? null : (data?.element_id ?? null);
  deptFolderCache.set(key, val);
  return val;
}

async function fetchElementTree(elementId: string, flexAuthToken: string): Promise<any[]> {
  if (!flexAuthToken) throw new Error("Missing FLEX auth token");
  const res = await fetch(`${FLEX_API_BASE_URL}/element/${encodeURIComponent(elementId)}/tree`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": flexAuthToken,
      "apikey": flexAuthToken,
      "accept": "*/*",
    },
  });
  if (!res.ok) {
    let err: any = {};
    try { err = await res.json(); } catch {}
    throw new Error(err?.exceptionMessage || `Tree fetch failed (${res.status})`);
  }
  const data = await res.json().catch(() => ([]));
  // Normalize to array of nodes with children
  if (Array.isArray(data)) return data as any[];
  if (data && typeof data === 'object' && 'children' in data && Array.isArray((data as any).children)) {
    return (data as any).children as any[];
  }
  return [data];
}

function nodeName(n: any): string {
  return (typeof n?.displayName === 'string' && n.displayName)
    || (typeof n?.name === 'string' && n.name)
    || '';
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '');
}

function findDocTecnicaInTree(nodes: any[]): string | null {
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.shift();
    if (!n || typeof n !== 'object') continue;
    const defId = typeof n.definitionId === 'string' ? n.definitionId : (typeof n.elementDefinitionId === 'string' ? n.elementDefinitionId : undefined);
    const nm = normalize(nodeName(n));
    const isDoc = defId === DEF_ID_DOCUMENTACION_TECNICA || nm.includes(normalize('Documentación Técnica'));
    const elementId = typeof n.elementId === 'string' ? n.elementId : (typeof n.id === 'string' ? n.id : undefined);
    if (isDoc && elementId) return elementId;
    if (Array.isArray(n.children)) stack.push(...n.children);
  }
  return null;
}

async function resolveDocTecnicaByTree(
  deptFolderElementId: string,
  flexAuthToken: string,
): Promise<string | null> {
  if (!deptFolderElementId) return null;
  if (docTecCache.has(deptFolderElementId)) return docTecCache.get(deptFolderElementId)!;
  try {
    const tree = await fetchElementTree(deptFolderElementId, flexAuthToken);
    const docId = findDocTecnicaInTree(tree);
    docTecCache.set(deptFolderElementId, docId);
    return docId;
  } catch (e) {
    console.warn('[archive-to-flex] tree fallback failed', e);
    docTecCache.set(deptFolderElementId, null);
    return null;
  }
}

async function getMainElementId(
  sb: ReturnType<typeof createClient>,
  jobId: string
): Promise<string | null> {
  try {
    const { data, error } = await sb
      .from('flex_folders')
      .select('element_id, folder_type, parent_id')
      .eq('job_id', jobId);
    if (error || !data || data.length === 0) return null;
    // Prefer explicit main markers
    const main = data.find((r: any) => r.folder_type === 'main_event')
      || data.find((r: any) => r.folder_type === 'main')
      || data.find((r: any) => r.folder_type === 'job');
    if (main?.element_id) return main.element_id;
    // Fallback: any row without a parent_id
    const root = data.find((r: any) => !r.parent_id && r.element_id);
    return root?.element_id ?? null;
  } catch (_) {
    return null;
  }
}

async function getTourDeptFolderElementId(
  sb: ReturnType<typeof createClient>,
  jobId: string,
  dept: Dept,
): Promise<string | null> {
  try {
    const { data: job, error: jobErr } = await sb.from('jobs').select('tour_id').eq('id', jobId).maybeSingle();
    if (jobErr || !job?.tour_id) return null;
    const { data: tour, error: tourErr } = await sb
      .from('tours')
      .select('flex_main_folder_id, flex_sound_folder_id, flex_lights_folder_id, flex_video_folder_id, flex_production_folder_id, flex_personnel_folder_id, flex_comercial_folder_id')
      .eq('id', job.tour_id)
      .maybeSingle();
    if (tourErr || !tour) return null;
    const map: Record<string, string | null | undefined> = {
      sound: tour.flex_sound_folder_id,
      lights: tour.flex_lights_folder_id,
      video: tour.flex_video_folder_id,
      production: tour.flex_production_folder_id,
      personnel: tour.flex_personnel_folder_id,
      comercial: tour.flex_comercial_folder_id,
      logistics: null,
      administrative: null,
    };
    return (map[dept] as string | null | undefined) ?? null;
  } catch (_) {
    return null;
  }
}

function deptKeywords(dept: Dept): string[] {
  switch (dept) {
    case 'sound': return ['sound', 'sonido'];
    case 'lights': return ['lights', 'luces', 'lighting'];
    case 'video': return ['video', 'vídeo'];
    case 'production': return ['production', 'produccion', 'producción'];
    default: return [dept];
  }
}

function findDocTecByDeptInTree(nodes: any[], dept: Dept): string | null {
  const want = deptKeywords(dept).map(normalize);
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.shift();
    if (!n || typeof n !== 'object') continue;
    const defId = typeof n.definitionId === 'string' ? n.definitionId : (typeof n.elementDefinitionId === 'string' ? n.elementDefinitionId : undefined);
    const nm = normalize(nodeName(n));
    const elementId = typeof n.elementId === 'string' ? n.elementId : (typeof n.id === 'string' ? n.id : undefined);
    const isDoc = defId === DEF_ID_DOCUMENTACION_TECNICA || nm.includes(normalize('Documentación Técnica'));
    if (isDoc && elementId) {
      // Ensure department hint appears in the name if possible
      if (want.some(w => nm.includes(w))) return elementId;
    }
    if (Array.isArray(n.children)) stack.push(...n.children);
  }
  return null;
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

  // Resolve per-user Flex API token
  let actorId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      actorId = data.user?.id ?? null;
    }
  } catch (_) { /* ignore */ }
  const flexAuthToken = await resolveFlexAuthToken(sb, actorId);

  // Load selected departments for the job (used for better defaults)
  async function getJobSelectedDepartments(): Promise<Dept[]> {
    try {
      const { data, error } = await sb
        .from('job_departments')
        .select('department')
        .eq('job_id', jobId);
      if (error || !data) return [];
      const vals = data.map((r: any) => r.department).filter(Boolean);
      const allowed: string[] = ["sound","lights","video","production","personnel","comercial","logistics","administrative"];
      return vals.filter((d: string) => allowed.includes(d)) as Dept[];
    } catch (_) {
      return [];
    }
  }
  const selectedDepts = await getJobSelectedDepartments();

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
    details: [] as Array<{ docId: string; file: string; deptTargets: Dept[]; rflIds: string[]; status: string; error?: unknown; flex?: Array<{ rflId: string; mode: 'content' | 'url'; status: number; data?: unknown; error?: unknown }> }>,
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
      // Try path-based, then filename-based, else fall back to selected technical departments
      let inferred: Dept | null = detectDeptFromPath(doc.file_path);
      if (!inferred) inferred = detectDeptFromFilename(doc.file_name);
      if (inferred) {
        targetDepts = [inferred];
      } else {
        const selectedTech = (selectedDepts.length ? selectedDepts : TECH_DEPTS).filter((d) => TECH_DEPTS.includes(d));
        targetDepts = selectedTech.length ? (selectedTech as Dept[]) : TECH_DEPTS;
      }
      // Respect explicit department filter if provided
      if (explicitDepts.length) {
        targetDepts = targetDepts.filter((d) => explicitDepts.includes(d));
      }
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
      let rfl = targets.get(dept);
      if (!rfl) {
        // Fallback 1: from department folder via tree
        try {
          const deptFolderElementId = await getDepartmentFolderElementId(sb, jobId, dept);
          if (deptFolderElementId) {
            const docTecId = await resolveDocTecnicaByTree(deptFolderElementId, flexAuthToken);
            if (docTecId) {
              targets.set(dept, docTecId);
              rfl = docTecId;
            }
          }
        } catch (_) {}

        // Fallback 1a: tour-level department folder
        if (!rfl) {
          try {
            const tourDeptFolderId = await getTourDeptFolderElementId(sb, jobId, dept);
            if (tourDeptFolderId) {
              const docTecId = await resolveDocTecnicaByTree(tourDeptFolderId, flexAuthToken);
              if (docTecId) {
                targets.set(dept, docTecId);
                rfl = docTecId;
                await sb.from('flex_folders').insert({
                  job_id: jobId,
                  element_id: docTecId,
                  department: dept,
                  folder_type: 'doc_tecnica',
                }).select().limit(1);
              }
            }
          } catch (_) {}
        }

        // Fallback 2: from main element tree by matching department in the name
        if (!rfl) {
          try {
            const mainEl = await getMainElementId(sb, jobId);
            if (mainEl) {
              const tree = await fetchElementTree(mainEl, flexAuthToken);
              const docTecId = findDocTecByDeptInTree(tree, dept);
              if (docTecId) {
                targets.set(dept, docTecId);
                rfl = docTecId;
                // Best-effort persist for future runs (ignore errors)
                await sb.from('flex_folders').insert({
                  job_id: jobId,
                  element_id: docTecId,
                  department: dept,
                  folder_type: 'doc_tecnica',
                }).select().limit(1);
              }
            }
          } catch (e) {
            // ignore; will mark missing below
          }
        }
      }
      if (!rfl) {
        missingForAny = true;
        if (onMissing === "fail") {
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
    // Default to content-first. Set FLEX_UPLOAD_MODE=url to prefer URL first.
    const MODE = (Deno.env.get('FLEX_UPLOAD_MODE') || '').toLowerCase();
    const contentFirst = MODE !== 'url';
    let contentBytes: number[] | null = null;
    const flexResponses: Array<{ rflId: string; mode: 'content' | 'url'; status: number; data?: unknown; error?: unknown }> = [];
    for (let i = 0; i < rflIds.length; i++) {
      let res;
      if (contentFirst) {
        try {
          if (!contentBytes) {
            contentBytes = await fetchFileBytes(signed.signedUrl);
          }
          const payloadContent: FlexAddLinePayload = {
            filename,
            mimetype,
            filesize,
            content: contentBytes,
            notes: `Imported from Sector Pro (job ${jobId})`,
          };
          res = await addRemoteFileLine(rflIds[i], payloadContent, flexAuthToken);
          if (res) flexResponses.push({ rflId: rflIds[i], mode: 'content', status: (res as any).status ?? (res.ok ? 200 : 500), data: (res as any).data, error: (res as any).error });
        } catch (e) {
          console.error('[archive-to-flex] content-first exception', e);
        }
      }
      if (!res || !res.ok) {
        // Try URL mode as fallback (or primary if MODE=url)
        const payloadUrl: FlexAddLinePayload = {
          filename,
          mimetype,
          filesize,
          url: signed.signedUrl,
          notes: `Imported from Sector Pro (job ${jobId})`,
        };
        const res2 = await addRemoteFileLine(rflIds[i], payloadUrl, flexAuthToken);
        flexResponses.push({ rflId: rflIds[i], mode: 'url', status: (res2 as any).status ?? (res2.ok ? 200 : 500), data: (res2 as any).data, error: (res2 as any).error });
        if (!res2.ok) {
          allOk = false;
          console.error("[archive-to-flex] add-line failed", { rflId: rflIds[i], status: res2.status, error: res2.error });
        }
      }
    }

    if (!allOk) {
      result.failed += 1;
      for (const d of effectiveDepts) bump(d, "failed");
      // Include Flex responses to aid debugging (status/data/error per target)
      result.details.push({ docId: doc.id, file: filename, deptTargets: effectiveDepts, rflIds, status: "failed_upload", flex: flexResponses });
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
    result.details.push({ docId: doc.id, file: filename, deptTargets: effectiveDepts, rflIds, status: "uploaded_and_deleted", flex: flexResponses });
  }

  return json(result);
});
