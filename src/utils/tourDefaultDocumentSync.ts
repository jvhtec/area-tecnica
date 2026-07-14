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
import { withTourDefaultDocumentMutationLock } from "@/utils/tourDefaultDocumentMutationQueue";
import { getTourDateTechnicalPdfFileName } from "@/utils/technicalPdfNames";
import {
  createTourDefaultDocumentVersionKey,
  getTourDefaultDocumentObjectPath,
  getTourDefaultDocumentSlotPrefix,
} from "@/utils/tourDefaultDocumentVersioning";

export { getTourDefaultDocumentObjectPath } from "@/utils/tourDefaultDocumentVersioning";

const TOUR_DOCUMENTS_BUCKET = "tour-documents";
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
type PdfPowerSummary = Parameters<typeof exportToPDF>[6];

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

export type TourDefaultDocumentSyncToastPayload = { title: string; description: string; variant: "destructive" };
type TourDefaultDocumentSyncToast = (payload: TourDefaultDocumentSyncToastPayload) => void;

export interface SyncTourDefaultDocumentsOptions {
  tourId: string;
  tourDateIds?: string[];
  client?: SupabaseClientLike;
  logoUrl?: string;
  fetchLogo?: (tourId: string) => Promise<string | undefined>;
  exportPdf?: typeof exportToPDF;
}

export const getTourDefaultDocumentNoUpdateToast = (
  result: SyncTourDefaultDocumentsResult
): TourDefaultDocumentSyncToastPayload | null =>
  result.errors.length === 0 && result.uploaded === 0 && result.skipped > 0
    ? {
        title: "Ningún PDF actualizado",
        description:
          "No se generó ningún PDF automático: revisa que las fechas de gira tengan un paquete o conjunto por defecto asignado.",
        variant: "destructive",
      }
    : null;

export const toastTourDefaultDocumentNoUpdate = (
  result: SyncTourDefaultDocumentsResult,
  toast: TourDefaultDocumentSyncToast
) => {
  const payload = getTourDefaultDocumentNoUpdateToast(result);
  if (payload) toast(payload);
};

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
}) => getTourDateTechnicalPdfFileName(
  tourName,
  date,
  locationName,
  department,
  type,
  packageLabel,
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

const buildUploadPlanItem = (
  tour: TourRow,
  tourDate: TourDateRow,
  department: PackageDepartment,
  type: TourDefaultDocumentType,
  defaultSet: TourDefaultSetRow,
  defaultTables: TourDefaultTableRow[],
  powerOverrides: TourDatePowerOverrideRow[],
  weightOverrides: TourDateWeightOverrideRow[],
  packageLabel: string,
): Extract<TourDefaultDocumentPlanItem, { action: "upload" }> => {
  const locationName = getTourDateLocationName(tourDate);
  const jobDate = tourDate.date || tourDate.start_date;
  const versionKey = createTourDefaultDocumentVersionKey();

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
          buildUploadPlanItem(
            tour,
            tourDate,
            department,
            type,
            resolution.set,
            tablesForType,
            powerOverridesForDate,
            weightOverridesForDate,
            getPackageSetLabel(department, resolution.packageSize, resolution.set),
          )
        );
      }
    }
  }

  return plan;
};

const loadTourDefaultDocumentSyncData = async (
  client: SupabaseClientLike,
  tourId: string,
  tourDateIds?: string[],
): Promise<TourDefaultDocumentSyncData> => {
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

const cleanupTourDefaultDocumentSlot = async (
  client: SupabaseClientLike,
  tourId: string,
  tourDateId: string,
  department: PackageDepartment,
  type: TourDefaultDocumentType,
  keepPath?: string,
) => {
  const slotPrefix = getTourDefaultDocumentSlotPrefix({
    tourId,
    tourDateId,
    department,
    type,
  });

  const { data: existingDocuments, error: loadError } = await client
    .from("tour_documents")
    .select("id, file_path")
    .eq("tour_id", tourId)
    .like("file_path", `${slotPrefix}%`);

  if (loadError) throw loadError;

  const documentsToRemove = (existingDocuments || []).filter(
    (document) => document.file_path && document.file_path !== keepPath
  );
  const paths = Array.from(new Set(documentsToRemove.map((document) => document.file_path)));
  const rowIds = documentsToRemove.map((document) => document.id);

  if (rowIds.length > 0) {
    const { error: deleteError } = await client
      .from("tour_documents")
      .delete()
      .eq("tour_id", tourId)
      .in("id", rowIds);

    if (deleteError) throw deleteError;
  }

  if (paths.length > 0) {
    const { error: storageError } = await client.storage
      .from(TOUR_DOCUMENTS_BUCKET)
      .remove(paths);

    if (storageError) throw storageError;
  }
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
  await withTourDefaultDocumentMutationLock(tourId, async () => {
    for (const department of PACKAGE_DEPARTMENTS) {
      for (const type of TOUR_DEFAULT_DOCUMENT_TYPES) {
        await cleanupTourDefaultDocumentSlot(
          client,
          tourId,
          tourDateId,
          department,
          type,
        );
      }
    }
  });
};

const uploadTourDefaultDocument = async (
  client: SupabaseClientLike,
  tourId: string,
  tourDateId: string,
  department: PackageDepartment,
  type: TourDefaultDocumentType,
  objectPath: string,
  fileName: string,
  pdfBlob: Blob,
) => {
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

  // Publish first, then retire predecessors. A failed upload/insert therefore
  // leaves the previous valid row and object untouched.
  await cleanupTourDefaultDocumentSlot(
    client,
    tourId,
    tourDateId,
    department,
    type,
    objectPath,
  );
};

const generateTourDefaultDocumentPdf = async (
  item: Extract<TourDefaultDocumentPlanItem, { action: "upload" }>,
  logoUrl: string | undefined,
  exportPdf: typeof exportToPDF,
) => {
  let tables: PdfTables;
  let powerSummary: PdfPowerSummary;
  let safetyMargin: number;
  let fohSchukoRequired: boolean | undefined;

  if (item.type === "power") {
    ({ tables, powerSummary, safetyMargin, fohSchukoRequired } = buildPowerPdfPayload(item));
  } else {
    tables = buildWeightPdfTables(item);
    safetyMargin = buildWeightSafetyMargin(item);
  }

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
    fohSchukoRequired,
  );
};

const runTourDefaultDocumentSync = async ({
  tourId,
  tourDateIds,
  client = supabase,
  logoUrl,
  fetchLogo = fetchTourLogo,
  exportPdf = exportToPDF,
}: SyncTourDefaultDocumentsOptions): Promise<SyncTourDefaultDocumentsResult> => {
  const data = await loadTourDefaultDocumentSyncData(client, tourId, tourDateIds);
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
        await cleanupTourDefaultDocumentSlot(
          client,
          tourId,
          item.tourDate.id,
          item.department,
          item.type,
        );
        result.removed += 1;
        if (item.reason !== "no_tables") result.skipped += 1;
        continue;
      }

      const pdfBlob = await generateTourDefaultDocumentPdf(
        item,
        resolvedLogoUrl,
        exportPdf,
      );
      await uploadTourDefaultDocument(
        client,
        tourId,
        item.tourDate.id,
        item.department,
        item.type,
        item.objectPath,
        item.fileName,
        pdfBlob,
      );
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

export const syncTourDefaultDocuments = (options: SyncTourDefaultDocumentsOptions): Promise<SyncTourDefaultDocumentsResult> =>
  withTourDefaultDocumentMutationLock(options.tourId, () => runTourDefaultDocumentSync(options));
