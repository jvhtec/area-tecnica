
import React, { useState } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Weight, Calculator, Trash2, Download, Calendar, Copy, AlertTriangle, Anchor, Plug, UploadCloud } from "lucide-react";
import { exportToPDF } from "@/utils/pdfExport";
import { fetchTourLogo } from "@/utils/pdf/logoUtils";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { Database } from "@/integrations/supabase/types";
import { useTourPowerDefaults } from "@/hooks/useTourPowerDefaults";
import { useTourWeightDefaults } from "@/hooks/useTourWeightDefaults";
import { useTourDefaultSets, TourDefaultTable } from "@/hooks/useTourDefaultSets";
import { buildNormalizedTourPowerTables, computePowerTotalVa } from "@/utils/tourPowerTables";
import { getDepartmentLabel } from "@/types/department";
import type { TechnicalPowerDepartment } from "@/utils/technicalPowerTypes";
import { getResolvedPowerPosition } from "@/utils/powerPositions";
import { syncTourDefaultDocuments } from "@/utils/tourDefaultDocumentSync";
import {
  DEPARTMENT_PACKAGE_LABELS,
  TOUR_PACKAGE_LABELS,
  TOUR_PACKAGE_SIZES,
  getDepartmentPackageSize,
  getPackageBadgeLabel,
  getPackageResolutionMessage,
  getPackageSetLabel,
  isPackageDepartment,
  resolveDefaultSetForTourDate,
  type PackageDepartment,
  type TourPackageSize,
} from "@/utils/tourPackages";

interface TourDefaultsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: any;
}

const UNKNOWN_LOCATION_LABEL = 'Ubicación desconocida';

type TourDatePowerOverrideRow =
  Database['public']['Tables']['tour_date_power_overrides']['Row'];
type TourDateWeightOverrideRow =
  Database['public']['Tables']['tour_date_weight_overrides']['Row'];
type TourPowerDefaultRow =
  Database['public']['Tables']['tour_power_defaults']['Row'];

interface TourDateWithLocation {
  id: string;
  date: string;
  tour_id?: string | null;
  is_tour_pack_only?: boolean | null;
  sound_package_size?: TourPackageSize | null;
  lights_package_size?: TourPackageSize | null;
  video_package_size?: TourPackageSize | null;
  sound_default_set_id?: string | null;
  lights_default_set_id?: string | null;
  video_default_set_id?: string | null;
  locations?: { name: string | null } | Array<{ name: string | null }> | null;
}

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
  phaseMode?: 'single' | 'three';
  toolType?: 'pesos' | 'consumos' | 'rigging';
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
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getRowsFromJson = (value: unknown): PdfTableRow[] => {
  if (!isRecord(value) || !Array.isArray(value.rows)) return [];
  return value.rows.filter(isRecord).map((row) => row as PdfTableRow);
};

const getSafetyMarginFromJson = (value: unknown): number => {
  if (!isRecord(value)) return 0;
  const safetyMargin = value.safetyMargin;
  return typeof safetyMargin === 'number' && Number.isFinite(safetyMargin) ? safetyMargin : 0;
};

const getTourDateLocationName = (tourDate: TourDateWithLocation): string => {
  const location = Array.isArray(tourDate.locations)
    ? tourDate.locations[0]
    : tourDate.locations;
  return location?.name || UNKNOWN_LOCATION_LABEL;
};

const isTechnicalPowerDepartment = (
  department: string
): department is TechnicalPowerDepartment =>
  department === 'sound' || department === 'lights' || department === 'video';

const computeTotalVa = (watts: number, metadata: unknown, department?: string): number => {
  if (!department || !isTechnicalPowerDepartment(department)) {
    return watts;
  }

  return computePowerTotalVa(watts, metadata, department);
};

const getPdfTypeLabel = (type: 'power' | 'weight') =>
  type === 'power' ? 'potencia' : 'peso';

const getDefaultsPdfTitle = (
  tourName: string,
  department: string,
  type: 'power' | 'weight',
  packageLabel?: string
) => `${tourName} - ${packageLabel || getDepartmentLabel(department)} ${getPdfTypeLabel(type)} predeterminados`;

