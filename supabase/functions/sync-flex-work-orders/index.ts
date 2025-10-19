import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLEX_BASE_URL = "https://sectorpro.flexrentalsolutions.com/f5/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type AssignmentRow = {
  id: string;
  job_id: string;
  technician_id: string;
  status: string | null;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    nickname?: string | null;
    flex_resource_id: string | null;
  } | null;
};

type ExtraRow = {
  job_id: string;
  technician_id: string;
  extra_type: string;
  quantity: number;
  amount_override_eur: number | null;
};

type WorkOrderRow = {
  id: string;
  job_id: string;
  technician_id: string;
  flex_vendor_id: string;
  flex_element_id: string;
  flex_document_id: string;
  folder_element_id: string;
  document_number: string | null;
  document_name: string | null;
  created_at?: string;
  updated_at?: string;
};

type WorkOrderItemRow = {
  id: string;
  work_order_id: string;
  source_type: "role" | "extra";
  job_assignment_id: string | null;
  job_role: string | null;
  role_department: string | null;
  extra_type: string | null;
  flex_resource_id: string;
  flex_line_item_id: string;
  quantity: number | null;
  metadata: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type Summary = Record<string, any>;

const roleResourceCache = new Map<string, string | null>();
const extraResourceCache = new Map<string, string | null>();

function resourceEnvKey(prefix: string, raw: string): string {
  const normalized = raw.replace(/[^A-Z0-9]+/gi, "_").toUpperCase();
  return `${prefix}${normalized}`;
}

function getRoleResourceId(role: string): string | null {
  if (roleResourceCache.has(role)) {
    return roleResourceCache.get(role)!;
  }
  const envKey = resourceEnvKey("FLEX_WORK_ORDER_ROLE_", role);
  const value = Deno.env.get(envKey) ?? null;
  roleResourceCache.set(role, value);
  return value;
}

function getExtraResourceId(extraType: string): string | null {
  if (extraResourceCache.has(extraType)) {
    return extraResourceCache.get(extraType)!;
  }
  const envKey = resourceEnvKey("FLEX_WORK_ORDER_EXTRA_", extraType);
  const value = Deno.env.get(envKey) ?? null;
  extraResourceCache.set(extraType, value);
  return value;
}

function displayName(profile: AssignmentRow["profiles"]): string {
  if (!profile) return "";
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (profile.nickname) return profile.nickname;
  return "";
}

async function resolvePersonnelFolder(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  tourId: string | null
): Promise<{ folderId: string | null; source: string | null }> {
  // First try job specific folders
  const { data: folders } = await supabase
    .from("flex_folders")
    .select("element_id, folder_type, department")
    .eq("job_id", jobId);

  if (Array.isArray(folders)) {
    const explicit = folders.find((f: any) => f.folder_type === "personnel_orders");
    if (explicit?.element_id) return { folderId: explicit.element_id, source: "job:personnel_orders" };
    const deptFolder = folders.find((f: any) =>
      f.folder_type === "department" && (f.department ?? "").toLowerCase() === "personnel"
    );
    if (deptFolder?.element_id) return { folderId: deptFolder.element_id, source: "job:department" };
    const generic = folders.find((f: any) => f.folder_type === "personnel");
    if (generic?.element_id) return { folderId: generic.element_id, source: "job:personnel" };
  }

  if (tourId) {
    const { data: tour } = await supabase
      .from("tours")
      .select("flex_personnel_folder_id")
      .eq("id", tourId)
      .maybeSingle();
    if (tour?.flex_personnel_folder_id) {
      return { folderId: tour.flex_personnel_folder_id, source: "tour" };
    }
  }

  return { folderId: null, source: null };
}

function flexHeaders(token: string): Record<string, string> {
  return {
    "X-Auth-Token": token,
    "X-Requested-With": "XMLHttpRequest",
    "X-API-Client": "flex5-desktop",
    Accept: "*/*"
  };
}

async function ensureFlexAuthToken(req: Request): Promise<string | null> {
  let token = Deno.env.get("X_AUTH_TOKEN") ?? "";
  if (token) return token;

  const authorization = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authorization) {
    console.error("sync-flex-work-orders: Authorization header missing, cannot load Flex token from secret");
    return null;
  }

  try {
    const res = await fetch(new URL(req.url).origin + "/functions/v1/get-secret", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {})
      },
      body: JSON.stringify({ secretName: "X_AUTH_TOKEN" })
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      token = (json as any)?.X_AUTH_TOKEN ?? token;
    } else {
      const errTxt = await res.text().catch(() => "");
      console.error(
        `sync-flex-work-orders: failed to retrieve Flex token (${res.status}) ${errTxt}`.trim()
      );
    }
  } catch (err) {
    console.error("sync-flex-work-orders: error retrieving Flex token", err);
  }

  return token || null;
}

