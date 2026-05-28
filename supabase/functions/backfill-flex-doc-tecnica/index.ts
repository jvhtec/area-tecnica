import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveFlexAuthToken } from "../_shared/flexAuthToken.ts";

type Dept = "sound" | "lights" | "video" | "production" | "personnel" | "comercial" | "logistics" | "administrative";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FLEX_API_BASE_URL = Deno.env.get("FLEX_API_BASE_URL") || "https://sectorpro.flexrentalsolutions.com/f5/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

function ensureAuth(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h) throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '');
}

const DEF_ID_DOCUMENTACION_TECNICA = "3787806c-af2d-11df-b8d5-00e08175e43e";

/**
 * Fetches the element tree for a Flex element and returns its nodes.
 *
 * @param elementId - The Flex element identifier to retrieve the tree for
 * @param flexAuthToken - Flex API token used as `X-Auth-Token` and `apikey`
 * @returns An array of node objects representing the element's tree (children if present)
 * @throws Error if `flexAuthToken` is missing or the Flex API responds with an error
 */
async function fetchElementTree(elementId: string, flexAuthToken: string): Promise<any[]> {
  if (!flexAuthToken) throw new Error('Missing FLEX auth token');
  const r = await fetch(`${FLEX_API_BASE_URL}/element/${encodeURIComponent(elementId)}/tree`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': flexAuthToken,
      'apikey': flexAuthToken,
      'accept': '*/*',
    }
  });
  if (!r.ok) {
    let e: any = {}; try { e = await r.json(); } catch {}
    throw new Error(e?.exceptionMessage || `tree ${r.status}`);
  }
  const d = await r.json().catch(() => ([]));
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'children' in d) return (d as any).children || [];
  return [d];
}

function nodeName(n: any): string { return n?.displayName || n?.name || ''; }

function findDocTec(nodes: any[]): string[] {
  const ids: string[] = [];
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.shift();
    if (!n || typeof n !== 'object') continue;
    const defId = typeof n.definitionId === 'string' ? n.definitionId : (typeof n.elementDefinitionId === 'string' ? n.elementDefinitionId : undefined);
    const nm = normalize(nodeName(n));
    const el = typeof n.elementId === 'string' ? n.elementId : (typeof n.id === 'string' ? n.id : undefined);
    if (el && (defId === DEF_ID_DOCUMENTACION_TECNICA || nm.includes(normalize('Documentación Técnica')))) {
      ids.push(el);
    }
    if (Array.isArray(n.children)) stack.push(...n.children);
  }
  return Array.from(new Set(ids));
}

async function getMainElementId(sb: ReturnType<typeof createClient>, jobId: string): Promise<string | null> {
  try {
    const { data, error } = await sb
      .from('flex_folders')
      .select('element_id, folder_type, parent_id')
      .eq('job_id', jobId);
    if (error || !data || data.length === 0) return null;
    const main = data.find((r: any) => r.folder_type === 'main_event')
      || data.find((r: any) => r.folder_type === 'main')
      || data.find((r: any) => r.folder_type === 'job');
    if (main?.element_id) return main.element_id;
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
      .select('flex_sound_folder_id, flex_lights_folder_id, flex_video_folder_id, flex_production_folder_id, flex_personnel_folder_id, flex_comercial_folder_id')
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
    case 'lights': return ['lights', 'luces', 'lighting', 'iluminacion', 'iluminación'];
    case 'video': return ['video', 'vídeo'];
    case 'production': return ['production', 'produccion', 'producción', 'rigging'];
    default: return [dept];
  }
}

