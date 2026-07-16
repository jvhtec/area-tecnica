import { dataLayerClient } from "@/services/dataLayerClient";

export type FlexMotorUnit = {
  id: string;
  modelId: string;
  modelName: string;
  manufacturer: string | null;
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

const INVALID_RESPONSE_MESSAGE = "Flex devolvió una respuesta no válida para los motores.";

const isNullableString = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

/** Validates a unit and fills the manufacturer omitted by the pre-rollout Edge Function. */
const normalizeFlexMotorUnit = (value: unknown): FlexMotorUnit | null => {
  if (!value || typeof value !== "object") return null;
  const unit = value as Record<string, unknown>;
  const manufacturer = unit.manufacturer === undefined ? null : unit.manufacturer;
  if (
    typeof unit.id !== "string"
    || typeof unit.modelId !== "string"
    || typeof unit.modelName !== "string"
    || !isNullableString(manufacturer)
    || typeof unit.serial !== "string"
    || !isNullableString(unit.barcode)
    || !isNullableString(unit.stencil)
    || !isNullableString(unit.modelNumber)
    || !isNullableString(unit.currentLocation)
    || !isNullableString(unit.shippedDate)
    || !isNullableString(unit.returnDate)
  ) {
    return null;
  }

  return {
    id: unit.id,
    modelId: unit.modelId,
    modelName: unit.modelName,
    manufacturer,
    serial: unit.serial,
    barcode: unit.barcode,
    stencil: unit.stencil,
    modelNumber: unit.modelNumber,
    currentLocation: unit.currentLocation,
    shippedDate: unit.shippedDate,
    returnDate: unit.returnDate,
  };
};

const isFlexMotorModelError = (value: unknown): value is FlexMotorModelError => {
  if (!value || typeof value !== "object") return false;
  const modelError = value as Record<string, unknown>;
  return typeof modelError.modelId === "string" && typeof modelError.modelName === "string";
};

const isFlexMotorManifestSource = (value: unknown): value is FlexMotorManifestSource => {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return typeof source.equipmentListId === "string"
    && typeof source.equipmentListName === "string"
    && typeof source.manifestId === "string"
    && (source.stage === "prep" || source.stage === "ship");
};

const isFlexMotorManifestSelection = (value: unknown): value is FlexMotorManifestSelection => {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Record<string, unknown>;
  return (manifest.status === "found"
      || manifest.status === "empty"
      || manifest.status === "unavailable"
      || manifest.status === "error")
    && Array.isArray(manifest.unitIds)
    && manifest.unitIds.every((unitId) => typeof unitId === "string")
    && Array.isArray(manifest.sources)
    && manifest.sources.every(isFlexMotorManifestSource)
    && typeof manifest.message === "string"
    && Array.isArray(manifest.warnings)
    && manifest.warnings.every((warning) => typeof warning === "string");
};

/** Fetches and validates the management-only Flex motor inventory response for a job. */
export async function fetchFlexMotorUnits(jobId: string): Promise<FlexMotorUnitsResult> {
  const { data, error } = await dataLayerClient.functions.invoke("fetch-flex-motor-units", {
    body: { jobId },
  });

  if (error) {
    throw new Error(error.message || "No se pudieron obtener los motores de Flex.");
  }
  if (!data || typeof data !== "object") {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const payload = data as Record<string, unknown>;
  if (!Array.isArray(payload.units)
    || !Array.isArray(payload.modelErrors)
    || !payload.modelErrors.every(isFlexMotorModelError)
    || !isFlexMotorManifestSelection(payload.manifest)) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const units: FlexMotorUnit[] = [];
  for (const value of payload.units) {
    const unit = normalizeFlexMotorUnit(value);
    if (!unit) throw new Error(INVALID_RESPONSE_MESSAGE);
    units.push(unit);
  }

  const validUnitIds = new Set(units.map((unit) => unit.id));
  const manifest = {
    ...payload.manifest,
    unitIds: payload.manifest.unitIds.filter((id) => validUnitIds.has(id)),
  };
  return { units, modelErrors: payload.modelErrors, manifest };
}
