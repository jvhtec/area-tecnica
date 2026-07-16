import { dataLayerClient } from "@/services/dataLayerClient";

export type FlexMotorUnit = {
  id: string;
  modelId: string;
  modelName: string;
  serial: string;
  barcode: string | null;
  stencil: string | null;
  modelNumber: string | null;
  currentLocation: string | null;
  shippedDate: string | null;
  returnDate: string | null;
};

export type FlexMotorModelError = {
  modelId: string;
  modelName: string;
};

export type FlexMotorUnitsResult = {
  units: FlexMotorUnit[];
  modelErrors: FlexMotorModelError[];
  manifest: FlexMotorManifestSelection;
};

export type FlexMotorManifestSource = {
  equipmentListId: string;
  equipmentListName: string;
  manifestId: string;
  stage: "prep" | "ship";
};

export type FlexMotorManifestSelection = {
  status: "found" | "empty" | "unavailable" | "error";
  unitIds: string[];
  sources: FlexMotorManifestSource[];
  message: string;
  warnings: string[];
};

const optionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeUnit = (value: unknown): FlexMotorUnit | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = optionalString(row.id);
  const modelId = optionalString(row.modelId);
  const modelName = optionalString(row.modelName);
  const serial = optionalString(row.serial);

  if (!id || !modelId || !modelName || !serial) return null;

  return {
    id,
    modelId,
    modelName,
    serial,
    barcode: optionalString(row.barcode),
    stencil: optionalString(row.stencil),
    modelNumber: optionalString(row.modelNumber),
    currentLocation: optionalString(row.currentLocation),
    shippedDate: optionalString(row.shippedDate),
    returnDate: optionalString(row.returnDate),
  };
};

const normalizeModelError = (value: unknown): FlexMotorModelError | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const modelId = optionalString(row.modelId);
  const modelName = optionalString(row.modelName);
  return modelId && modelName ? { modelId, modelName } : null;
};

const normalizeManifestSource = (value: unknown): FlexMotorManifestSource | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const equipmentListId = optionalString(row.equipmentListId);
  const equipmentListName = optionalString(row.equipmentListName);
  const manifestId = optionalString(row.manifestId);
  const stage = row.stage === "ship" || row.stage === "prep" ? row.stage : null;
  return equipmentListId && equipmentListName && manifestId && stage
    ? { equipmentListId, equipmentListName, manifestId, stage }
    : null;
};

const normalizeManifest = (
  value: unknown,
  units: FlexMotorUnit[],
): FlexMotorManifestSelection => {
  const fallback: FlexMotorManifestSelection = {
    status: "unavailable",
    unitIds: [],
    sources: [],
    message: "No hay un manifiesto de salida disponible para este trabajo.",
    warnings: [],
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const row = value as Record<string, unknown>;
  const status = ["found", "empty", "unavailable", "error"].includes(String(row.status))
    ? row.status as FlexMotorManifestSelection["status"]
    : fallback.status;
  const validUnitIds = new Set(units.map((unit) => unit.id));
  const unitIds = (Array.isArray(row.unitIds) ? row.unitIds : [])
    .filter((id): id is string => typeof id === "string" && validUnitIds.has(id));
  const sources = (Array.isArray(row.sources) ? row.sources : [])
    .map(normalizeManifestSource)
    .filter((source): source is FlexMotorManifestSource => source !== null);
  const warnings = (Array.isArray(row.warnings) ? row.warnings : [])
    .map(optionalString)
    .filter((warning): warning is string => warning !== null);

  return {
    status,
    unitIds,
    sources,
    message: optionalString(row.message) || fallback.message,
    warnings,
  };
};

export async function fetchFlexMotorUnits(jobId: string): Promise<FlexMotorUnitsResult> {
  const { data, error } = await dataLayerClient.functions.invoke("fetch-flex-motor-units", {
    body: { jobId },
  });

  if (error) {
    throw new Error(error.message || "No se pudieron obtener los motores de Flex.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("Flex devolvió una respuesta no válida para los motores.");
  }

  const payload = data as Record<string, unknown>;
  const units = (Array.isArray(payload.units) ? payload.units : [])
    .map(normalizeUnit)
    .filter((unit): unit is FlexMotorUnit => unit !== null);
  const modelErrors = (Array.isArray(payload.modelErrors) ? payload.modelErrors : [])
    .map(normalizeModelError)
    .filter((model): model is FlexMotorModelError => model !== null);

  return { units, modelErrors, manifest: normalizeManifest(payload.manifest, units) };
}
