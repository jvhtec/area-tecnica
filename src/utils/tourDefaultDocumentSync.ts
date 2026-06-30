import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { exportToPDF } from "@/utils/pdfExport";
import { fetchTourLogo } from "@/utils/pdf/logoUtils";
import { getDepartmentLabel } from "@/types/department";
import { toJobTimezone } from "@/utils/timezoneUtils";
import {
  PACKAGE_DEPARTMENTS,
  getPackageSetLabel,
  resolveDefaultSetForTourDate,
  type PackageDepartment,
} from "@/utils/tourPackages";
import { buildNormalizedTourPowerTables } from "@/utils/tourPowerTables";

const TOUR_DOCUMENTS_BUCKET = "tour-documents";
const AUTO_DEFAULT_DOCUMENT_ROOT = "auto-generated/default-pdfs";
const TOUR_DEFAULT_DOCUMENT_TYPES = ["power", "weight"] as const;
const UNKNOWN_LOCATION_LABEL = "Ubicación desconocida";

type Tables = Database["public"]["Tables"];
type TourRow = Pick<Tables["tours"]["Row"], "id" | "name">;
type TourDateRow = Tables["tour_dates"]["Row"] & {
  locations?: { name: string | null } | Array<{ name: string | null }> | null;
  location?: { name: string | null } | Array<{ name: string | null }> | null;
};
type TourDefaultSetRow = Tables["tour_default_sets"]["Row"];
type TourDefaultTableRow = Tables["tour_default_tables"]["Row"];
type TourDatePowerOverrideRow = Tables["tour_date_power_overrides"]["Row"];
type TourDateWeightOverrideRow = Tables["tour_date_weight_overrides"]["Row"];
type TourDefaultDocumentType = (typeof TOUR_DEFAULT_DOCUMENT_TYPES)[number];
type JsonRecord = Record<string, unknown>;
type PdfTables = Parameters<typeof exportToPDF>[1];
type PdfTable = PdfTables[number];
type PdfTableRow = PdfTable["rows"][number];

type SupabaseClientLike = typeof supabase;

export interface TourDefaultDocumentSyncData {
  tour: TourRow;
  tourDates: TourDateRow[];
  defaultSets: TourDefaultSetRow[];
  defaultTables: TourDefaultTableRow[];
  powerOverrides?: TourDatePowerOverrideRow[];
  weightOverrides?: TourDateWeightOverrideRow[];
}

export type TourDefaultDocumentPlanItem =
  | {
      action: "upload";
      tour: TourRow;
      tourDate: TourDateRow;
      department: PackageDepartment;
      type: TourDefaultDocumentType;
      defaultSet: TourDefaultSetRow;
      defaultTables: TourDefaultTableRow[];
      powerOverrides: TourDatePowerOverrideRow[];
      weightOverrides: TourDateWeightOverrideRow[];
      packageLabel: string;
      objectPath: string;
      fileName: string;
      title: string;
      jobName: string;
      jobDate: string;
    }
  | {
      action: "cleanup";
      tourDate: TourDateRow;
      department: PackageDepartment;
      type: TourDefaultDocumentType;
      objectPath: string;
      reason: "missing_default_set" | "ambiguous_default_set" | "invalid_default_set" | "no_tables";
    };

export interface SyncTourDefaultDocumentsResult {
  uploaded: number;
  removed: number;
  skipped: number;
  errors: Array<{
    objectPath: string;
    message: string;
  }>;
}

