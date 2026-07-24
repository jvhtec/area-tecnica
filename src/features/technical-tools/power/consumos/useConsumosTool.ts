import {
  type ConsumosJob
} from "@/features/technical-tools/power/consumos/consumosUtils";
import type {
  PowerTable
} from "@/features/technical-tools/power/types";
import {
  useSelectedTechnicalStage
} from "@/features/technical-tools/stage/stageAllocation";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import {
  cloneTablesToStage,
  cloneTableToStage,
  toPresetSnapshot,
} from "@/features/technical-tools/table-presets/stageCopy";
import {
  useQuickPresets,
  type QuickPreset,
} from "@/features/technical-tools/table-presets/useQuickPresets";
import { useToast } from "@/hooks/use-toast";
import { useJobSelection } from "@/hooks/useJobSelection";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useTourDateOverrides } from "@/hooks/useTourDateOverrides";
import { useTourDefaultSets } from "@/hooks/useTourDefaultSets";
import { useTourOverrideMode } from "@/hooks/useTourOverrideMode";
import { useTourPowerDefaults } from "@/hooks/useTourPowerDefaults";
import { optimizedInvalidation, queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { syncTourDefaultDocuments, toastTourDefaultDocumentNoUpdate } from "@/utils/tourDefaultDocumentSync";
import type { TourPackageSize } from "@/utils/tourPackages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  type ConsumosDepartmentConfig,
} from "./config";
import { useConsumosBuilder } from "./useConsumosBuilder";
import { useConsumosComponents } from "./useConsumosComponents";
import { useConsumosTourData } from "./useConsumosTourData";
import {
  useCustomPowerComponents
} from "./useCustomPowerComponents";

