import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Dept = "sound" | "lights" | "video" | "production" | "personnel" | "comercial";
type Kind =
  | "job_root_folder"
  | "job_department_folder"
  | "tour_date_folder"
  | "crew_call"
  | "pull_sheet"
  | "doc_tecnica"
  | "hoja_gastos"
  | "hoja_info_sx"
  | "hoja_info_lx"
  | "hoja_info_vx";

interface CreatedItem {
  kind: Kind;
  elementId: string;
  jobId?: string;
  tourId?: string;
  tourDateId?: string;
  department?: Dept;
  parentElementId?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { created } = (await req.json()) as { created: CreatedItem[] };
    if (!Array.isArray(created)) {
      throw new Error("Invalid payload: created must be an array");
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Helper to resolve parent row id by element id
    const parentCache = new Map<string, string | null>();
    async function getParentRowIdByElementId(elementId?: string): Promise<string | null> {
      if (!elementId) return null;
      if (parentCache.has(elementId)) return parentCache.get(elementId)!;
      const { data } = await sb
        .from("flex_folders")
        .select("id")
        .eq("element_id", elementId)
        .limit(1)
        .maybeSingle();
      const id = data?.id ?? null;
      parentCache.set(elementId, id);
      return id;
    }

    for (const c of created) {
      try {
        switch (c.kind) {
          case "crew_call": {
            if (!c.jobId || !c.department || !c.elementId) break;
            // Upsert by (job_id, department)
            const { data: existing } = await sb
              .from("flex_crew_calls")
              .select("id, flex_element_id")
              .eq("job_id", c.jobId)
              .eq("department", c.department)
              .maybeSingle();
            if (existing) {
              if (existing.flex_element_id !== c.elementId) {
                await sb
                  .from("flex_crew_calls")
                  .update({ flex_element_id: c.elementId })
                  .eq("id", existing.id);
              }
            } else {
              await sb.from("flex_crew_calls").insert({
                job_id: c.jobId,
                department: c.department,
                flex_element_id: c.elementId,
              });
            }
            break;
          }

          case "job_root_folder":
          case "job_department_folder":
          case "tour_date_folder":
          case "pull_sheet":
          case "doc_tecnica":
          case "hoja_gastos":
          case "hoja_info_sx":
          case "hoja_info_lx":
          case "hoja_info_vx": {
            // Avoid duplicates: skip if element_id already present
            const { data: exists } = await sb
              .from("flex_folders")
              .select("id")
              .eq("element_id", c.elementId)
              .limit(1)
              .maybeSingle();
            if (exists) break;

            // Map folder_type
            const folderTypeMap: Record<Kind, string> = {
              job_root_folder: "main_event",
              job_department_folder: "department",
              tour_date_folder: "tourdate",
              pull_sheet: "pull_sheet",
              doc_tecnica: "doc_tecnica",
              hoja_gastos: "hoja_gastos",
              hoja_info_sx: "hoja_info_sx",
              hoja_info_lx: "hoja_info_lx",
              hoja_info_vx: "hoja_info_vx",
              crew_call: "crew_call",
            };

            const parent_id = await getParentRowIdByElementId(c.parentElementId);

            await sb.from("flex_folders").insert({
              job_id: c.jobId ?? null,
              tour_date_id: c.tourDateId ?? null,
              parent_id,
              element_id: c.elementId,
              folder_type: folderTypeMap[c.kind],
              department: c.department ?? null,
            });

            // Mark job as created when root captured
            if (c.kind === "job_root_folder" && c.jobId) {
              await sb.from("jobs").update({ flex_folders_created: true }).eq("id", c.jobId);
            }
            break;
          }
        }
      } catch (innerErr) {
        console.warn("[persist-flex-elements] Skipping item due to error", c, innerErr);
        continue;
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
