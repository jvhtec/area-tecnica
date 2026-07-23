import { aggregatePowerCalculations } from "@/features/technical-tools/power/powerAggregation";
import type { useToast } from "@/hooks/use-toast";
import type { TourDefaultSet, TourDefaultTable } from "@/hooks/useTourDefaultSets";
import type { Database } from "@/integrations/supabase/types";
import { dataLayerClient } from "@/services/dataLayerClient";
import { getDepartmentLabel } from "@/types/department";
import { fetchTourLogo } from "@/utils/pdf/logoUtils";
import { exportToPDF } from "@/utils/pdfExport";
import {
  getTourDefaultsPdfFileName as getDefaultsPdfFilename,
  getTourDateTechnicalPdfFileName as getTourDatePdfFilename,
} from "@/utils/technicalPdfNames";
import type { TechnicalPowerDepartment } from "@/utils/technicalPowerTypes";
import {
  getDepartmentPackageSize,
  getPackageResolutionMessage,
  getPackageSetLabel,
  isPackageDepartment,
  resolveDefaultSetForTourDate,
} from "@/utils/tourPackages";
import { buildNormalizedTourPowerTables, computePowerTotalVa } from "@/utils/tourPowerTables";

import {
  getLegacyWeightQuantity,
  getTableName,
  getTourDateLocationName,
  getWeightValue,
  isLegacyPowerDefault,
  isLegacyWeightDefault,
  isNewFormatTable,
  toTourPowerDefaultRows,
  type CombinedDefaultType,
  type TourDateWithLocation,
  type TourDefaultsTour,
} from "@/components/tours/tourDefaultsManagerSupport";

type TourDatePowerOverrideRow =
  Database["public"]["Tables"]["tour_date_power_overrides"]["Row"];
type TourDateWeightOverrideRow =
  Database["public"]["Tables"]["tour_date_weight_overrides"]["Row"];

interface PdfTableRow {
  quantity?: string;
  lineName?: string;
  componentName?: string;
  weight?: string;
  watts?: string;
  totalWeight?: number;
  totalWatts?: number;
  x?: number;
  reactionKg?: number;
  hoistName?: string;
}