export interface SyncTourDefaultDocumentsOptions {
  tourId: string;
  tourDateIds?: string[];
  client?: SupabaseClientLike;
  logoUrl?: string;
  fetchLogo?: (tourId: string) => Promise<string | undefined>;
  exportPdf?: typeof exportToPDF;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const getRecord = (value: unknown): JsonRecord =>
  isRecord(value) ? value : {};

const getRowsFromJson = (value: unknown): PdfTableRow[] => {
  if (!isRecord(value)) return [];

  if (Array.isArray(value.rows)) {
    return value.rows.filter(isRecord) as PdfTableRow[];
  }

  if (isRecord(value.tableData) && Array.isArray(value.tableData.rows)) {
    return value.tableData.rows.filter(isRecord) as PdfTableRow[];
  }

  return [];
};

const getSafetyMarginFromJson = (value: unknown): number => {
  if (!isRecord(value)) return 0;
  const direct = getNumber(value.safetyMargin);
  if (direct !== undefined) return direct;
  return isRecord(value.tableData) ? getNumber(value.tableData.safetyMargin) ?? 0 : 0;
};

const getTourDateLocationName = (tourDate: TourDateRow): string => {
  const locationSource = tourDate.locations ?? tourDate.location;
  const location = Array.isArray(locationSource) ? locationSource[0] : locationSource;
  return location?.name || UNKNOWN_LOCATION_LABEL;
};

const getPdfTypeLabel = (type: TourDefaultDocumentType) =>
  type === "power" ? "potencia" : "peso";

const cleanDisplayFilePart = (value: string): string =>
  value.replace(/[\\/\r\n]+/g, " ").replace(/\s+/g, " ").trim();

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

const getTourDefaultDocumentSlotPrefix = ({
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

export const getTourDefaultDocumentFileName = ({
  tourName,
  date,
  locationName,
  department,
  type,
  packageLabel,
}: {
  tourName: string;
  date: string;
  locationName: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  packageLabel?: string;
}) =>
  cleanDisplayFilePart(
    `${tourName} - ${date} - ${locationName} - ${
      packageLabel || getDepartmentLabel(department)
    } ${getPdfTypeLabel(type)}.pdf`
  );

const getTourDefaultDocumentTitle = ({
  tourName,
  locationName,
  department,
  type,
  packageLabel,
}: {
  tourName: string;
  locationName: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  packageLabel?: string;
}) =>
  `${tourName} - ${locationName} - ${
    packageLabel || getDepartmentLabel(department)
  } ${getPdfTypeLabel(type)}`;

const sortTourDefaultTables = (tables: TourDefaultTableRow[]) =>
  [...tables].sort((left, right) => {
    const leftOrder = getNumber(getRecord(left.metadata).order_index) ?? 999;
    const rightOrder = getNumber(getRecord(right.metadata).order_index) ?? 999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return toJobTimezone(left.created_at).getTime() - toJobTimezone(right.created_at).getTime();
  });

const sortOverrides = <
  TOverride extends {
    id: string;
    created_at?: string | null;
    updated_at?: string | null;
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

const buildTourDefaultDocumentVersionKey = ({
  tour,
  tourDate,
  department,
  type,
  defaultSet,
  defaultTables,
  powerOverrides,
  weightOverrides,
  packageLabel,
}: {
  tour: TourRow;
  tourDate: TourDateRow;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  defaultSet: TourDefaultSetRow;
  defaultTables: TourDefaultTableRow[];
  powerOverrides: TourDatePowerOverrideRow[];
  weightOverrides: TourDateWeightOverrideRow[];
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
        locationName: getTourDateLocationName(tourDate),
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
      defaultTables: sortTourDefaultTables(defaultTables).map((table) => ({
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

const getTableRiggingPoint = (metadata: unknown) => {
  const record = getRecord(metadata);
  return getString(record.riggingPoint) || getString(record.riggingPoints);
};

const buildWeightPdfTables = (item: Extract<TourDefaultDocumentPlanItem, { action: "upload" }>): PdfTables => {
  if (item.weightOverrides.length > 0) {
    return item.weightOverrides.map((override): PdfTable => ({
      name: override.item_name || "Anulación",
      rows: getRowsFromJson(override.override_data),
      totalWeight: (override.weight_kg ?? 0) * (override.quantity ?? 1),
      toolType: "pesos",
    }));
  }

  return sortTourDefaultTables(item.defaultTables).map((defaultTable): PdfTable => ({
    name: defaultTable.table_name || "Unnamed",
    rows: getRowsFromJson(defaultTable.table_data),
    totalWeight: defaultTable.total_value || 0,
    dualMotors: getBoolean(getRecord(defaultTable.metadata).dualMotors) || false,
    riggingPoint: getTableRiggingPoint(defaultTable.metadata),
    toolType: "pesos",
  }));
};

const buildWeightSafetyMargin = (
  item: Extract<TourDefaultDocumentPlanItem, { action: "upload" }>
): number => {
  if (item.weightOverrides.length > 0) {
    return getSafetyMarginFromJson(item.weightOverrides[0]?.override_data);
  }

  const firstDefault = sortTourDefaultTables(item.defaultTables)[0];
  if (!firstDefault) return 0;
  const metadataMargin = getNumber(getRecord(firstDefault.metadata).safetyMargin);
  return metadataMargin ?? getSafetyMarginFromJson(firstDefault.table_data);
};

const buildPowerPdfPayload = (
  item: Extract<TourDefaultDocumentPlanItem, { action: "upload" }>
) => {
  const { tables, safetyMargin } = buildNormalizedTourPowerTables({
    department: item.department,
    overrides: item.powerOverrides,
    defaultTables: item.defaultTables,
  });

  const powerSummary = {
    totalSystemWatts: tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0),
    totalSystemAmps: tables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0),
    totalSystemKva:
      tables.reduce((sum, table) => sum + (table.totalVa || table.totalWatts || 0), 0) /
      1000,
  };

  const fohSchukoRequired =
    (item.department === "sound" || item.department === "lights") &&
    (tables.some((table) => table.fohSchukoRequired) ||
      item.defaultTables.some((table) => getBoolean(getRecord(table.metadata).foh_schuko) ?? false));

  return {
    tables: tables as PdfTables,
    powerSummary,
    safetyMargin,
    fohSchukoRequired,
  };
};

const buildUploadPlanItem = ({
  tour,
  tourDate,
  department,
  type,
  defaultSet,
  defaultTables,
  powerOverrides,
  weightOverrides,
  packageLabel,
}: {
  tour: TourRow;
  tourDate: TourDateRow;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  defaultSet: TourDefaultSetRow;
  defaultTables: TourDefaultTableRow[];
  powerOverrides: TourDatePowerOverrideRow[];
  weightOverrides: TourDateWeightOverrideRow[];
  packageLabel: string;
}): Extract<TourDefaultDocumentPlanItem, { action: "upload" }> => {
  const locationName = getTourDateLocationName(tourDate);
  const jobDate = tourDate.date || tourDate.start_date;
  const versionKey = buildTourDefaultDocumentVersionKey({
    tour,
    tourDate,
    department,
    type,
    defaultSet,
    defaultTables,
    powerOverrides,
    weightOverrides,
    packageLabel,
  });

  return {
    action: "upload",
    tour,
    tourDate,
    department,
    type,
    defaultSet,
    defaultTables,
    powerOverrides,
    weightOverrides,
    packageLabel,
    objectPath: getTourDefaultDocumentObjectPath({
      tourId: tour.id,
      tourDateId: tourDate.id,
      department,
      type,
      versionKey,
    }),
    fileName: getTourDefaultDocumentFileName({
      tourName: tour.name,
      date: jobDate,
      locationName,
      department,
      type,
      packageLabel,
    }),
    title: getTourDefaultDocumentTitle({
      tourName: tour.name,
      locationName,
      department,
      type,
      packageLabel,
    }),
    jobName: `${tour.name} - ${locationName}`,
    jobDate,
  };
};

export const buildTourDefaultDocumentPlan = ({
  tour,
  tourDates,
  defaultSets,
  defaultTables,
  powerOverrides = [],
  weightOverrides = [],
}: TourDefaultDocumentSyncData): TourDefaultDocumentPlanItem[] => {
  const plan: TourDefaultDocumentPlanItem[] = [];

  for (const tourDate of tourDates) {
    for (const department of PACKAGE_DEPARTMENTS) {
      const resolution = resolveDefaultSetForTourDate({
        tourDate,
        department,
        defaultSets,
      });

      for (const type of TOUR_DEFAULT_DOCUMENT_TYPES) {
        const objectPath = getTourDefaultDocumentObjectPath({
          tourId: tour.id,
          tourDateId: tourDate.id,
          department,
          type,
        });

        if (resolution.status !== "resolved") {
          plan.push({
            action: "cleanup",
            tourDate,
            department,
            type,
            objectPath,
            reason:
              resolution.status === "ambiguous"
                ? "ambiguous_default_set"
                : resolution.status === "invalid_explicit"
                  ? "invalid_default_set"
                  : "missing_default_set",
          });
          continue;
        }

        const tablesForType = defaultTables.filter(
          (table) => table.set_id === resolution.set.id && table.table_type === type
        );
        const powerOverridesForDate =
          type === "power"
            ? powerOverrides.filter(
                (override) =>
                  override.tour_date_id === tourDate.id && override.department === department
              )
            : [];
        const weightOverridesForDate =
          type === "weight"
            ? weightOverrides.filter(
                (override) =>
                  override.tour_date_id === tourDate.id && override.department === department
              )
            : [];

        if (
          tablesForType.length === 0 &&
          powerOverridesForDate.length === 0 &&
          weightOverridesForDate.length === 0
        ) {
          plan.push({
            action: "cleanup",
            tourDate,
            department,
            type,
            objectPath,
            reason: "no_tables",
          });
          continue;
        }

        plan.push(
          buildUploadPlanItem({
            tour,
            tourDate,
            department,
            type,
            defaultSet: resolution.set,
            defaultTables: tablesForType,
            powerOverrides: powerOverridesForDate,
            weightOverrides: weightOverridesForDate,
            packageLabel: getPackageSetLabel(department, resolution.packageSize, resolution.set),
          })
        );
      }
    }
  }

  return plan;
};

const loadTourDefaultDocumentSyncData = async ({
  client,
  tourId,
  tourDateIds,
}: {
  client: SupabaseClientLike;
  tourId: string;
  tourDateIds?: string[];
}): Promise<TourDefaultDocumentSyncData> => {
  const { data: tour, error: tourError } = await client
    .from("tours")
    .select("id, name")
    .eq("id", tourId)
    .single();

  if (tourError) throw tourError;
  if (!tour) throw new Error("Tour not found");

  let datesQuery = client
    .from("tour_dates")
    .select(
      `
        id,
        tour_id,
        date,
        start_date,
        end_date,
        is_tour_pack_only,
        sound_package_size,
        lights_package_size,
        video_package_size,
        sound_default_set_id,
        lights_default_set_id,
        video_default_set_id,
        locations (
          name
        )
      `
    )
    .eq("tour_id", tourId)
    .order("date", { ascending: true });

  if (tourDateIds?.length) {
    datesQuery = datesQuery.in("id", tourDateIds);
  }

  const { data: tourDates, error: datesError } = await datesQuery;
  if (datesError) throw datesError;

  const { data: defaultSets, error: setsError } = await client
    .from("tour_default_sets")
    .select("*")
    .eq("tour_id", tourId)
    .order("created_at", { ascending: true });

  if (setsError) throw setsError;

  const setIds = (defaultSets || []).map((set) => set.id);
  const dateIds = (tourDates || []).map((tourDate) => tourDate.id);

  const [{ data: defaultTables, error: tablesError }, powerResult, weightResult] =
    await Promise.all([
      setIds.length
        ? client
            .from("tour_default_tables")
            .select("*")
            .in("set_id", setIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      dateIds.length
        ? client
            .from("tour_date_power_overrides")
            .select("*")
            .in("tour_date_id", dateIds)
        : Promise.resolve({ data: [], error: null }),
      dateIds.length
        ? client
            .from("tour_date_weight_overrides")
            .select("*")
            .in("tour_date_id", dateIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (tablesError) throw tablesError;
  if (powerResult.error) throw powerResult.error;
  if (weightResult.error) throw weightResult.error;

  return {
    tour: tour as TourRow,
    tourDates: (tourDates || []) as TourDateRow[],
    defaultSets: (defaultSets || []) as TourDefaultSetRow[],
    defaultTables: (defaultTables || []) as TourDefaultTableRow[],
    powerOverrides: (powerResult.data || []) as TourDatePowerOverrideRow[],
    weightOverrides: (weightResult.data || []) as TourDateWeightOverrideRow[],
  };
};

const cleanupTourDefaultDocumentSlot = async ({
  client,
  tourId,
  tourDateId,
  department,
  type,
}: {
  client: SupabaseClientLike;
  tourId: string;
  tourDateId: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
}) => {
  const slotPrefix = getTourDefaultDocumentSlotPrefix({
    tourId,
    tourDateId,
    department,
    type,
  });

  const { data: existingDocuments, error: loadError } = await client
    .from("tour_documents")
    .select("file_path")
    .eq("tour_id", tourId)
    .like("file_path", `${slotPrefix}%`);

  if (loadError) throw loadError;

  const paths = Array.from(
    new Set(
      (existingDocuments || [])
        .map((document) => document.file_path)
        .filter((path): path is string => typeof path === "string" && path.length > 0)
    )
  );

  if (paths.length > 0) {
    const { error: storageError } = await client.storage
      .from(TOUR_DOCUMENTS_BUCKET)
      .remove(paths);

    if (storageError) throw storageError;
  }

  const { error } = await client
    .from("tour_documents")
    .delete()
    .eq("tour_id", tourId)
    .like("file_path", `${slotPrefix}%`);

  if (error) throw error;
};

export const cleanupTourDefaultDocumentsForDate = async ({
  tourId,
  tourDateId,
  client = supabase,
}: {
  tourId: string;
  tourDateId: string;
  client?: SupabaseClientLike;
}) => {
  for (const department of PACKAGE_DEPARTMENTS) {
    for (const type of TOUR_DEFAULT_DOCUMENT_TYPES) {
      await cleanupTourDefaultDocumentSlot({
        client,
        tourId,
        tourDateId,
        department,
        type,
      });
    }
  }
};

const uploadTourDefaultDocument = async ({
  client,
  tourId,
  tourDateId,
  department,
  type,
  objectPath,
  fileName,
  pdfBlob,
}: {
  client: SupabaseClientLike;
  tourId: string;
  tourDateId: string;
  department: PackageDepartment;
  type: TourDefaultDocumentType;
  objectPath: string;
  fileName: string;
  pdfBlob: Blob;
}) => {
  await cleanupTourDefaultDocumentSlot({
    client,
    tourId,
    tourDateId,
    department,
    type,
  });

  const { error: uploadError } = await client.storage
    .from(TOUR_DOCUMENTS_BUCKET)
    .upload(objectPath, pdfBlob, {
      cacheControl: "0",
      upsert: false,
      contentType: "application/pdf",
    });

  if (uploadError) throw uploadError;

  const { data: userResult } = await client.auth.getUser();
  const { error: insertError } = await client.from("tour_documents").insert({
    tour_id: tourId,
    file_name: fileName,
    file_path: objectPath,
    file_type: "application/pdf",
    file_size: pdfBlob.size,
    uploaded_by: userResult?.user?.id || null,
    visible_to_tech: true,
    visible_to_guest: false,
  });

  if (insertError) {
    const { error: cleanupError } = await client.storage
      .from(TOUR_DOCUMENTS_BUCKET)
      .remove([objectPath]);

    if (cleanupError) {
      console.error("Error removing uploaded tour default document after insert failure:", cleanupError);
    }

    throw insertError;
  }
};

const generateTourDefaultDocumentPdf = async ({
  item,
  logoUrl,
  exportPdf,
}: {
  item: Extract<TourDefaultDocumentPlanItem, { action: "upload" }>;
  logoUrl?: string;
  exportPdf: typeof exportToPDF;
}) => {
  if (item.type === "power") {
    const { tables, powerSummary, safetyMargin, fohSchukoRequired } = buildPowerPdfPayload(item);
    return exportPdf(
      item.title,
      tables,
      item.type,
      item.jobName,
      item.jobDate,
      undefined,
      powerSummary,
      safetyMargin,
      logoUrl,
      fohSchukoRequired
    );
  }

  const tables = buildWeightPdfTables(item);
  return exportPdf(
    item.title,
    tables,
    item.type,
    item.jobName,
    item.jobDate,
    undefined,
    undefined,
    buildWeightSafetyMargin(item),
    logoUrl
  );
};

export const syncTourDefaultDocuments = async ({
  tourId,
  tourDateIds,
  client = supabase,
  logoUrl,
  fetchLogo = fetchTourLogo,
  exportPdf = exportToPDF,
}: SyncTourDefaultDocumentsOptions): Promise<SyncTourDefaultDocumentsResult> => {
  const data = await loadTourDefaultDocumentSyncData({ client, tourId, tourDateIds });
  const plan = buildTourDefaultDocumentPlan(data);
  const result: SyncTourDefaultDocumentsResult = {
    uploaded: 0,
    removed: 0,
    skipped: 0,
    errors: [],
  };

  let resolvedLogoUrl = logoUrl;
  if (resolvedLogoUrl === undefined) {
    try {
      resolvedLogoUrl = await fetchLogo(tourId);
    } catch (error) {
      console.error("Error fetching tour logo for default document sync:", error);
    }
  }

  for (const item of plan) {
    try {
      if (item.action === "cleanup") {
        await cleanupTourDefaultDocumentSlot({
          client,
          tourId,
          tourDateId: item.tourDate.id,
          department: item.department,
          type: item.type,
        });
        result.removed += 1;
        if (item.reason !== "no_tables") result.skipped += 1;
        continue;
      }

      const pdfBlob = await generateTourDefaultDocumentPdf({
        item,
        logoUrl: resolvedLogoUrl,
        exportPdf,
      });
      await uploadTourDefaultDocument({
        client,
        tourId,
        tourDateId: item.tourDate.id,
        department: item.department,
        type: item.type,
        objectPath: item.objectPath,
        fileName: item.fileName,
        pdfBlob,
      });
      result.uploaded += 1;
    } catch (error) {
      result.errors.push({
        objectPath: item.objectPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
};