const getDefaultsPdfFilename = (
  tourName: string,
  department: string,
  type: 'power' | 'weight',
  packageLabel?: string
) => `${tourName} - ${packageLabel || getDepartmentLabel(department)} ${getPdfTypeLabel(type)} predeterminados.pdf`;

const getTourDatePdfTitle = (
  tourName: string,
  locationName: string,
  department: string,
  type: 'power' | 'weight',
  packageLabel?: string
) => `${tourName} - ${locationName} - ${packageLabel || getDepartmentLabel(department)} ${getPdfTypeLabel(type)}`;

const getTourDatePdfFilename = (
  tourName: string,
  dateStr: string,
  locationName: string,
  department: string,
  type: 'power' | 'weight',
  packageLabel?: string
) => `${tourName} - ${dateStr} - ${locationName} - ${packageLabel || getDepartmentLabel(department)} ${getPdfTypeLabel(type)}.pdf`;

// Legacy types for backward compatibility
interface TourPowerDefault {
  id: string;
  tour_id?: string;
  table_name?: string;
  item_name?: string;
  total_watts: number;
  current_per_phase?: number;
  pdu_type?: string;
  custom_pdu_type?: string;
  position?: string | null;
  custom_position?: string | null;
  includes_hoist?: boolean;
  department?: string;
  created_at?: string | null;
}

interface TourWeightDefault {
  id: string;
  table_name?: string;
  item_name?: string;
  weight_kg: number;
  quantity?: number;
  department?: string;
}

type CombinedDefaultType = TourDefaultTable | TourPowerDefault | TourWeightDefault;