interface PdfTable {
  name: string;
  rows: PdfTableRow[];
  totalWeight?: number;
  dualMotors?: boolean;
  totalWatts?: number;
  totalVa?: number;
  currentPerPhase?: number;
  phaseMode?: "single" | "three";
  toolType?: "pesos" | "consumos" | "rigging";
  pduType?: string;
  customPduType?: string;
  position?: string;
  customPosition?: string;
  includesHoist?: boolean;
  riggingPoint?: string;
  id?: number;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getRowsFromJson = (value: unknown): PdfTableRow[] => {
  if (!isRecord(value) || !Array.isArray(value.rows)) return [];
  return value.rows.filter(isRecord).map((row) => row as PdfTableRow);
};

const getSafetyMarginFromJson = (value: unknown): number => {
  if (!isRecord(value)) return 0;
  const safetyMargin = value.safetyMargin;
  return typeof safetyMargin === "number" && Number.isFinite(safetyMargin)
    ? safetyMargin
    : 0;
};

const isTechnicalPowerDepartment = (
  department: string,
): department is TechnicalPowerDepartment =>
  department === "sound" || department === "lights" || department === "video";

const computeTotalVa = (
  watts: number,
  metadata: unknown,
  department?: string,
): number => {
  if (!department || !isTechnicalPowerDepartment(department)) return watts;
  return computePowerTotalVa(watts, metadata, department);
};

const getPdfTypeLabel = (type: "power" | "weight") =>
  type === "power" ? "potencia" : "peso";

const getDefaultsPdfTitle = (
  tourName: string,
  department: string,
  type: "power" | "weight",
  packageLabel?: string,
) =>
  `${tourName} - ${packageLabel || getDepartmentLabel(department)} ${getPdfTypeLabel(type)} predeterminados`;

const getTourDatePdfTitle = (
  tourName: string,
  locationName: string,
  department: string,
  type: "power" | "weight",
  packageLabel?: string,
) =>
  `${tourName} - ${locationName} - ${packageLabel || getDepartmentLabel(department)} ${getPdfTypeLabel(type)}`;

interface UseTourDefaultsPdfExportsOptions {
  defaultSets: TourDefaultSet[];
  defaultTables: TourDefaultTable[];
  getDepartmentDefaults: (
    department: string,
    type: "power" | "weight",
  ) => CombinedDefaultType[];
  toast: ReturnType<typeof useToast>["toast"];
  tour: TourDefaultsTour;
  tourDates: TourDateWithLocation[];
}

export function useTourDefaultsPdfExports({
  defaultSets,
  defaultTables,
  getDepartmentDefaults,
  toast,
  tour,
  tourDates,
}: UseTourDefaultsPdfExportsOptions) {
  const handleBulkPDFExport = async (
    department: string,
    type: 'power' | 'weight',
    options?: { setId?: string; packageLabel?: string }
  ) => {
    try {
      const departmentSets = defaultSets.filter((set) => set.department === department);
      let relevantDefaults: CombinedDefaultType[];
      let packageLabel = options?.packageLabel;

      if (options?.setId) {
        relevantDefaults = defaultTables.filter(
          (table) => table.set_id === options.setId && table.table_type === type
        );
      } else if (departmentSets.length === 1) {
        const set = departmentSets[0];
        packageLabel = isPackageDepartment(department)
          ? getPackageSetLabel(department, set.package_size || null, set)
          : set.name;
        relevantDefaults = defaultTables.filter(
          (table) => table.set_id === set.id && table.table_type === type
        );
      } else if (departmentSets.length > 1) {
        toast({
          title: 'Seleccione un paquete',
          description: `Hay varios conjuntos de ${getDepartmentLabel(department)}. Exporta desde un conjunto específico para no mezclar paquetes.`,
          variant: 'destructive',
        });
        return;
      } else {
        relevantDefaults = getDepartmentDefaults(department, type);
      }

      if (relevantDefaults.length === 0) {
        toast({
          title: 'No se encontraron valores por defecto',
          description: `No se encontraron valores por defecto de ${type === 'power' ? 'potencia' : 'peso'} para el departamento de ${department}`,
          variant: 'destructive',
        });
        return;
      }

      // Fetch tour logo
      let logoUrl: string | undefined;
      try {
        logoUrl = await fetchTourLogo(tour.id);
      } catch (error) {
        console.error('Error fetching tour logo:', error);
      }

      if (type === 'power') {
        const { tables } = buildNormalizedTourPowerTables({
          department: department as 'sound' | 'lights' | 'video',
          defaultTables: relevantDefaults.filter(isNewFormatTable),
          legacyDefaults: toTourPowerDefaultRows(
            relevantDefaults.filter(isLegacyPowerDefault),
            tour.id,
          ),
        });

        const aggregation = aggregatePowerCalculations(tables);
        const powerSummary = {
          totalSystemWatts: aggregation.totalWatts, adjustedSystemWatts: aggregation.adjustedWatts,
          totalSystemAmps: aggregation.currentLine, totalSystemKva: aggregation.totalVa === null ? null : aggregation.totalVa / 1000,
          aggregationReason: aggregation.reason,
        };

        const fohSchukoRequired =
          (department === 'sound' || department === 'video') &&
          relevantDefaults.some(
            (item) => isNewFormatTable(item) && Boolean(item.metadata?.foh_schuko),
          );

        const pdfBlob = await exportToPDF(
          getDefaultsPdfTitle(tour.name, department, type, packageLabel),
          tables,
          type,
          tour.name,
          new Date().toLocaleDateString('en-GB'),
          undefined,
          powerSummary,
          undefined,
          logoUrl,
          fohSchukoRequired
        );

        const fileName = getDefaultsPdfFilename(tour.name, department, type, packageLabel);
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Éxito',
          description: 'PDF exportado exitosamente',
        });
        return;
      }

      // Sort defaults by order_index if available, then by created_at
      const sortedDefaults = [...relevantDefaults].sort((a, b) => {
        if (isNewFormatTable(a) && isNewFormatTable(b)) {
          const orderA = a.metadata?.order_index ?? 999;
          const orderB = b.metadata?.order_index ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return 0;
      });

      // Convert defaults to the format expected by exportToPDF
      const tables: PdfTable[] = sortedDefaults.map((defaultItem): PdfTable => {
        // Check if this is new format with table_data
        if (isNewFormatTable(defaultItem) && defaultItem.table_data?.rows) {
          const watts: number | undefined = undefined;
          return {
            name: getTableName(defaultItem),
            rows: getRowsFromJson(defaultItem.table_data),
            totalWeight: defaultItem.total_value,
            totalWatts: undefined,
            totalVa: watts ? computeTotalVa(watts, defaultItem.metadata, department) : undefined,
            currentPerPhase: undefined,
            pduType: undefined,
            customPduType: undefined,
            position: undefined,
            customPosition: undefined,
            includesHoist: undefined,
            dualMotors: defaultItem.metadata?.dualMotors || false,
            riggingPoint: defaultItem.metadata?.riggingPoint,
            toolType: 'pesos' as const,
            id: Date.now() + Math.random()
          };
        } else {
          // Legacy format - create a summary row
          const watts: number | undefined = undefined;
          return {
            name: getTableName(defaultItem),
            rows: [{
              quantity: getLegacyWeightQuantity(defaultItem).toString(),
              componentName: getTableName(defaultItem),
              weight: isLegacyWeightDefault(defaultItem) ? defaultItem.weight_kg?.toString() : undefined,
              watts: undefined,
              totalWeight: getWeightValue(defaultItem),
              totalWatts: watts,
            }],
            totalWeight: getWeightValue(defaultItem),
            totalWatts: watts,
            totalVa: watts ? computeTotalVa(watts, null, department) : undefined,
            currentPerPhase: undefined,
            pduType: undefined,
            customPduType: undefined,
            position: undefined,
            customPosition: undefined,
            includesHoist: undefined,
            toolType: 'pesos' as const,
            id: Date.now() + Math.random()
          };
        }
      });

      const powerSummary: undefined = undefined;

      // Get safety margin from the first default's metadata, fallback to 0
      const safetyMargin = (() => {
        const firstDefault = relevantDefaults[0];
        if (isNewFormatTable(firstDefault) && firstDefault.metadata?.safetyMargin) {
          return firstDefault.metadata.safetyMargin;
        }
        if (isNewFormatTable(firstDefault) && firstDefault.table_data?.safetyMargin) {
          return firstDefault.table_data.safetyMargin;
        }
        return 0;
      })();

      const pdfBlob = await exportToPDF(
        getDefaultsPdfTitle(tour.name, department, type, packageLabel),
        tables,
        type,
        tour.name,
        new Date().toLocaleDateString('en-GB'),
        undefined,
        powerSummary,
        safetyMargin,
        logoUrl
      );

      const fileName = getDefaultsPdfFilename(tour.name, department, type, packageLabel);
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Éxito',
        description: 'PDF exportado exitosamente',
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Error',
        description: 'Error al exportar PDF',
        variant: 'destructive',
      });
    }
  };

  const handleBulkTourDateExport = async (department: string, type: 'power' | 'weight') => {
    try {
      if (tourDates.length === 0) {
        toast({
          title: 'No se encontraron fechas de gira',
          description: 'No hay fechas de gira disponibles para exportar',
          variant: 'destructive',
        });
        return;
      }

      // Fetch tour logo once for all exports
      let logoUrl: string | undefined;
      try {
        logoUrl = await fetchTourLogo(tour.id);
      } catch (error) {
        console.error('Error fetching tour logo:', error);
      }

      // Export one PDF per tour date
      let exportedCount = 0;
      for (const tourDate of tourDates) {
        if (await exportTourDatePDF(tourDate, department, type, logoUrl)) {
          exportedCount += 1;
        }
      }

      toast({
        title: 'Éxito',
        description: `Se exportaron ${exportedCount} PDFs para las fechas de gira`,
      });
    } catch (error) {
      console.error('Error exporting bulk tour date PDFs:', error);
      toast({
        title: 'Error',
        description: 'Error al exportar los PDFs de las fechas de gira',
        variant: 'destructive',
      });
    }
  };

  const exportTourDatePDF = async (
    tourDate: TourDateWithLocation,
    department: string,
    type: 'power' | 'weight',
    logoUrl?: string
  ): Promise<boolean> => {
    let defaultsData: CombinedDefaultType[] = [];
    let packageLabel: string | undefined;

    if (isPackageDepartment(department)) {
      const resolution = resolveDefaultSetForTourDate({
        tourDate,
        department,
        defaultSets,
      });

      if (resolution.status === 'resolved') {
        defaultsData = defaultTables.filter(
          (table) => table.set_id === resolution.set.id && table.table_type === type
        );
        packageLabel = getPackageSetLabel(department, resolution.packageSize, resolution.set);
      } else if (
        resolution.status === 'missing' &&
        !getDepartmentPackageSize(tourDate, department) &&
        defaultSets.filter((set) => set.department === department).length === 0
      ) {
        defaultsData = getDepartmentDefaults(department, type);
      } else {
        const message = getPackageResolutionMessage(resolution);
        toast({
          title: 'No se puede exportar el paquete',
          description: message || 'Selecciona un conjunto de valores por defecto válido para esta fecha.',
          variant: 'destructive',
        });
        return false;
      }
    } else {
      defaultsData = getDepartmentDefaults(department, type);
    }

    // Check for any overrides for this tour date
    const overrideTable = type === 'power' ? 'tour_date_power_overrides' : 'tour_date_weight_overrides';
    const { data: overrides, error: overridesError } = await dataLayerClient.from(overrideTable)
      .select('*')
      .eq('tour_date_id', tourDate.id)
      .eq('department', department);

    if (overridesError) {
      console.error('Error fetching tour date overrides:', overridesError);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las anulaciones de la fecha de gira.',
        variant: 'destructive',
      });
      return false;
    }

    if (type === 'power') {
      const { tables } = buildNormalizedTourPowerTables({
        department: department as 'sound' | 'lights' | 'video',
        overrides: (overrides || []) as TourDatePowerOverrideRow[],
        defaultTables: defaultsData.filter(isNewFormatTable),
        legacyDefaults: toTourPowerDefaultRows(
          defaultsData.filter(isLegacyPowerDefault),
          tour.id,
        ),
      });

      if (tables.length === 0) return false;

      const aggregation = aggregatePowerCalculations(tables);
      const powerSummary = {
        totalSystemWatts: aggregation.totalWatts, adjustedSystemWatts: aggregation.adjustedWatts,
        totalSystemAmps: aggregation.currentLine, totalSystemKva: aggregation.totalVa === null ? null : aggregation.totalVa / 1000,
        aggregationReason: aggregation.reason,
      };

      const locationName = getTourDateLocationName(tourDate);
      const dateStr = tourDate.date;

      const fohSchukoRequired =
        (department === 'sound' || department === 'video') &&
        defaultsData.some(
          (item) => isNewFormatTable(item) && Boolean(item.metadata?.foh_schuko),
        );

      const pdfBlob = await exportToPDF(
        getTourDatePdfTitle(tour.name, locationName, department, type, packageLabel),
        tables,
        type,
        `${tour.name} - ${locationName}`,
        dateStr,
        undefined,
        powerSummary,
        undefined,
        logoUrl,
        fohSchukoRequired
      );

      const fileName = getTourDatePdfFilename(
        tour.name,
        dateStr,
        locationName,
        department,
        type,
        packageLabel
      );
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return true;
    }

    let combinedTables: PdfTable[];
    let safetyMargin = 0;
    const typedWeightOverrides = (overrides || []) as TourDateWeightOverrideRow[];

    // If overrides exist, use overrides, otherwise use defaults
    if (typedWeightOverrides.length > 0) {
      combinedTables = typedWeightOverrides.map((override): PdfTable => {
        return {
          name: override.item_name || 'Anulación',
          rows: getRowsFromJson(override.override_data),
          totalWeight: (override.weight_kg || 0) * (override.quantity || 1),
          totalWatts: undefined,
          totalVa: undefined,
          currentPerPhase: undefined,
          pduType: undefined,
          customPduType: undefined,
          includesHoist: undefined,
          toolType: 'pesos' as const,
          id: Date.now() + Math.random()
        };
      });
      safetyMargin = getSafetyMarginFromJson(typedWeightOverrides[0]?.override_data);
    } else {
      // Sort defaults by order_index if available, then by created_at
      const sortedDefaults = [...defaultsData].sort((a, b) => {
        if (isNewFormatTable(a) && isNewFormatTable(b)) {
          const orderA = a.metadata?.order_index ?? 999;
          const orderB = b.metadata?.order_index ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return 0;
      });

      combinedTables = sortedDefaults.map((defaultItem): PdfTable => {
        // Check if this is new format with table_data
        if (isNewFormatTable(defaultItem) && defaultItem.table_data?.rows) {
          const watts: number | undefined = undefined;
          return {
            name: getTableName(defaultItem),
            rows: getRowsFromJson(defaultItem.table_data),
            totalWeight: defaultItem.total_value,
            totalWatts: watts,
            totalVa: watts ? computeTotalVa(watts, defaultItem.metadata, department) : undefined,
            currentPerPhase: undefined,
            pduType: undefined,
            customPduType: undefined,
            position: undefined,
            customPosition: undefined,
            includesHoist: undefined,
            dualMotors: defaultItem.metadata?.dualMotors || false,
            riggingPoint: defaultItem.metadata?.riggingPoint,
            toolType: 'pesos' as const,
            id: Date.now() + Math.random()
          };
        } else {
          // Legacy format
          const watts: number | undefined = undefined;
          return {
            name: getTableName(defaultItem),
            rows: [{
              quantity: getLegacyWeightQuantity(defaultItem).toString(),
              componentName: getTableName(defaultItem),
              weight: isLegacyWeightDefault(defaultItem) ? defaultItem.weight_kg?.toString() : undefined,
              watts: undefined,
              totalWeight: getWeightValue(defaultItem),
              totalWatts: watts,
            }],
            totalWeight: getWeightValue(defaultItem),
            totalWatts: watts,
            totalVa: watts ? computeTotalVa(watts, null, department) : undefined,
            currentPerPhase: undefined,
            pduType: undefined,
            customPduType: undefined,
            position: undefined,
            customPosition: undefined,
            includesHoist: undefined,
            toolType: 'pesos' as const,
            id: Date.now() + Math.random()
          };
        }
      });
    }

    if (combinedTables.length === 0) return false;

    const powerSummary: undefined = undefined;

    const locationName = getTourDateLocationName(tourDate);
    const dateStr = tourDate.date; // Pass ISO string directly for proper parsing

    const pdfBlob = await exportToPDF(
      getTourDatePdfTitle(tour.name, locationName, department, type, packageLabel),
      combinedTables,
      type,
      `${tour.name} - ${locationName}`, // Include location in jobName for header
      dateStr,
      undefined,
      powerSummary,
      safetyMargin,
      logoUrl
    );

    const fileName = getTourDatePdfFilename(
      tour.name,
      dateStr,
      locationName,
      department,
      type,
      packageLabel
    );
    const url = window.URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
  };

  return {
    exportTourDatePDF,
    handleBulkPDFExport,
    handleBulkTourDateExport,
  };
}
