export type MotorModelDefinition = {
  id: string;
  name: string;
};

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

export const MOTOR_MODELS: readonly MotorModelDefinition[] = [
  { id: "1eea69e0-5b37-11eb-966a-2a0a4490a7fb", name: "Motor eléctrico de elevación 250 kg - 20 m" },
  { id: "1eecb3d0-5b37-11eb-966a-2a0a4490a7fb", name: "Motor eléctrico de elevación 500 kg - 25 m" },
  { id: "6278f01b-ee56-4454-b6c9-3706edcbe61c", name: "Motor eléctrico de elevación ChainMaster D8 1000 kg - 30 m" },
  { id: "396fa837-0b0d-4283-85d6-6ddfdf2bd25d", name: "Motor de elevación 2000 kg - 18 m" },
  { id: "a6433316-f446-494c-a3d7-91e9c06cc9bc", name: "Motor de elevación 2000 kg 2 m/min - 25 m" },
  { id: "4c73bf4d-ec97-42db-8fb2-439fb37843ac", name: "Motor de elevación 2000 kg 4 m/min - 25 m" },
  { id: "83f6c04b-1835-48fd-9f75-f02181ca362b", name: "Motor de elevación 2000 kg D8+ - 24 m" },
  { id: "eb81f94a-55b9-4b52-b47b-05744093add5", name: "Motor de elevación ChainMaster D8+ 750 kg - 24 m" },
  { id: "39b21045-09f6-49ac-9c02-c24342caa70e", name: "Motor de velocidad variable 750 kg" },
] as const;

const textValue = (value: unknown): string | null => {
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
