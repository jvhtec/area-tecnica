import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Dept = "sound" | "lights" | "video";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const { job_id, departments } = await req.json() as { job_id: string; departments?: Dept[] };
    if (!job_id) throw new Error('Missing job_id');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let flexAuthToken = Deno.env.get('X_AUTH_TOKEN') || '';
    if (!flexAuthToken) {
      // Best effort: try to fetch from get-secret function if available
      try {
        const res = await fetch(new URL(req.url).origin + '/functions/v1/get-secret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'X_AUTH_TOKEN' }),
        });
        if (res.ok) {
          const j = await res.json();
          flexAuthToken = j?.X_AUTH_TOKEN || flexAuthToken;
        }
      } catch (_) {
        // ignore, will error later if still missing
      }
    }

    if (!flexAuthToken) {
      return new Response(JSON.stringify({ error: 'X_AUTH_TOKEN not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let depts: Dept[] = [];
    if (Array.isArray(departments) && departments.length) {
      depts = departments
        .map((d) => (d as string).toLowerCase() as Dept)
        .filter((d): d is Dept => ['sound','lights','video'].includes(d as string));
    } else {
      // Auto-discover departments from crew call mappings for this job
      const { data: mappedDepts, error: mapErr } = await supabase
        .from('flex_crew_calls')
        .select('department')
        .eq('job_id', job_id);
      if (!mapErr && mappedDepts?.length) {
        const uniq = Array.from(new Set(mappedDepts.map((r: any) => (r.department as string).toLowerCase())));
        depts = uniq.filter((d): d is Dept => ['sound','lights','video'].includes(d));
      }
      // Fallback if no mappings exist yet
      if (!depts.length) depts = ['sound','lights'];
    }
    const summary: Record<string, any> = {};

    for (const dept of depts) {
      // Locate the crew call mapping for this job+department
      const { data: crewCallRow, error: crewErr } = await supabase
        .from('flex_crew_calls')
        .select('id, flex_element_id')
        .eq('job_id', job_id)
        .eq('department', dept)
        .maybeSingle();

      if (crewErr || !crewCallRow?.flex_element_id) {
        summary[dept] = { note: 'no crew call mapping' };
        continue;
      }

      const crew_call_id = crewCallRow.id as string;
      const flex_crew_call_id = crewCallRow.flex_element_id as string;

      // Desired assignments for this department come from role-specific column
      // Fetch all assignments with joined profiles; we will filter in code to be robust
      const { data: desiredRows, error: desiredErr } = await supabase
        .from('job_assignments')
        .select(`
          technician_id,
          sound_role,
          lights_role,
          video_role,
          profiles!job_assignments_technician_id_fkey(id, flex_resource_id, department)
        `)
        .eq('job_id', job_id);

      if (desiredErr) {
        summary[dept] = { error: 'failed to load desired assignments', details: desiredErr.message };
        continue;
      }

      const desired = (desiredRows ?? [])
        .filter((r: any) => r?.profiles?.flex_resource_id)
        .filter((r: any) => {
          // Accept if role set for this department OR profile's department matches
          if (dept === 'sound') return !!r.sound_role || r.profiles?.department === 'sound';
          if (dept === 'lights') return !!r.lights_role || r.profiles?.department === 'lights';
          if (dept === 'video') return !!r.video_role || r.profiles?.department === 'video';
          return false;
        })
        .map((r: any) => ({ technician_id: r.technician_id as string, flex_resource_id: r.profiles.flex_resource_id as string }));

      const noDesired = desired.length === 0;

      // Current assignments in DB
      const { data: currentRows } = await supabase
        .from('flex_crew_assignments')
        .select('id, technician_id, flex_line_item_id')
        .eq('crew_call_id', crew_call_id);

      const currentIds = new Set((currentRows ?? []).map((r: any) => r.technician_id));
      const desiredIds = new Set(desired.map((d) => d.technician_id));
      const desiredResourceIds = new Set(desired.map((d) => d.flex_resource_id));

      const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));
      const toRemove = (currentRows ?? []).filter((r: any) => !desiredIds.has(r.technician_id));

      // Perform adds
      let added = 0, removed = 0, kept = 0;
      const errors: string[] = [];
      for (const add of toAdd) {
        // Use the line-item add-resource endpoint (matches Flex UI behavior)
        let lineItemId: string | null = null;
        let ok = false;

        // Attempt 1: simple POST with auth header only
        try {
          const liUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}/add-resource/${encodeURIComponent(add.flex_resource_id)}`;
          const liRes = await fetch(liUrl, { method: 'POST', headers: { 'X-Auth-Token': flexAuthToken } });
          if (liRes.ok) {
            try {
              const j = await liRes.json();
              lineItemId = j?.id || j?.lineItemId || (j?.data && (j.data.id || j.data.lineItemId)) || (j?.addedResourceLineIds && j.addedResourceLineIds[0]) || null;
            } catch (_) {
              lineItemId = null;
            }
            ok = true;
          } else {
            const t = await liRes.text();
            errors.push(`add ${add.technician_id} (line-item) failed: ${liRes.status} ${t}`);
          }
        } catch (_) { /* ignore */ }

        // Attempt 2: POST with form-encoded body like the browser flow
        if (!ok) {
          const params = new URLSearchParams();
          params.set('resourceParentId', '');
          params.set('managedResourceLineItemType', 'contact');
          params.set('quantity', '1');
          params.set('parentLineItemId', '');
          params.set('nextSiblingId', '');
          const liUrl2 = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}/add-resource/${encodeURIComponent(add.flex_resource_id)}`;
          const liRes2 = await fetch(liUrl2, {
            method: 'POST',
            headers: { 'X-Auth-Token': flexAuthToken, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: params.toString()
          });
          if (!liRes2.ok) {
            const t = await liRes2.text();
            errors.push(`add ${add.technician_id} (line-item+form) failed: ${liRes2.status} ${t}`);
            continue;
          }
          try {
            const j2 = await liRes2.json();
            lineItemId = j2?.id || j2?.lineItemId || (j2?.data && (j2.data.id || j2.data.lineItemId)) || (j2?.addedResourceLineIds && j2.addedResourceLineIds[0]) || null;
          } catch (_) {
            lineItemId = null;
          }
        }

        if (!lineItemId) {
          // If API didn’t return an id, skip DB insert but still count as kept in summary
          kept += 1;
          continue;
        }
        await supabase.from('flex_crew_assignments').insert({ crew_call_id, technician_id: add.technician_id, flex_line_item_id: lineItemId });
        added += 1;
      }

      // Perform removals for rows we know about
      for (const rem of toRemove) {
        if (rem.flex_line_item_id) {
          const delUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${rem.flex_line_item_id}`;
          await fetch(delUrl, { method: 'DELETE', headers: { 'X-Auth-Token': flexAuthToken } });
        }
        await supabase.from('flex_crew_assignments').delete().eq('id', rem.id);
        removed += 1;
      }

      // Fallback removal: if DB lacks mappings, scan Flex element line items and delete extras there
      try {
        // Only bother if there are no DB rows or some lack flex_line_item_id
        const needsScan = !(currentRows && currentRows.length) || (currentRows ?? []).some((r: any) => !r.flex_line_item_id);
        if (needsScan) {
          const listUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/element/${encodeURIComponent(flex_crew_call_id)}/line-items`;
          const listRes = await fetch(listUrl, { headers: { 'X-Auth-Token': flexAuthToken } });
          if (listRes.ok) {
            const j = await listRes.json().catch(() => null);
            const items: any[] = Array.isArray(j) ? j
              : Array.isArray((j?.data as any)?.items) ? (j!.data as any).items
              : Array.isArray((j as any)?.items) ? (j as any).items
              : Array.isArray((j as any)?.results) ? (j as any).results
              : [];

            // Map existing Flex crew (contacts) by resourceId -> lineItemId
            const flexByResource = new Map<string, string>();
            for (const it of items) {
              const liId = it?.id || it?.lineItemId || it?.lineItem?.id || null;
              const resId = it?.resourceId || it?.resource?.id || it?.resource?.resourceId || null;
              const type = (it?.managedResourceLineItemType || it?.type || '').toString().toLowerCase();
              if (!liId || !resId) continue;
              // Keep contacts only when we can tell; otherwise accept anything with resourceId
              if (type && type !== 'contact') {
                continue;
              }
              flexByResource.set(resId, liId);
            }

            // For any Flex contact not in desired set, try bulk delete; fallback to per-id
            const extraIds: string[] = [];
            for (const [resId, liId] of flexByResource.entries()) {
              if (!desiredResourceIds.has(resId)) extraIds.push(liId);
            }

            if (extraIds.length) {
              // Attempt bulk delete mirroring UI pattern: DELETE /line-item with form body
              try {
                const params = new URLSearchParams();
                for (const id of extraIds) params.append('lineItemIds', id);
                const bulkUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item`;
                const bulkRes = await fetch(bulkUrl, {
                  method: 'DELETE',
                  headers: { 'X-Auth-Token': flexAuthToken, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                  body: params.toString()
                });
                if (bulkRes.ok) {
                  removed += extraIds.length;
                } else {
                  // Fallback to per-id
                  for (const id of extraIds) {
                    const delUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${id}`;
                    await fetch(delUrl, { method: 'DELETE', headers: { 'X-Auth-Token': flexAuthToken } });
                    removed += 1;
                  }
                }
              } catch (_) {
                // Fallback to per-id on any error
                for (const id of extraIds) {
                  const delUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${id}`;
                  await fetch(delUrl, { method: 'DELETE', headers: { 'X-Auth-Token': flexAuthToken } });
                  removed += 1;
                }
              }
            }
          }
        }
      } catch (_) {
        // Non-fatal: best-effort cleanup
      }

      kept = desired.length - added;
      summary[dept] = {
        added,
        removed,
        kept,
        desired_count: desired.length,
        current_count: currentRows?.length ?? 0,
        ...(noDesired ? { note: 'no desired assignments; removed extras if present' } : {}),
        errors: errors.length ? errors : undefined
      };
    }

    return new Response(JSON.stringify({ ok: true, job_id, summary }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
