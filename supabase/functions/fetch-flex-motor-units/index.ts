import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { requireAdminOrManagement } from "../_shared/auth.ts";
import {
  ESTRUCTURA_DEPARTMENT,
  ESTRUCTURA_PULL_SHEETS,
  ESTRUCTURA_SOURCE_DEPARTMENTS,
} from "../../../src/domain/estructura.ts";
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  requireEnvValues,
} from "../_shared/http.ts";
import {
  buildMotorSerialUnitGridUrl,
  MOTOR_MODELS,
  normalizeMotorModel,
  normalizeMotorUnit,
  parseMotorGridPage,
  type FlexMotorUnit,
  type MotorModelDefinition,
} from "./motorUnits.ts";
import { discoverEstructuraManifestSelection } from "./estructuraManifestSelection.ts";
import { allSettledWithConcurrency } from "./concurrency.ts";

const FLEX_API_BASE_URL =
  Deno.env.get("FLEX_API_BASE_URL") ||
  "https://sectorpro.flexrentalsolutions.com/f5/api";
const PAGE_SIZE = 25;
const MAX_PAGES_PER_MODEL = 20;
const FLEX_REQUEST_CONCURRENCY = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const flexHeaders = (flexAuthToken: string): Record<string, string> => ({
  "X-Auth-Token": flexAuthToken,
  apikey: flexAuthToken,
  "X-Requested-With": "XMLHttpRequest",
  "X-API-Client": "flex5-desktop",
  Accept: "application/json",
});