function findDocTecByDeptInTree(nodes: any[], dept: Dept): string[] {
  const want = deptKeywords(dept).map(normalize);
  const stack = [...nodes];
  const ids: string[] = [];
  while (stack.length) {
    const n = stack.shift();
    if (!n || typeof n !== 'object') continue;
    const defId = typeof n.definitionId === 'string' ? n.definitionId : (typeof n.elementDefinitionId === 'string' ? n.elementDefinitionId : undefined);
    const nm = normalize(nodeName(n));
    const el = typeof n.elementId === 'string' ? n.elementId : (typeof n.id === 'string' ? n.id : undefined);
    const isDoc = defId === DEF_ID_DOCUMENTACION_TECNICA || nm.includes(normalize('Documentación Técnica'));
    if (el && isDoc && want.some(w => nm.includes(w))) ids.push(el);
    if (Array.isArray(n.children)) stack.push(...n.children);
  }
  return Array.from(new Set(ids));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Not found' }, 404);
  try { ensureAuth(req); } catch (e) { return e as Response; }

  const { job_id, departments, manual } = await req.json().catch(() => ({}));
  if (!job_id) return json({ error: 'Missing job_id' }, 400);

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

  // 1) Candidate roots: department folders, tour-level folders per dept, and main job element
  const { data: deptRows } = await sb
    .from('flex_folders')
    .select('element_id, department')
    .eq('job_id', job_id)
    .eq('folder_type', 'department');

  const depts = (departments && Array.isArray(departments) ? departments : undefined) as Dept[] | undefined;
  const filteredDept = (deptRows || []).filter(r => r?.element_id && r?.department && (!depts || depts.includes(r.department as Dept)));

  const candidates: Array<{ dept: Dept | null; elementId: string }> = [];
  for (const row of filteredDept) {
    candidates.push({ dept: row.department as Dept, elementId: row.element_id as string });
  }
  // Tour-level candidates
  const targetDepts: Dept[] = (depts && depts.length ? depts : ["sound","lights","video","production"]) as Dept[];
  for (const d of targetDepts) {
    try {
      const el = await getTourDeptFolderElementId(sb, job_id, d);
      if (el) candidates.push({ dept: d, elementId: el });
    } catch (_) {}
  }
  // Main element as last resort (dept unknown)
  const mainEl = await getMainElementId(sb, job_id);
  if (mainEl) candidates.push({ dept: null, elementId: mainEl });

  let inserted = 0;
  let already = 0;
  const details: Array<{ dept: string; elementId: string; status: string }> = [];

  // 0) Manual overrides
  if (Array.isArray(manual) && manual.length) {
    for (const m of manual) {
      try {
        const dept = (m?.dept || m?.department || '').toString();
        const elementId = (m?.element_id || m?.elementId || '').toString();
        if (!dept || !elementId) {
          details.push({ dept: dept || 'unknown', elementId: elementId || 'missing', status: 'error:invalid_manual_entry' });
          continue;
        }
        const { data: exists } = await sb
          .from('flex_folders')
          .select('id')
          .eq('job_id', job_id)
          .eq('folder_type', 'doc_tecnica')
          .eq('department', dept)
          .maybeSingle();
        if (exists?.id) {
          already += 1;
          details.push({ dept, elementId, status: 'exists' });
          continue;
        }
        const { error: insErr } = await sb.from('flex_folders').insert({
          job_id,
          parent_id: null,
          element_id: elementId,
          department: dept,
          folder_type: 'doc_tecnica',
        });
        if (insErr) {
          details.push({ dept, elementId, status: `error:${insErr.message}` });
        } else {
          inserted += 1;
          details.push({ dept, elementId, status: 'manual_inserted' });
        }
      } catch (e: any) {
        details.push({ dept: (m?.dept || m?.department || 'unknown').toString(), elementId: (m?.element_id || m?.elementId || 'unknown').toString(), status: `error:${e?.message || e}` });
      }
    }
  }

  for (const row of candidates) {
    try {
      const tree = await fetchElementTree(row.elementId as string, flexAuthToken);
      let docIds: string[] = [];
      if (row.dept) {
        // Prefer department-targeted discovery
        docIds = findDocTecByDeptInTree(tree, row.dept);
      }
      if (docIds.length === 0) {
        // Generic discovery (may return multiple doc_tecnica nodes)
        docIds = findDocTec(tree);
      }
      if (docIds.length === 0) continue;
      for (const elId of docIds) {
        const { data: exists } = await sb
          .from('flex_folders')
          .select('id')
          .eq('job_id', job_id)
          .eq('element_id', elId)
          .eq('folder_type', 'doc_tecnica')
          .maybeSingle();
        if (exists?.id) {
          already += 1;
          details.push({ dept: (row.dept || 'unknown') as string, elementId: elId, status: 'exists' });
          continue;
        }
        const { error: insErr } = await sb.from('flex_folders').insert({
          job_id,
          parent_id: row.elementId,
          element_id: elId,
          department: row.dept,
          folder_type: 'doc_tecnica',
        });
        if (insErr) {
          details.push({ dept: (row.dept || 'unknown') as string, elementId: elId, status: `error:${insErr.message}` });
        } else {
          inserted += 1;
          details.push({ dept: (row.dept || 'unknown') as string, elementId: elId, status: 'inserted' });
        }
      }
    } catch (e: any) {
      details.push({ dept: (row.dept || 'unknown') as string, elementId: row.elementId as string, status: `error:${e?.message || e}` });
    }
  }

  return json({ ok: true, job_id, checked: candidates.length, inserted, already, details });
});
