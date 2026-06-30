import { toJobTimezone } from "@/utils/timezoneUtils";
import type { PackageDepartment } from "@/utils/tourPackages";

const AUTO_DEFAULT_DOCUMENT_ROOT = "auto-generated/default-pdfs";

export type TourDefaultDocumentType = "power" | "weight";

type JsonRecord = Record<string, unknown>;

interface VersionTourRow {
  id: string;
  name: string;
}

interface VersionTourDateRow {
  id: string;
  date?: string | null;
  start_date?: string | null;
  sound_package_size?: string | null;
  lights_package_size?: string | null;
  video_package_size?: string | null;
  sound_default_set_id?: string | null;
  lights_default_set_id?: string | null;
  video_default_set_id?: string | null;
}

interface VersionDefaultSetRow {
  id: string;
  name?: string | null;
  package_size?: string | null;
  updated_at?: string | null;
}

interface VersionDefaultTableRow {
  id: string;
  table_name?: string | null;
  table_type?: string | null;
  total_value?: number | null;
  table_data?: unknown;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

interface VersionPowerOverrideRow {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  table_name?: string | null;
  total_watts?: number | null;
  current_per_phase?: number | null;
  pdu_type?: string | null;
  custom_pdu_type?: string | null;
  position?: string | null;
  custom_position?: string | null;
  includes_hoist?: boolean | null;
  override_data?: unknown;
}

interface VersionWeightOverrideRow {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  item_name?: string | null;
  weight_kg?: number | null;
  quantity?: number | null;
  category?: string | null;
  override_data?: unknown;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getRecord = (value: unknown): JsonRecord =>
  isRecord(value) ? value : {};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.entries(value as JsonRecord)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
};

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const sortDefaultTables = <TTable extends VersionDefaultTableRow>(tables: TTable[]) =>
  [...tables].sort((left, right) => {
    const leftOrder = getNumber(getRecord(left.metadata).order_index) ?? 999;
    const rightOrder = getNumber(getRecord(right.metadata).order_index) ?? 999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftTime = left.created_at ? toJobTimezone(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? toJobTimezone(right.created_at).getTime() : 0;
    return leftTime - rightTime;
  });

const sortOverrides = <
  TOverride extends {
    id: string;
    created_at?: string | null;
  },
>(
  overrides: TOverride[]
) =>
  [...overrides].sort((left, right) => {
    const leftTime = left.created_at ? toJobTimezone(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? toJobTimezone(right.created_at).getTime() : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });

export const getTourDefaultDocumentSlotPrefix = ({
  tourId,
  tourDateId,
  department,
  type,
}: {
  tourId: string;
  tourDateId: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
}) =>
  `tours/${tourId}/${AUTO_DEFAULT_DOCUMENT_ROOT}/${tourDateId}/${department}-${type}`;

export const getTourDefaultDocumentObjectPath = ({
  tourId,
  tourDateId,
  department,
  type,
  versionKey,
}: {
  tourId: string;
  tourDateId: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  versionKey?: string;
}) => {
  const slotPrefix = getTourDefaultDocumentSlotPrefix({
    tourId,
    tourDateId,
    department,
    type,
  });
  return versionKey ? `${slotPrefix}-${versionKey}.pdf` : `${slotPrefix}.pdf`;
};

export const buildTourDefaultDocumentVersionKey = ({
  tour,
  tourDate,
  locationName,
  department,
  type,
  defaultSet,
  defaultTables,
  powerOverrides,
  weightOverrides,
  packageLabel,
}: {
  tour: VersionTourRow;
  tourDate: VersionTourDateRow;
  locationName: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  defaultSet: VersionDefaultSetRow;
  defaultTables: VersionDefaultTableRow[];
  powerOverrides: VersionPowerOverrideRow[];
  weightOverrides: VersionWeightOverrideRow[];
  packageLabel: string;
}) =>
  hashString(
    stableStringify({
      department,
      type,
      packageLabel,
      tour: {
        id: tour.id,
        name: tour.name,
      },
      tourDate: {
        id: tourDate.id,
        date: tourDate.date,
        start_date: tourDate.start_date,
        locationName,
        sound_package_size: tourDate.sound_package_size,
        lights_package_size: tourDate.lights_package_size,
        video_package_size: tourDate.video_package_size,
        sound_default_set_id: tourDate.sound_default_set_id,
        lights_default_set_id: tourDate.lights_default_set_id,
        video_default_set_id: tourDate.video_default_set_id,
      },
      defaultSet: {
        id: defaultSet.id,
        name: defaultSet.name,
        package_size: defaultSet.package_size,
        updated_at: defaultSet.updated_at,
      },
      defaultTables: sortDefaultTables(defaultTables).map((table) => ({
        id: table.id,
        table_name: table.table_name,
        table_type: table.table_type,
        total_value: table.total_value,
        table_data: table.table_data,
        metadata: table.metadata,
        updated_at: table.updated_at,
      })),
      powerOverrides: sortOverrides(powerOverrides).map((override) => ({
        id: override.id,
        table_name: override.table_name,
        total_watts: override.total_watts,
        current_per_phase: override.current_per_phase,
        pdu_type: override.pdu_type,
        custom_pdu_type: override.custom_pdu_type,
        position: override.position,
        custom_position: override.custom_position,
        includes_hoist: override.includes_hoist,
        override_data: override.override_data,
        updated_at: override.updated_at,
      })),
      weightOverrides: sortOverrides(weightOverrides).map((override) => ({
        id: override.id,
        item_name: override.item_name,
        weight_kg: override.weight_kg,
        quantity: override.quantity,
        category: override.category,
        override_data: override.override_data,
        updated_at: override.updated_at,
      })),
    })
  );