async function fetchFlexJson(
  path: string,
  flexAuthToken: string,
  query?: Record<string, string | string[]>,
): Promise<unknown> {
  const url = new URL(`${FLEX_API_BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      (Array.isArray(value) ? value : [value]).forEach((item) => url.searchParams.append(key, item));
    });
  }

  const response = await fetchWithRetry(url.toString(), {
    headers: flexHeaders(flexAuthToken),
  });
  if (!response.ok) {
    throw new Error(`Flex returned ${response.status} for ${path}`);
  }
  return response.json();
}

/** Loads the current Flex display metadata while preserving the configured allowlist fallback. */
async function fetchModelDefinition(
  fallback: MotorModelDefinition,
  flexAuthToken: string,
): Promise<MotorModelDefinition> {
  try {
    const raw = await fetchFlexJson(
      `/inventory-model/${encodeURIComponent(fallback.id)}`,
      flexAuthToken,
    );
    return normalizeMotorModel(raw, fallback);
  } catch (error) {
    console.error("Unable to fetch Flex motor model metadata; using configured fallback", {
      modelId: fallback.id,
      error,
    });
    return fallback;
  }
}

/** Loads and normalizes all available serial units for one approved motor model. */
async function fetchUnitsForModel(
  fallback: MotorModelDefinition,
  flexAuthToken: string,
): Promise<FlexMotorUnit[]> {
  const model = await fetchModelDefinition(fallback, flexAuthToken);
  const units = new Map<string, FlexMotorUnit>();
  const seenRawIds = new Set<string>();

  for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_MODEL; pageIndex += 1) {
    const url = buildMotorSerialUnitGridUrl({
      apiBaseUrl: FLEX_API_BASE_URL,
      modelId: model.id,
      pageIndex,
      pageSize: PAGE_SIZE,
    });

    const response = await fetchWithRetry(url.toString(), {
      headers: flexHeaders(flexAuthToken),
    });

    if (!response.ok) {
      throw new Error(`Flex returned ${response.status} for motor model ${model.id}`);
    }

    const page = parseMotorGridPage(await response.json());
    let newRawIds = 0;

    for (const row of page.rows) {
      const rawId = row && typeof row === "object" && !Array.isArray(row)
        ? String((row as Record<string, unknown>).id || (row as Record<string, unknown>).unitId || "")
        : "";
      if (rawId && !seenRawIds.has(rawId)) {
        seenRawIds.add(rawId);
        newRawIds += 1;
      }

      const normalized = normalizeMotorUnit(row, model);
      if (normalized) units.set(normalized.id, normalized);
    }

    const reachedTotal = page.totalElements !== null && seenRawIds.size >= page.totalElements;
    if (
      page.last === true ||
      reachedTotal ||
      page.rows.length < PAGE_SIZE ||
      (pageIndex > 0 && newRawIds === 0)
    ) {
      break;
    }
  }

  return Array.from(units.values()).sort((a, b) =>
    a.serial.localeCompare(b.serial, "es", { numeric: true, sensitivity: "base" })
  );
}

serve(createHttpHandler(async (req: Request) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );
  const flexAuthToken =
    Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN") || "";

  if (!flexAuthToken) {
    throw new HttpError(503, "Flex auth not configured", {
      code: "flex_auth_missing",
      exposeDetails: false,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await requireAdminOrManagement(supabase, req, {
    logContext: "fetch-flex-motor-units",
  });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!UUID_PATTERN.test(jobId)) {
    throw new HttpError(400, "A valid job id is required", {
      code: "invalid_job_id",
      exposeDetails: false,
    });
  }

  const [settled, folderResult] = await Promise.all([
    allSettledWithConcurrency(
      MOTOR_MODELS,
      FLEX_REQUEST_CONCURRENCY,
      (model) => fetchUnitsForModel(model, flexAuthToken),
    ),
    supabase
      .from("flex_folders")
      .select("element_id, source_department")
      .eq("job_id", jobId)
      .eq("department", ESTRUCTURA_DEPARTMENT)
      .eq("folder_type", "pull_sheet")
      .in("source_department", [...ESTRUCTURA_SOURCE_DEPARTMENTS]),
  ]);
  if (folderResult.error) {
    throw new HttpError(500, "Unable to resolve Flex folders for the job", {
      code: "flex_folder_lookup_failed",
      exposeDetails: false,
    });
  }

  const units: FlexMotorUnit[] = [];
  const modelErrors: Array<{ modelId: string; modelName: string }> = [];

  settled.forEach((result, index) => {
    const model = MOTOR_MODELS[index];
    if (result.status === "fulfilled") {
      units.push(...result.value);
    } else {
      console.error("Unable to fetch Flex motor units", {
        modelId: model.id,
        error: result.reason,
      });
      modelErrors.push({ modelId: model.id, modelName: model.name });
    }
  });

  if (modelErrors.length === MOTOR_MODELS.length) {
    throw new HttpError(502, "Unable to fetch motor units from Flex", {
      code: "flex_motor_units_unavailable",
      exposeDetails: false,
    });
  }

  units.sort((a, b) =>
    a.modelName.localeCompare(b.modelName, "es", { numeric: true }) ||
    a.serial.localeCompare(b.serial, "es", { numeric: true, sensitivity: "base" })
  );

  const estructuraRows = folderResult.data ?? [];
  const trackedEquipmentLists = estructuraRows
    .filter((row) => typeof row.element_id === "string")
    .map((row) => ({
      id: row.element_id,
      name: row.source_department === "sound"
        ? ESTRUCTURA_PULL_SHEETS.sound.nameSuffix
        : ESTRUCTURA_PULL_SHEETS.lights.nameSuffix,
    }));
  const presentSources = new Set(estructuraRows.map((row) => row.source_department));
  const missingSourceDepartments = [
    !presentSources.has("sound") ? ESTRUCTURA_PULL_SHEETS.sound.label : null,
    !presentSources.has("lights") ? ESTRUCTURA_PULL_SHEETS.lights.label : null,
  ].filter((value): value is string => Boolean(value));
  const manifest = await discoverEstructuraManifestSelection({
    trackedEquipmentLists,
    missingSourceDepartments,
    units,
    concurrency: FLEX_REQUEST_CONCURRENCY,
    fetchWarehouseState: (equipmentListId) => fetchFlexJson(
      `/equipment-list/warehouse-state/${encodeURIComponent(equipmentListId)}`,
      flexAuthToken,
    ),
    fetchManifestRows: (manifestId) => fetchFlexJson(
      `/line-item/${encodeURIComponent(manifestId)}/row-data/`,
      flexAuthToken,
      { codeList: ["name", "barcode", "serial", "stencil"] },
    ),
  });

  return jsonResponse({
    ok: modelErrors.length === 0,
    units,
    modelErrors,
    manifest,
    sourceModelCount: MOTOR_MODELS.length,
  });
}, {
  allowedMethods: ["POST"],
  onError(error) {
    console.error("fetch-flex-motor-units request failed", error);
  },
}));
