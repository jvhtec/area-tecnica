import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { requireAdminOrManagement } from "../_shared/auth.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireEnvValues,
} from "../_shared/http.ts";

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

interface PersistFlexElementsBody extends Record<string, unknown> {
  created?: unknown;
}

const VALID_KINDS = new Set<string>([
  "job_root_folder",
  "job_department_folder",
  "tour_date_folder",
  "crew_call",
  "pull_sheet",
  "doc_tecnica",
  "hoja_gastos",
  "hoja_info_sx",
  "hoja_info_lx",
  "hoja_info_vx",
]);

const VALID_DEPARTMENTS = new Set<string>([
  "sound",
  "lights",
  "video",
  "production",
  "personnel",
  "comercial",
]);
const VALID_CREW_CALL_DEPARTMENTS = new Set(["sound", "lights"]);

const MAX_CREATED_ITEMS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown, maxLength = 128): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : undefined;
}

function normalizeCreatedItem(value: unknown, index: number): CreatedItem {
  if (!isRecord(value)) {
    throw new HttpError(400, `Invalid created item at index ${index}`, {
      code: "invalid_created_item",
    });
  }

  const kind = optionalString(value.kind, 64);
  const elementId = optionalString(value.elementId, 256);
  if (!kind || !VALID_KINDS.has(kind) || !elementId) {
    throw new HttpError(400, `Invalid created item at index ${index}`, {
      code: "invalid_created_item",
    });
  }

  const department = optionalString(value.department, 32);
  if (department && !VALID_DEPARTMENTS.has(department)) {
    throw new HttpError(400, `Invalid created item department at index ${index}`, {
      code: "invalid_created_item_department",
    });
  }

  if (
    kind === "crew_call" &&
    (!optionalString(value.jobId) || !department || !VALID_CREW_CALL_DEPARTMENTS.has(department))
  ) {
    throw new HttpError(400, `Invalid crew_call item at index ${index}`, {
      code: "invalid_crew_call_item",
    });
  }

  return {
    kind: kind as Kind,
    elementId,
    jobId: optionalString(value.jobId),
    tourId: optionalString(value.tourId),
    tourDateId: optionalString(value.tourDateId),
    department: department as Dept | undefined,
    parentElementId: optionalString(value.parentElementId, 256),
  };
}

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await requireAdminOrManagement(sb, req, {
    logContext: "persist-flex-elements",
  });

  const { created } = await readBoundedJsonObject<PersistFlexElementsBody>(req, { maxBytes: 256 * 1024 });
  if (!Array.isArray(created)) {
    throw new HttpError(400, "Invalid payload: created must be an array", {
      code: "invalid_created_payload",
    });
  }
  if (created.length > MAX_CREATED_ITEMS) {
    throw new HttpError(413, "Too many created items", {
      code: "too_many_created_items",
    });
  }
  const createdItems = created.map((item, index) => normalizeCreatedItem(item, index));

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

  for (const c of createdItems) {
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
      console.warn("[persist-flex-elements] Skipping item due to error", {
        kind: c.kind,
        elementId: c.elementId,
      }, innerErr);
      continue;
    }
  }

  return jsonResponse({ ok: true });
}, {
  allowedMethods: ["POST"],
  onError(error) {
    console.error("persist-flex-elements request failed", error);
  },
}));