export const useConsumosTool = (config: ConsumosDepartmentConfig) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useOptimizedAuth();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  const { department, features, labels } = config;
  const perRowPf = features.perRowPf;
  // Catalog now lives in the consumos_components table; components stored in
  // localStorage by the previous implementation are still merged in (read
  // only) so nothing a user added locally disappears.
  const { catalogComponents, createComponent } = useConsumosComponents(config);
  const { customComponents: legacyLocalComponents } =
    useCustomPowerComponents(department, user?.id);
  const {
    presets: quickPresets,
    savePreset,
    isSavingPreset,
    deletePreset,
  } = useQuickPresets<PowerTable>("consumos", department);
  const components = useMemo(() => {
    const catalogNames = new Set(
      catalogComponents.map((component) => component.name.trim().toLowerCase()),
    );
    const legacyExtras = legacyLocalComponents.filter(
      (component) => !catalogNames.has(component.name.trim().toLowerCase()),
    );
    return [...catalogComponents, ...legacyExtras];
  }, [catalogComponents, legacyLocalComponents]);

  const jobIdFromUrl = searchParams.get("jobId");
  const tourIdParam = searchParams.get("tourId");
  const tourDateIdParam = searchParams.get("tourDateId");
  const mode = searchParams.get("mode");
  const isTourDefaults =
    Boolean(tourIdParam) && (mode === "tour-defaults" || mode === "defaults");

  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<ConsumosJob | null>(null);

  // Override mode can be reached two ways: via tour management URLs
  // (tourId + tourDateId) or by opening a job that belongs to a tour date.
  const isUrlOverrideMode = Boolean(tourIdParam && tourDateIdParam) && !isTourDefaults;
  const jobOverrideTourDateId: string | null = selectedJob?.tour_date_id ?? null;
  const isOverrideMode = isUrlOverrideMode || Boolean(jobOverrideTourDateId);
  const overrideTourDateId = tourDateIdParam || jobOverrideTourDateId || "";
  const isNormalMode = !isTourDefaults && !isOverrideMode;

  const {
    overrideData,
    isLoading: overrideLoading,
  } = useTourOverrideMode(
    isUrlOverrideMode ? tourIdParam || undefined : undefined,
    isUrlOverrideMode ? tourDateIdParam || undefined : undefined,
    department,
  );

  const {
    powerOverrides = [],
    createPowerOverride,
    updatePowerOverride,
    deleteOverride,
    isCreatingOverride,
  } = useTourDateOverrides(overrideTourDateId, "power");

  const {
    defaultSets,
    defaultTables,
    createSet,
    createTable: createTourDefaultTable,
    updateTable: updateTourDefaultTable,
    deleteTable: deleteTourDefaultTable,
    copyTablesToSet: copyTourDefaultTablesToSet,
  } = useTourDefaultSets(tourIdParam || "", department);

  const { powerDefaults: legacyTourDefaults = [] } = useTourPowerDefaults(
    features.legacyTourDefaultsFallback ? tourIdParam || "" : "",
  );

  const [selectedDefaultSetId, setSelectedDefaultSetId] = useState<string>("");
  const [selectedDefaultPackageSize, setSelectedDefaultPackageSize] = useState<TourPackageSize | "unassigned">("unassigned");
  const [newDefaultSetName, setNewDefaultSetName] = useState("");
  const [isCreatingDefaultSet, setIsCreatingDefaultSet] = useState(false);
  const [copySourceSetId, setCopySourceSetIdInternal] = useState<string>("");
  const [selectedCopyTableIds, setSelectedCopyTableIds] = useState<string[]>([]);
  const selectedDefaultSet =
    defaultSets.find((set) => set.id === selectedDefaultSetId) || null;
  const selectedCopySourceSet =
    defaultSets.find((set) => set.id === copySourceSetId) || null;

  const setCopySourceSetId = useCallback((setId: string) => {
    setCopySourceSetIdInternal(setId);
    setSelectedCopyTableIds([]);
  }, []);

  const selectDefaultSetId = useCallback(
    (setId: string) => {
      if (!setId && selectedDefaultSetId) {
        setCopySourceSetIdInternal((current) => current || selectedDefaultSetId);
      }
      setIsCreatingDefaultSet(!setId);
      setSelectedDefaultSetId(setId);
      const set = defaultSets.find((candidate) => candidate.id === setId);
      if (set) {
        setSelectedDefaultPackageSize(set.package_size || "unassigned");
      }
    },
    [defaultSets, selectedDefaultSetId],
  );

  const syncDefaultDocumentsAfterMutation = useCallback(async () => {
    if (!isTourDefaults || !tourIdParam) return;
    try {
      const result = await syncTourDefaultDocuments({ tourId: tourIdParam });
      optimizedInvalidation.invalidateQueryKeys(queryClient, [
        queryKeys.scope("tour-documents", tourIdParam),
        queryKeys.scope("jobcard-tour-documents"),
        queryKeys.scope("tour-documents-for-job"),
      ]);

      if (result.errors.length > 0) {
        toast({
          title: labels.toastError,
          description: `${result.errors.length} documento(s) predeterminados no se pudieron actualizar.`,
          variant: "destructive",
        });
      } else { toastTourDefaultDocumentNoUpdate(result, toast); }
    } catch (error) {
      console.error("Error syncing tour default documents:", error);
      toast({
        title: labels.toastError,
        description: "No se pudieron actualizar los PDF predeterminados del paquete.",
        variant: "destructive",
      });
    }
  }, [isTourDefaults, tourIdParam, queryClient, toast, labels.toastError]);

  useEffect(() => {
    if (
      !isTourDefaults ||
      selectedDefaultSetId ||
      isCreatingDefaultSet ||
      defaultSets.length !== 1
    ) {
      return;
    }
    selectDefaultSetId(defaultSets[0].id);
  }, [
    defaultSets,
    isCreatingDefaultSet,
    isTourDefaults,
    selectedDefaultSetId,
    selectDefaultSetId,
  ]);

  useEffect(() => {
    if (!isTourDefaults || copySourceSetId || defaultSets.length === 0) return;
    setCopySourceSetIdInternal(selectedDefaultSetId || defaultSets[0].id);
  }, [copySourceSetId, defaultSets, isTourDefaults, selectedDefaultSetId]);

  useEffect(() => {
    if (!copySourceSetId) {
      setSelectedCopyTableIds([]);
      return;
    }
    const availableIds = new Set(
      defaultTables
        .filter(
          (table) =>
            table.set_id === copySourceSetId && table.table_type === "power",
        )
        .map((table) => table.id),
    );
    setSelectedCopyTableIds((previous) =>
      previous.filter((tableId) => availableIds.has(tableId)),
    );
  }, [copySourceSetId, defaultTables]);

  const { data: tourName = "" } = useQuery({
    queryKey: queryKeys.scope("tour", tourIdParam, "name"),
    queryFn: async () => {
      const { data } = await dataLayerClient
        .from("tours")
        .select("name")
        .eq("id", tourIdParam!)
        .single();
      return data?.name || "";
    },
    enabled: !!tourIdParam,
  });

  const {
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages: jobStages,
  } = useSelectedTechnicalStage({
    enabled: Boolean(selectedJobId) && isNormalMode,
    jobId: selectedJobId,
  });

  const {
    activeTables,
    addComponentToRow,
    addPrebuiltMonitorPdu,
    addRow,
    currentRows,
    customPduType,
    customPosition,
    editing,
    fohSchukoRequired,
    fohSchukoSetting,
    generateTable,
    getTableSnapshotSettings,
    handleJobSelect,
    includesHoist,
    isImportingXmlp,
    loadedSavedCount,
    persistDefaultTableUpdate,
    persistOverrideUpdate,
    pduOptions,
    pf,
    phaseMode,
    removeRow,
    removeTable,
    resetCurrentTable,
    safetyMargin,
    selectedPduType,
    selectedPosition,
    setCustomPduType,
    setCustomPosition,
    setFohSchukoRequired,
    setIncludesHoist,
    setPf,
    setPhaseMode,
    setSafetyMargin,
    setSelectedPduType,
    setSelectedPosition,
    setTableName,
    setTables,
    setVoltage,
    startEditingDefaultTable,
    startEditingOverride,
    startEditingTable,
    tableName,
    tables,
    updateInput,
    updateTableSettings,
    voltage,
    importXmlpPower,
  } = useConsumosBuilder({
    components,
    config,
    createComponent,
    createPowerOverride,
    department,
    features,
    isNormalMode,
    isOverrideMode,
    isTourDefaults,
    jobIdFromUrl,
    jobs,
    labels,
    overrideTourDateId,
    perRowPf,
    selectedJobId,
    selectedStage,
    setSelectedJob,
    setSelectedJobId,
    syncDefaultDocumentsAfterMutation,
    toast,
    updatePowerOverride,
    updateTourDefaultTable,
  });

  // Restore the persisted FOH schuko setting when a default set is loaded so a
  // value saved earlier is not silently reset to the default on reopen.
  const fohHydratedSetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isTourDefaults || !features.fohSchuko || !selectedDefaultSetId) return;
    if (fohHydratedSetRef.current === selectedDefaultSetId) return;
    const setTables = defaultTables.filter(
      (table) => table.set_id === selectedDefaultSetId && table.table_type === "power",
    );
    if (setTables.length === 0) return;
    fohHydratedSetRef.current = selectedDefaultSetId;
    const anyKeyPresent = setTables.some(
      (table) =>
        typeof table.metadata === "object" &&
        table.metadata !== null &&
        "foh_schuko" in (table.metadata as Record<string, unknown>),
    );
    if (anyKeyPresent) {
      setFohSchukoRequired(
        setTables.some(
          (table) => (table.metadata as { foh_schuko?: boolean })?.foh_schuko === true,
        ),
      );
    }
  }, [
    defaultTables,
    features.fohSchuko,
    isTourDefaults,
    selectedDefaultSetId,
    setFohSchukoRequired,
  ]);

  // Persist the FOH schuko toggle onto the selected set's already-saved tables
  // so toggling it (without re-saving a table) is remembered too.
  const persistFohForSelectedSet = useCallback(
    async (value: boolean) => {
      if (!isTourDefaults || !features.fohSchuko || !selectedDefaultSetId) return;
      const setTables = defaultTables.filter(
        (table) => table.set_id === selectedDefaultSetId && table.table_type === "power",
      );
      if (setTables.length === 0) return;
      try {
        const results = await Promise.all(
          setTables.map((table) =>
            dataLayerClient
              .from("tour_default_tables")
              .update({
                metadata: {
                  ...(typeof table.metadata === "object" && table.metadata !== null
                    ? table.metadata
                    : {}),
                  foh_schuko: value,
                },
              })
              .eq("id", table.id),
          ),
        );
        const failedResult = results.find((result) => result.error);
        if (failedResult?.error) throw failedResult.error;

        await queryClient.invalidateQueries({
          queryKey: queryKeys.scope("tour-default-tables", tourIdParam || "", department),
        });
        await syncDefaultDocumentsAfterMutation();
      } catch (error) {
        console.error("Error persisting FOH schuko setting:", error);
      }
    },
    [
      isTourDefaults,
      features.fohSchuko,
      selectedDefaultSetId,
      defaultTables,
      queryClient,
      tourIdParam,
      department,
      syncDefaultDocumentsAfterMutation,
    ],
  );

  const handleSetFohSchukoRequired = useCallback(
    (value: boolean) => {
      setFohSchukoRequired(value);
      // Keep the loaded set marked as hydrated so the restore effect doesn't
      // overwrite this fresh choice from a stale query snapshot.
      if (selectedDefaultSetId) fohHydratedSetRef.current = selectedDefaultSetId;
      void persistFohForSelectedSet(value);
    },
    [persistFohForSelectedSet, selectedDefaultSetId, setFohSchukoRequired],
  );

  const {
    allCopySourceTablesSelected,
    copySelectedDefaultTables,
    copySourceTables,
    createEmptyDefaultSet,
    handleDeleteDefaultTable,
    handleDeleteOverride,
    handleExportPDF,
    overrideDisplayTables,
    readOnlyDefaultTables,
    saveDefaultTables,
    saveTourDefault,
    selectedCopyTableCount,
    toggleAllCopySourceTables,
    toggleCopyTableSelection,
    tourDefaultDisplayTables,
    tourInfo,
  } = useConsumosTourData({
    activeTables,
    config,
    copySourceSetId,
    copyTourDefaultTablesToSet,
    createSet,
    createTourDefaultTable,
    defaultSets,
    defaultTables,
    deleteOverride,
    deleteTourDefaultTable,
    department,
    editing,
    features,
    fohSchukoRequired,
    fohSchukoSetting,
    getTableSnapshotSettings,
      isNormalMode,
    isOverrideMode,
    isTourDefaults,
    isUrlOverrideMode,
    labels,
    legacyTourDefaults,
    newDefaultSetName,
    overrideData,
    perRowPf,
    pf,
    phaseMode,
    powerOverrides,
    queryClient,
    resetCurrentTable,
    safetyMargin,
    selectedCopyTableIds,
    selectedDefaultPackageSize,
    selectedDefaultSetId,
    selectedJob,
    selectedJobId,
    selectedStage,
    setIsCreatingDefaultSet,
    setNewDefaultSetName,
    setSelectedCopyTableIds,
    setSelectedDefaultSetId,
    setTables,
    syncDefaultDocumentsAfterMutation,
    tables,
    toast,
    tourIdParam,
    tourName,
  });

  // --- Stage copy & quick presets ---

  const copyTableToStage = (tableId: number | string, stage: TechnicalStage) => {
    const source = tables.find((table) => table.id === tableId);
    if (!source) return;
    setTables((prev) => [...prev, cloneTableToStage(source, stage)]);
    toast({
      title: labels.toastSuccess,
      description: labels.toastCopiedToStage(1, stage.name),
    });
  };

  const copyActiveSetToStage = (stage: TechnicalStage) => {
    if (activeTables.length === 0) return;
    setTables((prev) => [...prev, ...cloneTablesToStage(activeTables, stage)]);
    toast({
      title: labels.toastSuccess,
      description: labels.toastCopiedToStage(activeTables.length, stage.name),
    });
  };

  const saveActiveSetAsPreset = async (name: string): Promise<boolean> => {
    if (activeTables.length === 0) return false;
    try {
      await savePreset({ name, tables: activeTables.map(toPresetSnapshot) });
      toast({ title: labels.toastSuccess, description: labels.toastPresetSaved });
      return true;
    } catch (error: unknown) {
      console.error("Error saving quick preset:", error);
      toast({
        title: labels.toastError,
        description: labels.toastPresetSaveError,
        variant: "destructive",
      });
      return false;
    }
  };

  const applyQuickPreset = (preset: QuickPreset<PowerTable>) => {
    if (preset.tables.length === 0) return;
    // Applied tables land on the current stage and behave like freshly
    // generated ones (persisted on the next export).
    setTables((prev) => [
      ...prev,
      ...cloneTablesToStage(preset.tables, selectedStage ?? null),
    ]);
    toast({
      title: labels.toastSuccess,
      description: labels.toastPresetApplied(preset.tables.length, preset.name),
    });
  };

  const removeQuickPreset = async (preset: QuickPreset<PowerTable>) => {
    try {
      await deletePreset(preset.id);
      toast({ title: labels.toastSuccess, description: labels.toastPresetDeleted });
    } catch (error) {
      console.error("Error deleting quick preset:", error);
      toast({
        title: labels.toastError,
        description: labels.toastPresetDeleteError,
        variant: "destructive",
      });
    }
  };

  // Same table set the PDF export uses; also feeds the stage plot in the UI
  const exportDisplayTables = isTourDefaults
    ? tourDefaultDisplayTables
    : isOverrideMode
      ? [...readOnlyDefaultTables, ...overrideDisplayTables]
      : activeTables;
  const exportTablesCount = exportDisplayTables.length;

  // Tables whose position may be changed from the stage plot: local tables,
  // persisted overrides and persisted tour defaults (not the read-only
  // defaults shown in URL override mode).
  const movablePlotTableIds = useMemo(() => {
    const ids = new Set<string>();
    tables.forEach((table) => {
      if (table.id !== undefined) ids.add(String(table.id));
    });
    overrideDisplayTables.forEach((table) => {
      if (table.overrideId) ids.add(String(table.id));
    });
    tourDefaultDisplayTables.forEach((table) => {
      if (table.defaultTableId) ids.add(String(table.id));
    });
    return ids;
  }, [tables, overrideDisplayTables, tourDefaultDisplayTables]);

  const moveTableToPosition = (plotTableId: string, position: string | null) => {
    const patch: Partial<PowerTable> = {
      position: position ?? undefined,
      customPosition: undefined,
    };

    const localTable = tables.find((table) => String(table.id) === plotTableId);
    if (localTable && localTable.id !== undefined) {
      updateTableSettings(localTable.id, patch);
      return;
    }
    const overrideTable = overrideDisplayTables.find(
      (table) => String(table.id) === plotTableId,
    );
    if (overrideTable?.overrideId) {
      void persistOverrideUpdate({ ...overrideTable, ...patch }, overrideTable.overrideId).catch(
        (error) => {
          console.error("Error moving override table:", error);
        },
      );
      return;
    }
    const defaultTable = tourDefaultDisplayTables.find(
      (table) => String(table.id) === plotTableId,
    );
    if (defaultTable?.defaultTableId) {
      void persistDefaultTableUpdate({ ...defaultTable, ...patch });
    }
  };

  return {
    config,
    labels,
    navigate,
    jobs,
    jobIdFromUrl,
    selectedJobId,
    selectedJob,
    handleJobSelect,
    isTourDefaults,
    isOverrideMode,
    isUrlOverrideMode,
    isNormalMode,
    overrideLoading,
    overrideData,
    isCreatingOverride,
    defaultSets,
    selectedDefaultSet,
    selectedDefaultSetId,
    setSelectedDefaultSetId: selectDefaultSetId,
    isCreatingDefaultSet,
    selectedDefaultPackageSize,
    setSelectedDefaultPackageSize,
    newDefaultSetName,
    setNewDefaultSetName,
    createEmptyDefaultSet,
    copySourceSetId,
    setCopySourceSetId,
    selectedCopySourceSet,
    copySourceTables,
    selectedCopyTableIds,
    selectedCopyTableCount,
    allCopySourceTablesSelected,
    toggleCopyTableSelection,
    toggleAllCopySourceTables,
    copySelectedDefaultTables,
    tourName,
    tourInfo,
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    jobStages,
    safetyMargin,
    setSafetyMargin,
    phaseMode,
    setPhaseMode,
    voltage,
    setVoltage,
    pf,
    setPf,
    fohSchukoRequired,
    setFohSchukoRequired: handleSetFohSchukoRequired,
    pduOptions,
    tableName,
    setTableName,
    currentRows,
    components,
    addRow,
    removeRow,
    updateInput,
    addComponentToRow,
    isImportingXmlp,
    importXmlpPower,
    addPrebuiltMonitorPdu,
    selectedPosition,
    setSelectedPosition,
    customPosition,
    setCustomPosition,
    selectedPduType,
    setSelectedPduType,
    customPduType,
    setCustomPduType,
    includesHoist,
    setIncludesHoist,
    editing,
    tables,
    activeTables,
    loadedSavedCount,
    generateTable,
    resetCurrentTable,
    removeTable,
    updateTableSettings,
    startEditingTable,
    startEditingDefaultTable,
    startEditingOverride,
    saveTourDefault,
    saveDefaultTables,
    handleDeleteDefaultTable,
    handleDeleteOverride,
    tourDefaultDisplayTables,
    readOnlyDefaultTables,
    overrideDisplayTables,
    handleExportPDF,
    exportDisplayTables,
    exportTablesCount,
    movablePlotTableIds,
    moveTableToPosition,
    quickPresets,
    isSavingPreset,
    copyTableToStage,
    copyActiveSetToStage,
    saveActiveSetAsPreset,
    applyQuickPreset,
    removeQuickPreset,
  };
};

export type ConsumosToolState = ReturnType<typeof useConsumosTool>;
