import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { requireAdminOrManagement } from "../_shared/auth.ts";
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
  normalizeMotorUnit,
  parseMotorGridPage,
  type FlexMotorUnit,
  type MotorModelDefinition,
} from "./motorUnits.ts";
import {
  findEquipmentListsInTree,
  matchMotorUnitsInManifest,
  selectOutboundManifest,
  type FlexEquipmentListReference,
  type FlexManifestSource,
} from "./manifestUnits.ts";
import { allSettledWithConcurrency } from "./concurrency.ts";

const FLEX_API_BASE_URL =
  Deno.env.get("FLEX_API_BASE_URL") ||
  "https://sectorpro.flexrentalsolutions.com/f5/api";
const PAGE_SIZE = 25;
const MAX_PAGES_PER_MODEL = 20;
const MAX_EQUIPMENT_LISTS = 100;
const FLEX_REQUEST_CONCURRENCY = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ManifestSelection = {
  status: "found" | "empty" | "unavailable" | "error";
  unitIds: string[];
  sources: FlexManifestSource[];
  message: string;
  warnings: string[];
};

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

async function fetchUnitsForModel(
  model: MotorModelDefinition,
  flexAuthToken: string,
): Promise<FlexMotorUnit[]> {
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

async function discoverManifestSelection(options: {
  rootElementId: string | null;
  trackedEquipmentLists: FlexEquipmentListReference[];
  units: FlexMotorUnit[];
  flexAuthToken: string;
}): Promise<ManifestSelection> {
  const { rootElementId, trackedEquipmentLists, units, flexAuthToken } = options;
  const equipmentLists = new Map(
    trackedEquipmentLists.map((list) => [list.id, list]),
  );
  const warnings: string[] = [];

  if (rootElementId) {
    try {
      const tree = await fetchFlexJson(
        `/element/${encodeURIComponent(rootElementId)}/tree`,
        flexAuthToken,
      );
      findEquipmentListsInTree(tree).forEach((list) => equipmentLists.set(list.id, list));
    } catch (error) {
      console.error("Unable to fetch the Flex job tree for motor manifests", {
        rootElementId,
        error,
      });
      warnings.push("No se ha podido completar la búsqueda en el árbol Flex del trabajo.");
    }
  }

  const candidates = Array.from(equipmentLists.values()).slice(0, MAX_EQUIPMENT_LISTS);
  if (candidates.length === 0) {
    return {
      status: warnings.length ? "error" : "unavailable",
      unitIds: [],
      sources: [],
      message: "El trabajo no tiene listas de material de Flex relacionadas.",
      warnings,
    };
  }

  const stateResults = await allSettledWithConcurrency(
    candidates,
    FLEX_REQUEST_CONCURRENCY,
    async (equipmentList) => {
      const state = await fetchFlexJson(
        `/equipment-list/warehouse-state/${encodeURIComponent(equipmentList.id)}`,
        flexAuthToken,
      );
      return selectOutboundManifest(state, equipmentList);
    },
  );
  const sources = new Map<string, FlexManifestSource>();
  let stateFailures = 0;

  stateResults.forEach((result) => {
    if (result.status === "fulfilled" && result.value) {
      sources.set(result.value.manifestId, result.value);
    } else if (result.status === "rejected") {
      stateFailures += 1;
      console.error("Unable to fetch Flex warehouse state for a job equipment list", result.reason);
    }
  });
  if (stateFailures > 0) {
    warnings.push(`No se han podido consultar ${stateFailures} listas de material en Flex.`);
  }

  const manifestSources = Array.from(sources.values());
  if (manifestSources.length === 0) {
    return {
      status: stateFailures === candidates.length ? "error" : "unavailable",
      unitIds: [],
      sources: [],
      message: "Todavía no hay un manifiesto de salida preparado o enviado para este trabajo.",
      warnings,
    };
  }

  const rowResults = await allSettledWithConcurrency(
    manifestSources,
    FLEX_REQUEST_CONCURRENCY,
    async (source) => {
      const rowData = await fetchFlexJson(
        `/line-item/${encodeURIComponent(source.manifestId)}/row-data/`,
        flexAuthToken,
        { codeList: ["name", "barcode", "serial", "stencil"] },
      );
      return matchMotorUnitsInManifest(rowData, units);
    },
  );
  const unitIds = new Set<string>();
  let rowFailures = 0;

  rowResults.forEach((result) => {
    if (result.status === "fulfilled") {
      result.value.forEach((unitId) => unitIds.add(unitId));
    } else {
      rowFailures += 1;
      console.error("Unable to fetch Flex manifest line items", result.reason);
    }
  });
  if (rowFailures > 0) {
    warnings.push(`No se han podido leer ${rowFailures} manifiestos de Flex.`);
  }

  return {
    status: unitIds.size > 0 ? "found" : rowFailures === manifestSources.length ? "error" : "empty",
    unitIds: Array.from(unitIds),
    sources: manifestSources,
    message: unitIds.size > 0
      ? `${unitIds.size} motores encontrados en el manifiesto del trabajo.`
      : "El manifiesto no contiene motores de los modelos certificados.",
    warnings,
  };
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
    Promise.allSettled(
      MOTOR_MODELS.map((model) => fetchUnitsForModel(model, flexAuthToken)),
    ),
    supabase
      .from("flex_folders")
      .select("element_id, folder_type, department")
      .eq("job_id", jobId)
      .in("folder_type", ["main_event", "main", "tourdate", "pull_sheet"]),
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

  const folderRows = folderResult.data ?? [];
  const rootPreference = ["main_event", "main", "tourdate"];
  const rootElementId = rootPreference
    .map((folderType) => folderRows.find((row) => row.folder_type === folderType)?.element_id)
    .find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
  const trackedEquipmentLists = folderRows
    .filter((row) => row.folder_type === "pull_sheet" && typeof row.element_id === "string")
    .map((row) => ({
      id: row.element_id,
      name: row.department ? `Material ${row.department}` : "Lista de material",
    }));
  const manifest = await discoverManifestSelection({
    rootElementId,
    trackedEquipmentLists,
    units,
    flexAuthToken,
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
