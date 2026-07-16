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

  const payload = data as Partial<FlexMotorUnitsResult>;
  if (!Array.isArray(payload.units) || !Array.isArray(payload.modelErrors) || !payload.manifest) {
    throw new Error("Flex devolvió una respuesta no válida para los motores.");
  }

  const validUnitIds = new Set(payload.units.map((unit) => unit.id));
  const manifest = {
    ...payload.manifest,
    unitIds: payload.manifest.unitIds.filter((id) => validUnitIds.has(id)),
  };
  return { units: payload.units, modelErrors: payload.modelErrors, manifest };
}
