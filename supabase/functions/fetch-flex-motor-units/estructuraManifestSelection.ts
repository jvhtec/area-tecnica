import type { FlexMotorUnit } from "./motorUnits.ts";
import {
  matchMotorUnitsInManifest,
  selectOutboundManifest,
  type FlexEquipmentListReference,
  type FlexManifestSource,
} from "./manifestUnits.ts";
import { allSettledWithConcurrency } from "./concurrency.ts";

export type ManifestSelection = {
  status: "found" | "empty" | "unavailable" | "error";
  unitIds: string[];
  sources: FlexManifestSource[];
  message: string;
  warnings: string[];
};

export async function discoverEstructuraManifestSelection(options: {
  trackedEquipmentLists: FlexEquipmentListReference[];
  missingSourceDepartments: string[];
  units: FlexMotorUnit[];
  concurrency: number;
  fetchWarehouseState: (equipmentListId: string) => Promise<unknown>;
  fetchManifestRows: (manifestId: string) => Promise<unknown>;
}): Promise<ManifestSelection> {
  const {
    trackedEquipmentLists,
    missingSourceDepartments,
    units,
    concurrency,
    fetchWarehouseState,
    fetchManifestRows,
  } = options;
  const candidates = [...new Map(
    trackedEquipmentLists.map((list) => [list.id, list]),
  ).values()];
  const warnings: string[] = missingSourceDepartments.length > 0
    ? [`Falta el Pull Sheet de Estructura de ${missingSourceDepartments.join(" y ")}.`]
    : [];

  if (candidates.length === 0) {
    return {
      status: "unavailable",
      unitIds: [],
      sources: [],
      message: "El trabajo todavía no tiene los Pull Sheets de Estructura Sonido y Estructura Luces.",
      warnings,
    };
  }

  const stateResults = await allSettledWithConcurrency(
    candidates,
    concurrency,
    async (equipmentList) => selectOutboundManifest(
      await fetchWarehouseState(equipmentList.id),
      equipmentList,
    ),
  );
  const sources = new Map<string, FlexManifestSource>();
  let stateFailures = 0;
  stateResults.forEach((result) => {
    if (result.status === "fulfilled" && result.value) {
      sources.set(result.value.manifestId, result.value);
    } else if (result.status === "rejected") {
      stateFailures += 1;
    }
  });
  if (stateFailures > 0) {
    warnings.push(`No se han podido consultar ${stateFailures} Pull Sheets de Estructura en Flex.`);
  }

  const manifestSources = Array.from(sources.values());
  if (manifestSources.length === 0) {
    return {
      status: stateFailures === candidates.length ? "error" : "unavailable",
      unitIds: [],
      sources: [],
      message: "Todavía no hay un manifiesto de salida preparado o enviado en los Pull Sheets de Estructura.",
      warnings,
    };
  }

  const rowResults = await allSettledWithConcurrency(
    manifestSources,
    concurrency,
    async (source) => matchMotorUnitsInManifest(
      await fetchManifestRows(source.manifestId),
      units,
    ),
  );
  const unitIds = new Set<string>();
  let rowFailures = 0;
  rowResults.forEach((result) => {
    if (result.status === "fulfilled") {
      result.value.forEach((unitId) => unitIds.add(unitId));
    } else {
      rowFailures += 1;
    }
  });
  if (rowFailures > 0) {
    warnings.push(`No se han podido leer ${rowFailures} manifiestos de Estructura en Flex.`);
  }

  return {
    status: unitIds.size > 0 ? "found" : rowFailures === manifestSources.length ? "error" : "empty",
    unitIds: Array.from(unitIds),
    sources: manifestSources,
    message: unitIds.size > 0
      ? `${unitIds.size} motores encontrados en los manifiestos de Estructura.`
      : "Los manifiestos de Estructura no contienen motores de los modelos certificados.",
    warnings,
  };
}