export const TourDefaultsManager = ({
  open,
  onOpenChange,
  tour,
}: TourDefaultsManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('sound');
  const [tourDates, setTourDates] = useState<TourDateWithLocation[]>([]);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [newSetPackageSize, setNewSetPackageSize] = useState<TourPackageSize | null>(null);
  const [isSyncingDefaultDocs, setIsSyncingDefaultDocs] = useState(false);
  const defaultDocumentSyncQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  // Track the power default flag currently being toggled so only the affected
  // row/set is disabled (the shared mutation flag would otherwise freeze every
  // card).
  const [pendingFlagTableId, setPendingFlagTableId] = useState<string | null>(null);

  // Use the new tour default sets hook
  const {
    defaultSets,
    defaultTables,
    isLoading: defaultSetsLoading,
    createSet,
    updateSet,
    duplicateSet,
    deleteSet,
    deleteTable,
    isCreatingSet,
    isUpdatingSet,
    isDuplicatingSet,
    isDeletingSet,
    isDeletingTable
  } = useTourDefaultSets(tour?.id || '');

  // Keep the old hooks for backward compatibility but prioritize new system
  const {
    powerDefaults: legacyPowerDefaults,
    isLoading: soundPowerLoading,
    deleteDefault: deleteSoundPowerDefault
  } = useTourPowerDefaults(tour?.id || '');

  const {
    weightDefaults: legacyWeightDefaults,
    isLoading: soundWeightLoading,
    deleteDefault: deleteSoundWeightDefault
  } = useTourWeightDefaults(tour?.id || '');

  // Fetch tour dates
  React.useEffect(() => {
    const fetchTourDates = async () => {
      if (!tour?.id) return;
      
      const { data, error } = await dataLayerClient.from('tour_dates')
        .select(`
          id,
          date,
          tour_id,
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
        `)
        .eq('tour_id', tour.id)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching tour dates:', error);
        return;
      }

      setTourDates((data || []) as TourDateWithLocation[]);
    };

    fetchTourDates();
  }, [tour?.id]);

  // Type guards to check data format
  const isNewFormatTable = (item: CombinedDefaultType): item is TourDefaultTable => {
    return 'set_id' in item || 'table_data' in item;
  };

  const isLegacyPowerDefault = (item: CombinedDefaultType): item is TourPowerDefault => {
    return 'total_watts' in item && !('set_id' in item);
  };

  const isLegacyWeightDefault = (item: CombinedDefaultType): item is TourWeightDefault => {
    return 'weight_kg' in item && !('set_id' in item);
  };

  const toTourPowerDefaultRows = (items: TourPowerDefault[]): TourPowerDefaultRow[] =>
    items.map((item): TourPowerDefaultRow => ({
      id: item.id,
      tour_id: item.tour_id ?? tour?.id ?? '',
      table_name: item.table_name || item.item_name || 'Unnamed',
      total_watts: item.total_watts || 0,
      current_per_phase: item.current_per_phase || 0,
      pdu_type: item.pdu_type || '',
      custom_pdu_type: item.custom_pdu_type ?? null,
      custom_position: item.custom_position ?? null,
      position: item.position ?? null,
      includes_hoist: item.includes_hoist ?? false,
      department: item.department ?? null,
      created_at: item.created_at ?? null,
      updated_at: null,
    }));

  // Get defaults by department - prioritize new system, fallback to legacy
  const getDepartmentDefaults = (department: string, type: 'power' | 'weight'): CombinedDefaultType[] => {
    // First check if we have new format defaults
    const departmentSets = defaultSets.filter(set => set.department === department);
    const departmentTables = defaultTables.filter(table => 
      departmentSets.some(set => set.id === table.set_id) && table.table_type === type
    );

    if (departmentTables.length > 0) {
      return departmentTables;
    }

    // Fallback to legacy system
    if (type === 'power') {
      return legacyPowerDefaults.filter(d => d.department === department || (!d.department && department === 'sound'));
    } else {
      return legacyWeightDefaults.filter(d => d.department === department || (!d.department && department === 'sound'));
    }
  };

  const invalidateTourDocumentQueries = async () => {
    if (!tour?.id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents', tour.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('jobcard-tour-documents') }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents-for-job') }),
    ]);
  };

  const syncDefaultDocuments = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!tour?.id) return;

    const runSync = async () => {
      setIsSyncingDefaultDocs(true);
      try {
        const result = await syncTourDefaultDocuments({ tourId: tour.id });
        await invalidateTourDocumentQueries();

        if (result.errors.length > 0) {
          toast({
            title: 'PDFs sincronizados con avisos',
            description: `${result.errors.length} documento(s) no se pudieron refrescar.`,
            variant: 'destructive',
          });
        } else if (!silent) {
          toast({
            title: 'PDFs sincronizados',
            description: `${result.uploaded} documento(s) actualizados y ${result.removed} ruta(s) limpiadas.`,
          });
        }
      } catch (error) {
        console.error('Error syncing tour default documents:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron sincronizar los PDFs automáticos de fechas.',
          variant: 'destructive',
        });
      } finally {
        setIsSyncingDefaultDocs(false);
      }
    };

    const queuedSync = defaultDocumentSyncQueueRef.current.then(runSync, runSync);
    defaultDocumentSyncQueueRef.current = queuedSync.catch((): void => undefined);
    await queuedSync;
  };

  const updateSetAndSync = async ({
    setId,
    updates,
  }: Parameters<typeof updateSet>[0]) => {
    await updateSet({ setId, updates });
    await syncDefaultDocuments({ silent: true });
  };

  // Handle deletion based on format type
  const handleDeleteTable = async (table: CombinedDefaultType, type: 'power' | 'weight') => {
    try {
      // Check if this is new format (has table_data or set_id)
      if (isNewFormatTable(table)) {
        // New format - use deleteTable from useTourDefaultSets
        await deleteTable(table.id);
        await syncDefaultDocuments({ silent: true });
      } else {
        // Legacy format - use the old delete functions
        if (type === 'power' && isLegacyPowerDefault(table)) {
          await deleteSoundPowerDefault(table.id);
        } else if (type === 'weight' && isLegacyWeightDefault(table)) {
          await deleteSoundWeightDefault(table.id);
        }
      }
    } catch (error) {
      console.error('Error deleting table:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar la tabla',
        variant: 'destructive',
      });
    }
  };

  // Toggle a boolean flag (hoist / FOH schuko) on an already-saved power
  // default. These were previously only settable when the table was first
  // created in the Consumos tool, so a forgotten value could not be corrected.
  // Persisted directly (no per-toggle success toast) — the checkbox is the
  // feedback; only failures surface a toast.
  const handleTogglePowerFlag = async (
    table: TourDefaultTable,
    key: 'includes_hoist' | 'foh_schuko',
    value: boolean,
  ) => {
    const pendingKey = key === 'foh_schuko' ? `${key}:${table.set_id}` : table.id;
    setPendingFlagTableId(pendingKey);
    try {
      const tablesToUpdate =
        key === 'foh_schuko'
          ? defaultTables.filter(
              (candidate) =>
                candidate.set_id === table.set_id && candidate.table_type === 'power'
            )
          : [table];

      const results = await Promise.all(
        tablesToUpdate.map((candidate) =>
          dataLayerClient
            .from('tour_default_tables')
            .update({ metadata: { ...(candidate.metadata || {}), [key]: value } })
            .eq('id', candidate.id)
        )
      );
      const failedResult = results.find((result) => result.error);
      if (failedResult?.error) throw failedResult.error;

      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope('tour-default-tables', tour?.id || ''),
      });
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error updating power default flag:', error);
      toast({
        title: 'Error',
        description: 'Error al actualizar la tabla',
        variant: 'destructive',
      });
    } finally {
      setPendingFlagTableId(null);
    }
  };

  // Handle set deletion
  const handleDeleteSet = async (setId: string) => {
    try {
      await deleteSet(setId);
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error deleting set:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar el conjunto',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSet = async (department: string) => {
    if (!tour?.id || !isPackageDepartment(department)) return;
    const trimmedName = newSetName.trim();
    if (!trimmedName) {
      toast({
        title: 'Nombre requerido',
        description: 'Introduce un nombre para el conjunto.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createSet({
        tour_id: tour.id,
        name: trimmedName,
        description: newSetDescription.trim() || null,
        department,
        package_size: newSetPackageSize,
      });
      setNewSetName('');
      setNewSetDescription('');
      setNewSetPackageSize(null);
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error creating set:', error);
    }
  };

  const handleDuplicateSet = async (setId: string) => {
    const sourceSet = defaultSets.find((set) => set.id === setId);
    if (!sourceSet) return;

    try {
      await duplicateSet({
        setId,
        name: `${sourceSet.name} Copy`,
        description: sourceSet.description,
        package_size: sourceSet.package_size,
      });
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error duplicating set:', error);
    }
  };

  const updateSetPackageSize = async (setId: string, value: string) => {
    await updateSetAndSync({
      setId,
      updates: {
        package_size: value === 'unassigned' ? null : (value as TourPackageSize),
      },
    });
  };

  const getDuplicatePackageWarnings = (department: string) => {
    if (!isPackageDepartment(department)) return [];
    return TOUR_PACKAGE_SIZES.flatMap((packageSize) => {
      const matches = defaultSets.filter(
        (set) => set.department === department && set.package_size === packageSize
      );
      if (matches.length <= 1) return [];
      return [{
        packageSize,
        message: `Multiple ${DEPARTMENT_PACKAGE_LABELS[department]} ${TOUR_PACKAGE_LABELS[packageSize]} default sets exist. Date/package auto-resolution will be ambiguous unless a specific set is selected.`,
      }];
    });
  };

  const renderSetMetadata = (set: typeof defaultSets[number]) => {
    const packageSize = set.package_size || null;
    return (
      <div className="space-y-2 min-w-[220px]">
        <Input
          defaultValue={set.name}
          aria-label={`${set.name} set name`}
          onBlur={(event) => {
            const nextName = event.target.value.trim();
            if (nextName && nextName !== set.name) {
              void updateSetAndSync({ setId: set.id, updates: { name: nextName } });
            }
          }}
        />
        <Input
          defaultValue={set.description || ''}
          aria-label={`${set.name} set description`}
          placeholder="Description"
          onBlur={(event) => {
            const nextDescription = event.target.value.trim() || null;
            if (nextDescription !== (set.description || null)) {
              void updateSetAndSync({ setId: set.id, updates: { description: nextDescription } });
            }
          }}
        />
        <Select
          value={packageSize || 'unassigned'}
          onValueChange={(value) => void updateSetPackageSize(set.id, value)}
        >
          <SelectTrigger aria-label={`${set.name} package size`}>
            <SelectValue placeholder="Package size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {TOUR_PACKAGE_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {TOUR_PACKAGE_LABELS[size]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPackageDepartment(set.department) && packageSize && (
          <Badge variant="outline">
            {getPackageBadgeLabel({ department: set.department, packageSize })}
          </Badge>
        )}
      </div>
    );
  };

  // Helper function to get table name based on format
  const getTableName = (table: CombinedDefaultType): string => {
    if (isNewFormatTable(table)) {
      return table.table_name || 'Unnamed';
    }
    if (isLegacyPowerDefault(table)) {
      return table.table_name || table.item_name || 'Unnamed';
    }
    if (isLegacyWeightDefault(table)) {
      return table.table_name || table.item_name || 'Unnamed';
    }
    return 'Unnamed';
  };

  // Helper function to get power value based on format
  const getPowerValue = (table: CombinedDefaultType): number => {
    if (isNewFormatTable(table)) {
      return table.total_value || 0;
    }
    if (isLegacyPowerDefault(table)) {
      return table.total_watts || 0;
    }
    return 0;
  };

  // Helper function to get weight value based on format
  const getWeightValue = (table: CombinedDefaultType): number => {
    if (isNewFormatTable(table)) {
      return table.total_value || 0;
    }
    if (isLegacyWeightDefault(table)) {
      return ((table.weight_kg || 0) * (table.quantity || 1));
    }
    return 0;
  };

  const getLegacyWeightQuantity = (table: CombinedDefaultType): number => {
    if (isLegacyWeightDefault(table)) {
      return table.quantity || 1;
    }
    return 1;
  };

  // Helper function to get current per phase based on format
  const getCurrentPerPhase = (table: CombinedDefaultType): number | undefined => {
    if (isNewFormatTable(table)) {
      return table.metadata?.current_per_phase;
    }
    if (isLegacyPowerDefault(table)) {
      return table.current_per_phase;
    }
    return undefined;
  };

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
        const { tables, safetyMargin } = buildNormalizedTourPowerTables({
          department: department as 'sound' | 'lights' | 'video',
          defaultTables: relevantDefaults.filter(isNewFormatTable),
          legacyDefaults: toTourPowerDefaultRows(relevantDefaults.filter(isLegacyPowerDefault)),
        });

        const powerSummary = {
          totalSystemWatts: tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0),
          totalSystemAmps: tables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0),
          totalSystemKva:
            tables.reduce((sum, table) => sum + (table.totalVa || table.totalWatts || 0), 0) /
            1000,
        };

        const fohSchukoRequired =
          (department === 'sound' || department === 'lights') &&
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
          safetyMargin,
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
      const { tables, safetyMargin } = buildNormalizedTourPowerTables({
        department: department as 'sound' | 'lights' | 'video',
        overrides: (overrides || []) as TourDatePowerOverrideRow[],
        defaultTables: defaultsData.filter(isNewFormatTable),
        legacyDefaults: toTourPowerDefaultRows(defaultsData.filter(isLegacyPowerDefault)),
      });

      if (tables.length === 0) return false;

      const powerSummary = {
        totalSystemWatts: tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0),
        totalSystemAmps: tables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0),
        totalSystemKva:
          tables.reduce((sum, table) => sum + (table.totalVa || table.totalWatts || 0), 0) /
          1000,
      };

      const locationName = getTourDateLocationName(tourDate);
      const dateStr = tourDate.date;

      const fohSchukoRequired =
        (department === 'sound' || department === 'lights') &&
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
        safetyMargin,
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

  const renderDepartmentDefaults = (department: string) => {
    const powerTables = getDepartmentDefaults(department, 'power');
    const weightTables = getDepartmentDefaults(department, 'weight');
    const duplicateWarnings = getDuplicatePackageWarnings(department);
    // FOH schuko power only applies to sound & lights (matches the Consumos tool).
    const fohSupported = department === 'sound' || department === 'lights';

    // Group new format tables by sets
    const departmentSets = defaultSets.filter(set => set.department === department);
    const powerSets = departmentSets;
    const weightSets = departmentSets;

    return (
      <div className="space-y-6">
        {isPackageDepartment(department) && (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold">Crear conjunto de paquete</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor={`${department}-new-set-name`}>Nombre</Label>
                <Input
                  id={`${department}-new-set-name`}
                  value={newSetName}
                  onChange={(event) => setNewSetName(event.target.value)}
                  placeholder={`${DEPARTMENT_PACKAGE_LABELS[department]} package`}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor={`${department}-new-set-description`}>Descripción</Label>
                <Input
                  id={`${department}-new-set-description`}
                  value={newSetDescription}
                  onChange={(event) => setNewSetDescription(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Package size</Label>
                <Select
                  value={newSetPackageSize || 'unassigned'}
                  onValueChange={(value) =>
                    setNewSetPackageSize(value === 'unassigned' ? null : (value as TourPackageSize))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Package size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {TOUR_PACKAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {TOUR_PACKAGE_LABELS[size]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => handleCreateSet(department)}
                  disabled={isCreatingSet}
                  className="w-full"
                >
                  Crear conjunto
                </Button>
              </div>
            </div>
          </div>
        )}

        {duplicateWarnings.map((warning) => (
          <div
            key={warning.packageSize}
            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{warning.message}</span>
          </div>
        ))}

        {/* Power Defaults */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Valores por Defecto de Potencia ({powerTables.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkPDFExport(department, 'power')}
                disabled={powerTables.length === 0}
              >
                <FileText className="h-4 w-4 mr-1" />
                Exportar PDF de Valores
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkTourDateExport(department, 'power')}
                disabled={powerTables.length === 0 || tourDates.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                PDFs Masivos de Fechas
              </Button>
            </div>
          </div>

          {/* New Format Sets */}
          {powerSets.map((set) => {
            const setTables = defaultTables.filter(table => 
              table.set_id === set.id && table.table_type === 'power'
            );
            
            return (
              <div key={set.id} className="mb-6 border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  {renderSetMetadata(set)}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleBulkPDFExport(department, 'power', {
                          setId: set.id,
                          packageLabel: isPackageDepartment(department)
                            ? getPackageSetLabel(department, set.package_size || null, set)
                            : set.name,
                        })
                      }
                      disabled={setTables.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateSet(set.id)}
                      disabled={isDuplicatingSet}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSet(set.id)}
                      disabled={isDeletingSet || isUpdatingSet}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground mb-3">
                  {setTables.length} tabla{setTables.length === 1 ? '' : 's'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {setTables.map((table) => {
                    const position = getResolvedPowerPosition(
                      table.metadata?.position,
                      table.metadata?.custom_position,
                    );
                    const rowPending =
                      pendingFlagTableId === table.id ||
                      pendingFlagTableId === `foh_schuko:${table.set_id}`;
                    return (
                    <div key={table.id} className="border rounded-lg p-4 bg-card transition-colors hover:border-primary/40">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="min-w-0">
                          <h6 className="font-medium leading-tight">{table.table_name}</h6>
                          {(table.metadata?.includes_hoist || table.metadata?.foh_schuko) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {table.metadata?.includes_hoist && (
                                <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5 border-amber-300 text-amber-700">
                                  <Anchor className="h-2.5 w-2.5" />
                                  Hoist
                                </Badge>
                              )}
                              {table.metadata?.foh_schuko && (
                                <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5 border-sky-300 text-sky-700">
                                  <Plug className="h-2.5 w-2.5" />
                                  FOH
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTable(table, 'power')}
                          disabled={isDeletingTable}
                          className="text-destructive hover:text-destructive shrink-0 -mt-1 -mr-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="font-mono">
                          {table.total_value.toFixed(2)} W
                        </Badge>
                        {table.metadata?.current_per_phase && (
                          <Badge variant="secondary" className="font-mono">
                            {table.metadata.current_per_phase.toFixed(2)} A/fase
                          </Badge>
                        )}
                        {position && <Badge variant="outline">{position}</Badge>}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`hoist-${table.id}`}
                            checked={Boolean(table.metadata?.includes_hoist)}
                            disabled={rowPending}
                            onCheckedChange={(checked) =>
                              void handleTogglePowerFlag(table, 'includes_hoist', !!checked)
                            }
                          />
                          <Label
                            htmlFor={`hoist-${table.id}`}
                            className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                          >
                            <Anchor className="h-3 w-3 text-muted-foreground" />
                            Incluye hoist/rigging
                          </Label>
                        </div>
                        {fohSupported && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`foh-${table.id}`}
                              checked={Boolean(table.metadata?.foh_schuko)}
                              disabled={rowPending}
                              onCheckedChange={(checked) =>
                                void handleTogglePowerFlag(table, 'foh_schuko', !!checked)
                              }
                            />
                            <Label
                              htmlFor={`foh-${table.id}`}
                              className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                              title="Se requiere potencia de 16A en formato schuko hembra en posición FoH"
                            >
                              <Plug className="h-3 w-3 text-muted-foreground" />
                              FOH (schuko 16A)
                            </Label>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legacy Format Tables */}
          {powerTables.filter(table => !isNewFormatTable(table)).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {powerTables.filter(table => !isNewFormatTable(table)).map((table) => (
                <div key={table.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium">{getTableName(table)}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTable(table, 'power')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getPowerValue(table).toFixed(2)} W
                  </p>
                  {getCurrentPerPhase(table) && (
                    <p className="text-xs text-muted-foreground">
                      {getCurrentPerPhase(table)!.toFixed(2)} A por fase
                    </p>
                  )}
                  {isLegacyPowerDefault(table) &&
                    getResolvedPowerPosition(table.position, table.custom_position) && (
                      <p className="text-xs text-muted-foreground">
                        Posición: {getResolvedPowerPosition(table.position, table.custom_position)}
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}

          {powerTables.length === 0 && (
            <p className="text-muted-foreground">No hay valores por defecto de potencia configurados</p>
          )}
        </div>

        {/* Weight Defaults */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Weight className="h-5 w-5" />
              Valores por Defecto de Peso ({weightTables.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkPDFExport(department, 'weight')}
                disabled={weightTables.length === 0}
              >
                <FileText className="h-4 w-4 mr-1" />
                Exportar PDF de Valores
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkTourDateExport(department, 'weight')}
                disabled={weightTables.length === 0 || tourDates.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                PDFs Masivos de Fechas
              </Button>
            </div>
          </div>

          {/* New Format Sets */}
          {weightSets.map((set) => {
            const setTables = defaultTables.filter(table => 
              table.set_id === set.id && table.table_type === 'weight'
            );
            
            return (
              <div key={set.id} className="mb-6 border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  {renderSetMetadata(set)}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleBulkPDFExport(department, 'weight', {
                          setId: set.id,
                          packageLabel: isPackageDepartment(department)
                            ? getPackageSetLabel(department, set.package_size || null, set)
                            : set.name,
                        })
                      }
                      disabled={setTables.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateSet(set.id)}
                      disabled={isDuplicatingSet}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSet(set.id)}
                      disabled={isDeletingSet || isUpdatingSet}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground mb-3">
                  {setTables.length} tabla{setTables.length === 1 ? '' : 's'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {setTables.map((table) => (
                    <div key={table.id} className="border rounded-lg p-4 bg-card transition-colors hover:border-primary/40">
                      <div className="flex justify-between items-start mb-2">
                        <h6 className="font-medium">{table.table_name}</h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTable(table, 'weight')}
                          disabled={isDeletingTable}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {table.total_value.toFixed(2)} kg
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Legacy Format Tables */}
          {weightTables.filter(table => !isNewFormatTable(table)).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weightTables.filter(table => !isNewFormatTable(table)).map((table) => (
                <div key={table.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium">{getTableName(table)}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTable(table, 'weight')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getWeightValue(table).toFixed(2)} kg
                  </p>
                  {isLegacyWeightDefault(table) && table.quantity && table.weight_kg && (
                    <p className="text-xs text-muted-foreground">
                      {table.quantity} × {table.weight_kg.toFixed(2)} kg
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {weightTables.length === 0 && (
            <p className="text-muted-foreground">No hay valores por defecto de peso configurados</p>
          )}
        </div>
      </div>
    );
  };

  const renderTourDatesTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fechas de Gira ({tourDates.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncDefaultDocuments()}
              disabled={tourDates.length === 0 || isSyncingDefaultDocs}
            >
              <UploadCloud className="h-4 w-4 mr-1" />
              {isSyncingDefaultDocs ? 'Sincronizando...' : 'Sincronizar PDFs'}
            </Button>
          </div>
          <p className="text-sm text-green-700 mb-4">
            Exporta PDFs individuales para cada fecha de gira, incluyendo valores por defecto y anulaciones. Los PDFs automáticos se suben a documentos de gira y se reemplazan cuando cambian paquetes o valores por defecto.
          </p>
        </div>

        {tourDates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {tourDates.map((tourDate) => (
              <div key={tourDate.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">
                      {new Date(tourDate.date).toLocaleDateString('en-GB')}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {getTourDateLocationName(tourDate)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(['sound', 'lights', 'video'] as PackageDepartment[]).map((department) => {
                        const packageSize = getDepartmentPackageSize(tourDate, department);
                        if (!packageSize) return null;
                        const resolution = resolveDefaultSetForTourDate({
                          tourDate,
                          department,
                          defaultSets,
                        });
                        return (
                          <Badge key={department} variant="outline" className="gap-1">
                            {getPackageBadgeLabel({ department, packageSize })}
                            {resolution.status !== 'resolved' && (
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['sound', 'lights', 'video'].map((dept) => (
                    <div key={dept} className="space-y-2">
                      <h5 className="text-sm font-medium capitalize">{dept}</h5>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportTourDatePDF(tourDate, dept, 'power')}
                          className="text-xs"
                        >
                          PDF de Potencia
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportTourDatePDF(tourDate, dept, 'weight')}
                          className="text-xs"
                        >
                          PDF de Peso
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No hay fechas de gira configuradas</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] md:w-full max-h-[calc(95vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg truncate">Valores por Defecto de Gira: {tour?.name}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:h-10 sm:grid-cols-4 sm:gap-0">
            <TabsTrigger value="sound">Sonido</TabsTrigger>
            <TabsTrigger value="lights">Luces</TabsTrigger>
            <TabsTrigger value="video">Vídeo</TabsTrigger>
            <TabsTrigger value="tour-dates">Fechas de Gira</TabsTrigger>
          </TabsList>

          <TabsContent value="sound" className="mt-6">
            {defaultSetsLoading || soundPowerLoading || soundWeightLoading ? (
              <p>Cargando valores por defecto de sonido...</p>
            ) : (
              renderDepartmentDefaults('sound')
            )}
          </TabsContent>

          <TabsContent value="lights" className="mt-6">
            {defaultSetsLoading || soundPowerLoading || soundWeightLoading ? (
              <p>Cargando valores por defecto de luces...</p>
            ) : (
              renderDepartmentDefaults('lights')
            )}
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            {defaultSetsLoading || soundPowerLoading || soundWeightLoading ? (
              <p>Cargando valores por defecto de vídeo...</p>
            ) : (
              renderDepartmentDefaults('video')
            )}
          </TabsContent>

          <TabsContent value="tour-dates" className="mt-6">
            {renderTourDatesTab()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