function extractLineItemId(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  return payload?.id
    ?? payload?.lineItemId
    ?? payload?.data?.id
    ?? payload?.data?.lineItemId
    ?? (Array.isArray(payload?.addedResourceLineIds) ? payload.addedResourceLineIds[0] : null)
    ?? null;
}

function extractElementId(payload: any): { elementId: string | null; documentId: string | null } {
  if (!payload) return { elementId: null, documentId: null };
  const elementId = payload?.id
    ?? payload?.elementId
    ?? payload?.data?.id
    ?? payload?.data?.elementId
    ?? payload?.element?.id
    ?? null;
  const documentId = payload?.financialDocumentId
    ?? payload?.documentId
    ?? payload?.document?.id
    ?? elementId;
  return { elementId: elementId ?? null, documentId: documentId ?? elementId ?? null };
}

async function ensureWorkOrder(
  supabase: ReturnType<typeof createClient>,
  job: { id: string; title: string; start_time: string; end_time: string; tour_id: string | null },
  assignment: AssignmentRow,
  vendorId: string,
  folderId: string,
  documentDefinitionId: string,
  token: string,
  existing: WorkOrderRow | null,
  summary: Summary,
  techKey: string
): Promise<{ row: WorkOrderRow; created: boolean }> {
  if (existing?.flex_element_id) {
    return { row: existing, created: false };
  }

  const profileName = displayName(assignment.profiles);
  const baseNumber = `${job.title ?? "Job"}`.trim();
  const docNumber = `${baseNumber} - ${profileName || assignment.technician_id}`.slice(0, 120);

  const payload = {
    definitionId: documentDefinitionId,
    parentElementId: folderId,
    open: true,
    locked: false,
    documentNumber: docNumber,
    name: docNumber,
    plannedStartDate: job.start_time,
    plannedEndDate: job.end_time,
    vendorId
  };

  const res = await fetch(`${FLEX_BASE_URL}/element`, {
    method: "POST",
    headers: { ...flexHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    summary[techKey] = summary[techKey] || {};
    summary[techKey].errors = summary[techKey].errors || [];
    summary[techKey].errors.push(`Failed to create work order: ${res.status} ${errTxt}`.trim());
    throw new Error(`Flex work order creation failed (${res.status})`);
  }

  const json = await res.json().catch(() => ({}));
  const ids = extractElementId(json);
  if (!ids.elementId) {
    throw new Error("Flex response missing work order element id");
  }

  const insertPayload = {
    job_id: job.id,
    technician_id: assignment.technician_id,
    flex_vendor_id: vendorId,
    flex_element_id: ids.elementId,
    flex_document_id: ids.documentId ?? ids.elementId,
    folder_element_id: folderId,
    document_number: docNumber,
    document_name: docNumber
  };

  const { data, error } = await supabase
    .from("flex_work_orders")
    .upsert(insertPayload, { onConflict: "job_id, technician_id", ignoreDuplicates: false })
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }
  let row = (data as WorkOrderRow | null) ?? null;
  if (!row || !row.id) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("flex_work_orders")
      .select("*")
      .eq("job_id", job.id)
      .eq("technician_id", assignment.technician_id)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    if (!fallback) throw new Error("Failed to persist flex work order row");
    row = fallback as WorkOrderRow;
  }

  return { row, created: !existing };
}

async function fetchWorkOrderItems(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string
): Promise<WorkOrderItemRow[]> {
  const { data } = await supabase
    .from("flex_work_order_items")
    .select("*")
    .eq("work_order_id", workOrderId);
  return (data as WorkOrderItemRow[]) ?? [];
}

