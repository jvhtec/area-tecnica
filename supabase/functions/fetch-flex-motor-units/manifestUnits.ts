import type { FlexMotorUnit } from "./motorUnits.ts";

const PULLSHEET_DEFINITION_ID = "a220432c-af33-11df-b8d5-00e08175e43e";

export type FlexEquipmentListReference = {
  id: string;
  name: string;
};

export type FlexManifestSource = {
  equipmentListId: string;
  equipmentListName: string;
  manifestId: string;
  stage: "prep" | "ship";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const textValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (isRecord(value)) {
    for (const key of ["preferredDisplayString", "displayString", "name", "data"]) {
      const nested = textValue(value[key]);
      if (nested) return nested;
    }
  }

  return null;
};

const normalizedHint = (value: unknown): string =>
  (textValue(value) || "").toLowerCase().replaceAll("_", "-");

const childCollections = (record: Record<string, unknown>): unknown[] => {
  const result: unknown[] = [];
  for (const key of ["children", "items", "content", "data"]) {
    const value = record[key];
    if (Array.isArray(value)) result.push(...value);
  }
  return result;
};

export function findEquipmentListsInTree(value: unknown): FlexEquipmentListReference[] {
  const found = new Map<string, FlexEquipmentListReference>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isRecord(node)) return;

    const id = textValue(node.elementId) || textValue(node.nodeId) || textValue(node.id);
    const definitionId = textValue(node.definitionId) || textValue(node.elementDefinitionId);
    const domainId = normalizedHint(node.domainId);
    const schemaId = normalizedHint(node.schemaId ?? node.schema_id);
    const viewHint = normalizedHint(node.viewHint ?? node.view_hint);
    const isEquipmentList = definitionId === PULLSHEET_DEFINITION_ID ||
      [domainId, schemaId, viewHint].includes("equipment-list");

    if (id && isEquipmentList) {
      found.set(id, {
        id,
        name: textValue(node.displayName) || textValue(node.name) ||
          textValue(node.documentNumber) || "Lista de material",
      });
    }

    childCollections(node).forEach(visit);
  };

  visit(value);
  return Array.from(found.values());
}

export function selectOutboundManifest(
  value: unknown,
  equipmentList: FlexEquipmentListReference,
): FlexManifestSource | null {
  if (!isRecord(value)) return null;

  const shipManifestId = textValue(value.shipManifestId);
  if (shipManifestId) {
    return {
      equipmentListId: equipmentList.id,
      equipmentListName: equipmentList.name,
      manifestId: shipManifestId,
      stage: "ship",
    };
  }

  const prepManifestId = textValue(value.prepManifestId);
  if (prepManifestId) {
    return {
      equipmentListId: equipmentList.id,
      equipmentListName: equipmentList.name,
      manifestId: prepManifestId,
      stage: "prep",
    };
  }

  return null;
}

export function matchMotorUnitsInManifest(
  rowData: unknown,
  units: readonly FlexMotorUnit[],
): string[] {
  const byId = new Map(units.map((unit) => [unit.id, unit.id]));
  const bySerial = new Map(units.map((unit) => [unit.serial.toLowerCase(), unit.id]));
  const byBarcode = new Map(
    units.flatMap((unit) => unit.barcode ? [[unit.barcode.toLowerCase(), unit.id] as const] : []),
  );
  const matched = new Set<string>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isRecord(node)) return;

    const resourceId = textValue(node.resourceId) || textValue(node.serialUnitId) ||
      textValue(node.unitId);
    const serial = textValue(node.serial) || textValue(node.serialNumber);
    const barcode = textValue(node.barcode);
    const unitId = (resourceId && byId.get(resourceId)) ||
      (serial && bySerial.get(serial.toLowerCase())) ||
      (barcode && byBarcode.get(barcode.toLowerCase()));

    if (unitId) matched.add(unitId);
    childCollections(node).forEach(visit);
  };

  visit(rowData);
  return Array.from(matched);
}
