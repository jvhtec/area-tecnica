import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { businessRoleIdFor, inferTierFromRoleCode } from "./flexBusinessRoles.ts";

type Dept = "sound" | "lights" | "video";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json() as { job_id: string; departments?: Dept[] };
    const job_id = body.job_id;
    const departments = body.departments;
    if (!job_id) throw new Error("Missing job_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth token
    let flexAuthToken = Deno.env.get("X_AUTH_TOKEN") || "";
    if (!flexAuthToken) {
      try {
        const res = await fetch(new URL(req.url).origin + "/functions/v1/get-secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "X_AUTH_TOKEN" })
        });
        if (res.ok) {
          const j = await res.json();
          flexAuthToken = (j as any)?.X_AUTH_TOKEN || flexAuthToken;
        }
      } catch (_) {
        // ignore
      }
    }

    if (!flexAuthToken) {
      return new Response(JSON.stringify({ error: "X_AUTH_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Departments
    let depts: Dept[] = [];
    if (Array.isArray(departments) && departments.length) {
      depts = departments
        .map((d) => (d as string).toLowerCase() as Dept)
        .filter((d): d is Dept => ["sound", "lights", "video"].includes(d as string));
    } else {
      const { data: mappedDepts } = await supabase
        .from("flex_crew_calls")
        .select("department")
        .eq("job_id", job_id);
      const uniq = Array.from(new Set((mappedDepts ?? []).map((r: any) => (r.department as string).toLowerCase())));
      depts = uniq.filter((d): d is Dept => ["sound", "lights", "video"].includes(d));
      if (!depts.length) depts = ["sound", "lights"];
    }

    const summary: Record<string, any> = {};
    const flexHeaders: Record<string, string> = {
      "X-Auth-Token": flexAuthToken,
      "X-Requested-With": "XMLHttpRequest",
      "X-API-Client": "flex5-desktop",
      "Accept": "*/*"
    };

    async function setBusinessRoleIfNeeded(
      args: { dept: Dept; crew_call_flex_id: string; lineItemId: string; role: string | null },
      headers: Record<string, string>
    ): Promise<boolean> {
      const { dept, crew_call_flex_id, lineItemId, role } = args;
      // Determine tier from our role code suffix (e.g., -R/-E/-T)
      const tier = inferTierFromRoleCode(role);
      const roleId = businessRoleIdFor(dept, tier);
      if (!roleId) return false;
      const rowDataUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(crew_call_flex_id)}/row-data/`;
      const res = await fetch(rowDataUrl, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId, fieldType: "business-role", payloadValue: roleId })
      });
      return res.ok;
    }

    for (const dept of depts) {
      // Crew call mapping
      const { data: crewCallRow } = await supabase
        .from("flex_crew_calls")
        .select("id, flex_element_id")
        .eq("job_id", job_id)
        .eq("department", dept)
        .maybeSingle();

      if (!crewCallRow?.flex_element_id) {
        summary[dept] = { note: "no crew call mapping" };
        continue;
      }

      const crew_call_id = crewCallRow.id as string;
      const flex_crew_call_id = crewCallRow.flex_element_id as string;

      // Desired assignments
      const { data: desiredRows } = await supabase
        .from("job_assignments")
        .select(`
          technician_id,
          sound_role,
          lights_role,
          video_role,
          profiles!job_assignments_technician_id_fkey(id, flex_resource_id, department)
        `)
        .eq("job_id", job_id);

      const desired = (desiredRows ?? [])
        .filter((r: any) => r?.profiles?.flex_resource_id)
        .filter((r: any) => {
          if (dept === "sound") return !!r.sound_role || r.profiles?.department === "sound";
          if (dept === "lights") return !!r.lights_role || r.profiles?.department === "lights";
          if (dept === "video") return !!r.video_role || r.profiles?.department === "video";
          return false;
        })
        .map((r: any) => ({
          technician_id: r.technician_id as string,
          flex_resource_id: r.profiles.flex_resource_id as string,
          role: (dept === "sound") ? (r.sound_role ?? null)
              : (dept === "lights") ? (r.lights_role ?? null)
              : (dept === "video") ? (r.video_role ?? null)
              : null,
        }));

      const desiredIds = new Set(desired.map((d) => d.technician_id));
      const desiredResourceIds = new Set(desired.map((d) => d.flex_resource_id));

      // Current DB assignments (DB view)
      const { data: currentRows } = await supabase
        .from("flex_crew_assignments")
        .select("id, technician_id, flex_line_item_id")
        .eq("crew_call_id", crew_call_id);

      // Discover present contact line items in Flex to prune stale DB rows
      const presentLineItemIds: Set<string> = new Set();
      try {
        const qs = new URLSearchParams();
        qs.set("_dc", String(Date.now()));
        qs.append("codeList", "contact");
        qs.set("node", "root");
        const rdUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}/row-data/?${qs.toString()}`;
        const rdRes = await fetch(rdUrl, { headers: flexHeaders });
        if (rdRes.ok) {
          const arr = await rdRes.json().catch(() => null) as any;
          if (Array.isArray(arr)) {
            for (const r of arr) { if (r?.id) presentLineItemIds.add(r.id as string); }
          }
        }
      } catch (_) { /* ignore */ }

      const freshCurrentRows = (currentRows ?? []).filter((r: any) => !r.flex_line_item_id || presentLineItemIds.has(r.flex_line_item_id));
      const staleRows = (currentRows ?? []).filter((r: any) => r.flex_line_item_id && !presentLineItemIds.has(r.flex_line_item_id));
      if (staleRows.length) {
        // Drop stale DB rows so they can be re-added
        await supabase.from("flex_crew_assignments").delete().in("id", staleRows.map((s: any) => s.id));
      }

      const currentIds = new Set(freshCurrentRows.map((r: any) => r.technician_id));
      const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));
      const toRemove = freshCurrentRows.filter((r: any) => !desiredIds.has(r.technician_id));

      let added = 0;
      let removed = 0;
      let kept = 0;
      let failedAdds = 0;
      let rolesSet = 0;
      const errors: string[] = [];

      // Adds
      for (const add of toAdd) {
        let lineItemId: string | null = null;

        const liUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}/add-resource/${encodeURIComponent(add.flex_resource_id)}`;
        try {
          const liRes = await fetch(liUrl, { method: "POST", headers: { ...flexHeaders } });
          if (liRes.ok) {
            const j = await liRes.json().catch(() => null) as any;
            lineItemId = (j && (j.id || j.lineItemId || (j.data && (j.data.id || j.data.lineItemId)) || (j.addedResourceLineIds && j.addedResourceLineIds[0]))) || null;
          }
        } catch (_) {}

        if (!lineItemId) {
          const params = new URLSearchParams();
          params.set("resourceParentId", "");
          params.set("managedResourceLineItemType", "contact");
          params.set("quantity", "1");
          params.set("parentLineItemId", "");
          params.set("nextSiblingId", "");
          try {
            const liRes2 = await fetch(liUrl, {
              method: "POST",
              headers: { ...flexHeaders, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
              body: params.toString()
            });
            if (liRes2.ok) {
              const j2 = await liRes2.json().catch(() => null) as any;
              lineItemId = (j2 && (j2.id || j2.lineItemId || (j2.data && (j2.data.id || j2.data.lineItemId)) || (j2.addedResourceLineIds && j2.addedResourceLineIds[0]))) || null;
            }
          } catch (_) {}
        }

        if (!lineItemId) {
          failedAdds += 1;
          errors.push(`Add failed for tech ${add.technician_id}`);
          continue;
        }
        await supabase.from("flex_crew_assignments").insert({ crew_call_id, technician_id: add.technician_id, flex_line_item_id: lineItemId });
        added += 1;

        // Apply business-role if mappable (SOUND supported; LIGHTS/VIDEO when IDs provided)
        try {
          const ok = await setBusinessRoleIfNeeded({ dept, crew_call_flex_id: flex_crew_call_id, lineItemId, role: (add as any).role ?? null }, flexHeaders);
          if (ok) rolesSet += 1;
        } catch (_) { /* ignore */ }
      }

      // Known removals (DB rows)
      for (const rem of toRemove) {
        if (rem.flex_line_item_id) {
          const delUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${rem.flex_line_item_id}`;
          await fetch(delUrl, { method: "DELETE", headers: flexHeaders });
        }
        await supabase.from("flex_crew_assignments").delete().eq("id", rem.id);
        removed += 1;
      }

      // Discover Flex contacts and delete extras
      let scanned_items = 0;
      let planned_delete_count = 0;
      try {
        const qs = new URLSearchParams();
        qs.set("_dc", String(Date.now()));
        for (const c of ["contact", "business-role", "pickup-date", "return-date", "notes", "quantity", "status"]) {
          qs.append("codeList", c);
        }
        qs.set("node", "root");
        const listUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/element/${encodeURIComponent(flex_crew_call_id)}/line-items?${qs.toString()}`;
        let items: any[] = [];
        const listRes = await fetch(listUrl, { headers: flexHeaders });
        if (listRes.ok) {
          const j = await listRes.json().catch(() => null) as any;
          const raw = Array.isArray(j)
            ? j
            : Array.isArray(j?.data?.items)
              ? j.data.items
              : Array.isArray(j?.items)
                ? j.items
                : Array.isArray(j?.results)
                  ? j.results
                  : [];
          const stack = [...raw];
          const flat: any[] = [];
          while (stack.length) {
            const n = stack.pop();
            if (!n) continue;
            flat.push(n);
            const kids = (n.children || n.items || (n.data && n.data.children) || []) as any[];
            if (Array.isArray(kids)) {
              for (const k of kids) stack.push(k);
            }
          }
          items = flat;
        }

        if (!items.length) {
          const liUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}`;
          const liRes = await fetch(liUrl, { headers: flexHeaders });
          if (liRes.ok) {
            const jj = await liRes.json().catch(() => null) as any;
            const children = (jj && (jj.children || jj.lineItems || (jj.data && jj.data.children))) || [];
            if (Array.isArray(children)) items = children;
          }
        }

        // Attempt 3: explicit children endpoint with UI-like params
        if (!items.length) {
          const qs2 = new URLSearchParams();
          qs2.set("_dc", String(Date.now()));
          for (const c of ["contact", "business-role", "pickup-date", "return-date", "notes", "quantity", "status"]) {
            qs2.append("codeList", c);
          }
          qs2.set("node", "root");
          const chUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}/children?${qs2.toString()}`;
          const chRes = await fetch(chUrl, { headers: flexHeaders });
          if (chRes.ok) {
            const jch = await chRes.json().catch(() => null) as any;
            const arr = Array.isArray(jch)
              ? jch
              : Array.isArray(jch?.data?.items)
                ? jch.data.items
                : Array.isArray(jch?.items)
                  ? jch.items
                  : Array.isArray(jch?.results)
                    ? jch.results
                    : [];
            items = arr as any[];
          }
        }

        // Attempt 4: Exact UI endpoint for row listing (with node=root)
        if (!items.length) {
          const qs3 = new URLSearchParams();
          qs3.set("_dc", String(Date.now()));
          for (const c of ["contact", "business-role", "pickup-date", "return-date", "notes", "quantity", "status"]) {
            qs3.append("codeList", c);
          }
          qs3.set("node", "root");
          const rdUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}/row-data/?${qs3.toString()}`;
          const rdRes = await fetch(rdUrl, { headers: flexHeaders });
          if (rdRes.ok) {
            const arr = await rdRes.json().catch(() => null) as any;
            // The UI row-data endpoint typically returns an array of rows
            if (Array.isArray(arr)) {
              items = arr.map((r: any) => ({ id: r?.id }));
            }
          }
        }

        // Attempt 5: row-data/findRowData fallback
        if (!items.length) {
          const qs4 = new URLSearchParams();
          for (const c of ["contact", "business-role", "pickup-date", "return-date", "notes", "quantity", "status"]) {
            qs4.append("codeList", c);
          }
          const rdUrl2 = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${encodeURIComponent(flex_crew_call_id)}/row-data/findRowData?${qs4.toString()}`;
          const rdRes2 = await fetch(rdUrl2, { headers: flexHeaders });
          if (rdRes2.ok) {
            const arr = await rdRes2.json().catch(() => null) as any;
            if (Array.isArray(arr)) {
              // Only ids are guaranteed; treat each as a lineItem candidate
              items = arr.map((r: any) => ({ id: r?.id, rootLineId: r?.rootLineId, leaf: r?.leaf, container: r?.container }));
            }
          }
        }

        const contactLineItemIds: string[] = [];
        const flexByResource = new Map<string, string>();
        for (const it of items) {
          scanned_items += 1;
          const liId = it?.id || it?.lineItemId || (it.lineItem && it.lineItem.id) || null;
          const resId = it?.resourceId || (it.resource && (it.resource.id || it.resource.resourceId)) || null;
          const type = String(it?.managedResourceLineItemType || it?.type || "").toLowerCase();
          if (!liId) continue;
          if (type && type !== "contact") continue;
          contactLineItemIds.push(liId);
          if (resId) flexByResource.set(resId, liId);
        }

        let extraIds: string[] = [];
        if (desiredResourceIds.size === 0) {
          extraIds = contactLineItemIds;
        } else {
          for (const [resId, liId] of flexByResource.entries()) {
            if (!desiredResourceIds.has(resId)) extraIds.push(liId);
          }
        }

        planned_delete_count = extraIds.length;
        if (extraIds.length) {
          const bulkUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item`;
          let bulkOk = false;
          for (const key of ["lineItemIds", "lineItemId", "ids"]) {
            const params = new URLSearchParams();
            for (const id of extraIds) params.append(key, id);
            const bulkRes = await fetch(bulkUrl, {
              method: "DELETE",
              headers: { ...flexHeaders, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
              body: params.toString()
            });
            if (bulkRes.ok) { bulkOk = true; break; }
          }
          if (!bulkOk) {
            for (const id of extraIds) {
              const delUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/line-item/${id}`;
              await fetch(delUrl, { method: "DELETE", headers: flexHeaders });
            }
          }
          removed += extraIds.length;
        }
      } catch (_) {
        // ignore
      }

      // kept = technicians already present on Flex before this run
      const alreadyThere = desired.filter((d) => currentIds.has(d.technician_id)).length;
      kept = alreadyThere;
      summary[dept] = {
        added,
        removed,
        kept,
        rolesSet,
        failedAdds,
        desired_count: desired.length,
        current_count: freshCurrentRows.length,
        scanned_items,
        planned_delete_count,
        errors: errors.length ? errors : undefined
      };
    }

    return new Response(JSON.stringify({ ok: true, job_id, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    const msg = (e && (e as any).message) ? (e as any).message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