async function addResourceLineItem(
  documentId: string,
  resourceId: string,
  quantity: number,
  token: string
): Promise<{ lineItemId: string | null; raw: any }> {
  const params = new URLSearchParams();
  params.set("resourceParentId", Deno.env.get("FLEX_WORK_ORDER_RESOURCE_PARENT_ID") ?? "");
  params.set("managedResourceLineItemType", Deno.env.get("FLEX_WORK_ORDER_MANAGED_TYPE") ?? "resource");
  params.set("quantity", String(quantity));

  const url = `${FLEX_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/add-resource/${encodeURIComponent(resourceId)}?${params.toString()}`;
  const res = await fetch(url, { method: "POST", headers: flexHeaders(token) });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Failed to add resource: ${res.status}`);
  }
  return { lineItemId: extractLineItemId(raw), raw };
}

async function updateLineItemQuantity(
  documentId: string,
  lineItemId: string,
  quantity: number,
  token: string
): Promise<boolean> {
  const payload = { bulkData: [{ itemId: lineItemId, quantity }] };
  const res = await fetch(`${FLEX_BASE_URL}/financial-document-line-item/${encodeURIComponent(documentId)}/bulk-update`, {
    method: "POST",
    headers: { ...flexHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.ok;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body?.job_id as string | undefined;
    if (!jobId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing job_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = await ensureFlexAuthToken(req);
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Flex API token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const definitionId = Deno.env.get("FLEX_WORK_ORDER_DEFINITION_ID");
    if (!definitionId) {
      return new Response(JSON.stringify({ ok: false, error: "FLEX_WORK_ORDER_DEFINITION_ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, start_time, end_time, tour_id")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) {
      return new Response(JSON.stringify({ ok: false, error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const folderInfo = await resolvePersonnelFolder(supabase, jobId, job.tour_id);
    if (!folderInfo.folderId) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing personnel folder",
        detail: { source: folderInfo.source }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: assignmentRows } = await supabase
      .from("job_assignments")
      .select(`
        id,
        job_id,
        technician_id,
        status,
        sound_role,
        lights_role,
        video_role,
        profiles:profiles!job_assignments_technician_id_fkey(id, first_name, last_name, nickname, flex_resource_id)
      `)
      .eq("job_id", jobId);

    const assignmentList = (assignmentRows ?? []) as AssignmentRow[];
    const confirmedAssignments = assignmentList
      .filter((row) => (row.status ?? "").toLowerCase() === "confirmed")
      .filter((row) => row.profiles?.flex_resource_id);

    const { data: extrasRows } = await supabase
      .from("job_rate_extras")
      .select("job_id, technician_id, extra_type, quantity, amount_override_eur, status")
      .eq("job_id", jobId);

    const extrasList = (extrasRows ?? []) as (ExtraRow & { status: string })[];
    const approvedExtras = extrasList
      .filter((row) => (row.status ?? "").toLowerCase() === "approved");

    const extrasByTech = new Map<string, ExtraRow[]>();
    for (const extra of approvedExtras) {
      if (!extrasByTech.has(extra.technician_id)) {
        extrasByTech.set(extra.technician_id, []);
      }
      extrasByTech.get(extra.technician_id)!.push(extra);
    }

    const { data: existingRows } = await supabase
      .from("flex_work_orders")
      .select("*")
      .eq("job_id", jobId);

    const existingByTech = new Map<string, WorkOrderRow>();
    const existingList = (existingRows ?? []) as WorkOrderRow[];
    for (const row of existingList) {
      existingByTech.set(row.technician_id, row);
    }

    const summary: Summary = {
      job_id: jobId,
      personnel_folder_id: folderInfo.folderId,
      personnel_folder_source: folderInfo.source,
      technicians_processed: confirmedAssignments.length,
      generated_at: new Date().toISOString()
    };

    for (const assignment of confirmedAssignments) {
      const vendorId = assignment.profiles?.flex_resource_id ?? "";
      const techKey = assignment.technician_id;
      summary[techKey] = summary[techKey] || {
        vendor_id: vendorId,
        technician_id: assignment.technician_id,
        roles: { added: 0, skipped: 0, existing: 0, missing: [] as string[] },
        extras: { added: 0, updated: 0, skipped: 0, existing: 0, missing: [] as string[] },
        notes: [] as string[],
        errors: [] as string[]
      };
      summary[techKey].vendor_id = vendorId;

      if (!vendorId) {
        summary[techKey].notes.push("Missing flex_resource_id, skipping technician");
        continue;
      }

      const existing = existingByTech.get(assignment.technician_id) ?? null;
      let workOrder: WorkOrderRow;
      let created = false;
      try {
        const ensured = await ensureWorkOrder(
          supabase,
          job as any,
          assignment,
          vendorId,
          folderInfo.folderId,
          definitionId,
          token,
          existing,
          summary,
          techKey
        );
        workOrder = ensured.row;
        created = ensured.created;
        existingByTech.set(assignment.technician_id, workOrder);
      } catch (err) {
        const message = (err as Error).message;
        summary[techKey].notes.push(`Failed to ensure work order: ${message}`);
        summary[techKey].errors.push(message);
        continue;
      }

      summary[techKey].created = created;
      summary[techKey].flex_element_id = workOrder.flex_element_id;
      summary[techKey].flex_document_id = workOrder.flex_document_id;

      const items = await fetchWorkOrderItems(supabase, workOrder.id);
      const roleIndex = new Map<string, WorkOrderItemRow>();
      const extraIndex = new Map<string, WorkOrderItemRow>();
      for (const item of items) {
        if (item.source_type === "role" && item.job_assignment_id && item.job_role) {
          roleIndex.set(`${item.job_assignment_id}:${item.job_role}`, item);
        } else if (item.source_type === "extra" && item.extra_type) {
          extraIndex.set(item.extra_type, item);
        }
      }

      const roleEntries: Array<{ code: string; dept: string }> = [];
      if (assignment.sound_role) roleEntries.push({ code: assignment.sound_role, dept: "sound" });
      if (assignment.lights_role) roleEntries.push({ code: assignment.lights_role, dept: "lights" });
      if (assignment.video_role) roleEntries.push({ code: assignment.video_role, dept: "video" });

      for (const entry of roleEntries) {
        const resourceId = getRoleResourceId(entry.code);
        if (!resourceId) {
          summary[techKey].roles.missing.push(entry.code);
          continue;
        }
        const key = `${assignment.id}:${entry.code}`;
        const existingItem = roleIndex.get(key);
        if (existingItem?.flex_line_item_id) {
          summary[techKey].roles.existing += 1;
          continue;
        }
        try {
          const { lineItemId } = await addResourceLineItem(
            workOrder.flex_document_id,
            resourceId,
            1,
            token
          );
          if (!lineItemId) {
            summary[techKey].roles.missing.push(`${entry.code} (no line id)`);
            continue;
          }
          const payload = {
            work_order_id: workOrder.id,
            source_type: "role" as const,
            job_assignment_id: assignment.id,
            job_role: entry.code,
            role_department: entry.dept,
            flex_resource_id: resourceId,
            flex_line_item_id: lineItemId,
            quantity: 1,
            metadata: {
              department: entry.dept,
              job_role: entry.code
            }
          };
          const { error: upsertError } = await supabase
            .from("flex_work_order_items")
            .upsert(payload, { onConflict: "work_order_id,job_assignment_id,job_role", ignoreDuplicates: false });
          if (upsertError) throw upsertError;
          summary[techKey].roles.added += 1;
        } catch (err) {
          summary[techKey].roles.missing.push(`${entry.code} (${(err as Error).message})`);
        }
      }

      const extras = extrasByTech.get(assignment.technician_id) ?? [];
      for (const extra of extras) {
        const resourceId = getExtraResourceId(extra.extra_type);
        if (!resourceId) {
          summary[techKey].extras.missing.push(extra.extra_type);
          continue;
        }
        const existingItem = extraIndex.get(extra.extra_type);
        const desiredQuantity = Number(extra.quantity ?? 1) || 1;
        if (existingItem?.flex_line_item_id) {
          const currentQty = Number(existingItem.quantity ?? 0) || 0;
          if (currentQty !== desiredQuantity) {
            try {
              const ok = await updateLineItemQuantity(
                workOrder.flex_document_id,
                existingItem.flex_line_item_id,
                desiredQuantity,
                token
              );
              if (ok) {
                const { error: qtyUpdateError } = await supabase
                  .from("flex_work_order_items")
                  .update({ quantity: desiredQuantity })
                  .eq("id", existingItem.id);
                if (qtyUpdateError) {
                  summary[techKey].extras.skipped += 1;
                  summary[techKey].notes.push(`DB quantity update failed for ${extra.extra_type}: ${qtyUpdateError.message}`);
                } else {
                  summary[techKey].extras.updated += 1;
                }
              } else {
                summary[techKey].extras.skipped += 1;
                summary[techKey].notes.push(`Failed to update quantity for ${extra.extra_type}`);
              }
            } catch (err) {
              summary[techKey].extras.skipped += 1;
              summary[techKey].notes.push(`Error updating ${extra.extra_type}: ${(err as Error).message}`);
            }
          } else {
            summary[techKey].extras.existing += 1;
          }
          continue;
        }
        try {
          const { lineItemId } = await addResourceLineItem(
            workOrder.flex_document_id,
            resourceId,
            desiredQuantity,
            token
          );
          if (!lineItemId) {
            summary[techKey].extras.missing.push(`${extra.extra_type} (no line id)`);
            continue;
          }
          const payload = {
            work_order_id: workOrder.id,
            source_type: "extra" as const,
            job_assignment_id: null,
            job_role: null,
            role_department: null,
            extra_type: extra.extra_type,
            flex_resource_id: resourceId,
            flex_line_item_id: lineItemId,
            quantity: desiredQuantity,
            metadata: {
              extra_type: extra.extra_type,
              amount_override_eur: extra.amount_override_eur
            }
          };
          const { error: upsertError } = await supabase
            .from("flex_work_order_items")
            .upsert(payload, { onConflict: "work_order_id,extra_type", ignoreDuplicates: false });
          if (upsertError) throw upsertError;
          summary[techKey].extras.added += 1;
        } catch (err) {
          summary[techKey].extras.missing.push(`${extra.extra_type} (${(err as Error).message})`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = (err instanceof Error) ? err.message : String(err);
    console.error("[sync-flex-work-orders]", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
