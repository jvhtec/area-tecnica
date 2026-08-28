import {
  ESTRUCTURA_MOTOR_MODELS,
  type EstructuraMotorModel,
} from "../../../src/domain/estructura.ts";

export type MotorModelDefinition = EstructuraMotorModel;

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

export const MOTOR_MODELS: readonly MotorModelDefinition[] = ESTRUCTURA_MOTOR_MODELS;

/** Extracts a non-empty display string from the shapes returned by Flex. */
export const textValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["preferredDisplayString", "displayString", "name", "data"]) {
      const nested = textValue(record[key]);
      if (nested) return nested;
    }
  }

  return null;
};

const trueValue = (value: unknown): boolean =>
  value === true || (typeof value === "string" && value.toLowerCase() === "true");

const recordValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

/** Normalizes live inventory-model metadata without changing the approved model ID. */
export function normalizeMotorModel(value: unknown, fallback: MotorModelDefinition): MotorModelDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const model = value as Record<string, unknown>;
  return {
    id: fallback.id,
    name: textValue(model.preferredDisplayString) || textValue(model.name) || fallback.name,
    manufacturer: textValue(model.manufacturer),
  };
}

/** Normalizes one available serialized unit and attaches its resolved model metadata. */
export function normalizeMotorUnit(
  value: unknown,
  model: MotorModelDefinition,
): FlexMotorUnit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const row = value as Record<string, unknown>;
  const data = recordValue(row.data);
  const field = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) return row[key];
      if (data?.[key] !== undefined && data[key] !== null) return data[key];
    }
    return null;
  };
  const id = textValue(field("id", "unitId"));
  const serial = textValue(field("serial", "serialNumber"));

  if (!id || !serial) return null;

  const unavailable = [
    field("decommissioned"),
    field("sold"),
    field("deleted"),
  ].some(trueValue);

  if (unavailable) return null;

  return {
    id,
    modelId: model.id,
    modelName: model.name,
    manufacturer: model.manufacturer ?? null,
    serial,
    barcode: textValue(field("barcode")),
    stencil: textValue(field("stencil")),
    modelNumber: textValue(field("modelNumber")),
    currentLocation: textValue(field("currentLocation")),
    shippedDate: textValue(field("shippedDate")),
    returnDate: textValue(field("returnDate")),
  };
}

export type MotorGridPage = {
  rows: unknown[];
  totalElements: number | null;
  last: boolean | null;
};

export function parseMotorGridPage(value: unknown): MotorGridPage {
  if (Array.isArray(value)) {
    return { rows: value, totalElements: value.length, last: true };
  }

  if (!value || typeof value !== "object") {
    return { rows: [], totalElements: 0, last: true };
  }

  const payload = value as Record<string, unknown>;
  const rows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.content)
      ? payload.content
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload.children)
            ? payload.children
            : [];
  const totalCandidate = payload.totalElements
    ?? payload.total
    ?? payload.totalCount
    ?? payload.count;
  const numericTotal = typeof totalCandidate === "number"
    ? totalCandidate
    : typeof totalCandidate === "string" && totalCandidate.trim()
      ? Number(totalCandidate)
      : Number.NaN;

  return {
    rows,
    totalElements: Number.isFinite(numericTotal)
      ? numericTotal
      : null,
    last: typeof payload.last === "boolean" ? payload.last : null,
  };
}

export function buildMotorSerialUnitGridUrl(options: {
  apiBaseUrl: string;
  modelId: string;
  pageIndex: number;
  pageSize: number;
  cacheBuster?: number;
}): URL {
  const { apiBaseUrl, modelId, pageIndex, pageSize } = options;
  const url = new URL(`${apiBaseUrl}/serial-unit/grid-node`);
  url.searchParams.set("_dc", String(options.cacheBuster ?? Date.now()));
  url.searchParams.set("modelId", modelId);
  url.searchParams.set("page", String(pageIndex + 1));
  url.searchParams.set("start", String(pageIndex * pageSize));
  url.searchParams.set("size", String(pageSize));
  url.searchParams.set("sort", "createdDate,DESC");
  url.searchParams.set("dir", "");
  url.searchParams.set("filter", JSON.stringify([
    { property: "includeOut", value: true },
    { property: "includeOOC", value: true },
    { property: "includePresumedMissing", value: true },
  ]));
  return url;
}
