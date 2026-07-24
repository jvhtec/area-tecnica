import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useRef } from "react";

import { aggregatePowerCalculations } from "@/features/technical-tools/power/powerAggregation";
import {
  buildTourPowerDefaultTable,
  saveJobPowerRequirementTablesGeneration,
  uploadPowerReportAndCompleteTask,
} from "@/features/technical-tools/power/powerPersistence";
import {
  hydratePowerTable,
  mergeStoredPowerSnapshot,
  type ReadOnlyPowerDefault,
} from "@/features/technical-tools/power/powerTableHydration";
import type { PhaseMode, PowerTable, PowerTableRow } from "@/features/technical-tools/power/types";
import {
  appendTechnicalStageToFilename,
  formatTechnicalStageLabel,
} from "@/features/technical-tools/stage/stageAllocation";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import type { useToast } from "@/hooks/use-toast";
import type { useTourDateOverrides } from "@/hooks/useTourDateOverrides";
import type { TourDefaultSet, TourDefaultTable, useTourDefaultSets } from "@/hooks/useTourDefaultSets";
import type { useTourOverrideMode } from "@/hooks/useTourOverrideMode";
import type { useTourPowerDefaults } from "@/hooks/useTourPowerDefaults";
import { dataLayerClient } from "@/services/dataLayerClient";
import { exportToPDF } from "@/utils/pdfExport";
import type { TourPackageSize } from "@/utils/tourPackages";
import type { ConsumosDepartmentConfig } from "./config";
import {
  getBooleanField,
  getPowerTableRows,
  getStringField,
  toStoredPowerFields,
} from "./consumosStoredPower";
import {
  downloadPdfBlob,
  type ConsumosJob,
} from "./consumosUtils";
import { jobPowerRequirementTablesQueryKey } from "./useJobPowerRequirementTables";

type EditingTarget =
  | { kind: "table"; id: number | string }
  | { kind: "default"; id: string }
  | { kind: "override"; id: string };

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown error";

interface UseConsumosTourDataOptions {
  activeTables: PowerTable[];
  config: ConsumosDepartmentConfig;
  copySourceSetId: string;
  copyTourDefaultTablesToSet: ReturnType<
    typeof useTourDefaultSets
  >["copyTablesToSet"];
  createSet: ReturnType<typeof useTourDefaultSets>["createSet"];
  createTourDefaultTable: ReturnType<
    typeof useTourDefaultSets
  >["createTable"];
  defaultSets: TourDefaultSet[];
  defaultTables: TourDefaultTable[];
  deleteOverride: ReturnType<typeof useTourDateOverrides>["deleteOverride"];
  deleteTourDefaultTable: ReturnType<
    typeof useTourDefaultSets
  >["deleteTable"];
  department: ConsumosDepartmentConfig["department"];
  editing: EditingTarget | null;
  features: ConsumosDepartmentConfig["features"];
  fohSchukoRequired: boolean;
  fohSchukoSetting: () => boolean | undefined;
  getTableSnapshotSettings: (
    table: PowerTable,
  ) => import("@/features/technical-tools/power/types").PowerElectricalSettings;
  isNormalMode: boolean;
  isOverrideMode: boolean;
  isTourDefaults: boolean;
  isUrlOverrideMode: boolean;
  labels: ConsumosDepartmentConfig["labels"];
  legacyTourDefaults: ReturnType<
    typeof useTourPowerDefaults
  >["powerDefaults"];
  newDefaultSetName: string;
  overrideData: ReturnType<typeof useTourOverrideMode>["overrideData"];
  perRowPf: boolean;
  pf: number;
  phaseMode: PhaseMode;
  powerOverrides: ReturnType<
    typeof useTourDateOverrides
  >["powerOverrides"];
  queryClient: QueryClient;
  resetCurrentTable: () => void;
  safetyMargin: number;
  selectedCopyTableIds: string[];
  selectedDefaultPackageSize: TourPackageSize | "unassigned";
  selectedDefaultSetId: string;
  selectedJob: ConsumosJob | null;
  selectedJobId: string;
  selectedStage: TechnicalStage | null | undefined;
  setIsCreatingDefaultSet: Dispatch<SetStateAction<boolean>>;
  setNewDefaultSetName: Dispatch<SetStateAction<string>>;
  setSelectedCopyTableIds: Dispatch<SetStateAction<string[]>>;
  setSelectedDefaultSetId: Dispatch<SetStateAction<string>>;
  setTables: Dispatch<SetStateAction<PowerTable[]>>;
  syncDefaultDocumentsAfterMutation: () => Promise<void>;
  tables: PowerTable[];
  toast: ReturnType<typeof useToast>["toast"];
  tourIdParam: string | null;
  tourName: string;
}

export function useConsumosTourData({
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
}: UseConsumosTourDataOptions) {
  // Tour defaults persistence
  const pendingSetIdRef = useRef<Promise<string> | null>(null);

  const getOrCreateDefaultSetId = async (): Promise<string> => {
    if (selectedDefaultSetId) {
      return selectedDefaultSetId;
    }
    if (pendingSetIdRef.current) return pendingSetIdRef.current;

    const trimmedSetName = newDefaultSetName.trim();
    if (!trimmedSetName) {
      throw new Error("Selecciona un conjunto predeterminado existente o introduce un nombre para crear uno.");
    }

    const creation = createSet({
      tour_id: tourIdParam!,
      name: trimmedSetName,
      department,
      description: config.defaultsSetDescription,
      package_size:
        selectedDefaultPackageSize === "unassigned"
          ? null
          : selectedDefaultPackageSize,
    })
      .then((set) => {
        setSelectedDefaultSetId(set.id);
        setIsCreatingDefaultSet(false);
        setNewDefaultSetName("");
        pendingSetIdRef.current = null;
        return set.id;
      })
      .catch((error) => {
        pendingSetIdRef.current = null;
        throw error;
      });
    pendingSetIdRef.current = creation;
    return creation;
  };

  const createEmptyDefaultSet = async () => {
    try {
      await getOrCreateDefaultSetId();
      await syncDefaultDocumentsAfterMutation();
    } catch (error: unknown) {
      console.error("Error creating default set:", error);
      toast({
        title: labels.toastError,
        description: labels.toastDefaultSaveError(getErrorMessage(error)),
        variant: "destructive",
      });
    }
  };

  const saveTourDefault = async (table: PowerTable) => {
    if (!tourIdParam) return;
    try {
      const setId = await getOrCreateDefaultSetId();
      const newDefaultTable = await createTourDefaultTable(
        buildTourPowerDefaultTable({
          setId,
          settings: { ...getTableSnapshotSettings(table), fohSchuko: fohSchukoSetting() },
          table,
        }),
      );
      // Replace local numeric id with server UUID so delete/edit handlers
      // treat this entry as persisted
      setTables((prev) =>
        prev.map((candidate) =>
          candidate.id === table.id
            ? {
                ...candidate,
                id: newDefaultTable.id,
                isDefault: true,
                defaultTableId: newDefaultTable.id,
              }
            : candidate,
        ),
      );
      await syncDefaultDocumentsAfterMutation();
      toast({ title: labels.toastSuccess, description: labels.toastDefaultSaved });
    } catch (error: unknown) {
      console.error("Error saving tour default:", error);
      toast({
        title: labels.toastError,
        description: labels.toastDefaultSaveError(getErrorMessage(error)),
        variant: "destructive",
      });
    }
  };

  const saveDefaultTables = async () => {
    const unsaved = tables.filter((table) => !table.isDefault && !table.defaultTableId);
    if (unsaved.length === 0) {
      toast({
        title: labels.toastNoUnsavedDefaultsTitle,
        description: labels.toastNoUnsavedDefaultsBody,
      });
      return;
    }
    let setId: string;
    try {
      setId = await getOrCreateDefaultSetId();
    } catch (error: unknown) {
      console.error("Error getting/creating default set:", error);
      toast({
        title: labels.toastError,
        description: labels.toastDefaultSaveError(getErrorMessage(error)),
        variant: "destructive",
      });
      return;
    }
    const failed: string[] = [];
    for (let index = 0; index < unsaved.length; index++) {
      const table = unsaved[index];
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        const newDefaultTable = await createTourDefaultTable(
          buildTourPowerDefaultTable({
            orderIndex: index,
            setId,
            settings: { ...getTableSnapshotSettings(table), fohSchuko: fohSchukoSetting() },
            table,
          }),
        );
        setTables((prev) =>
          prev.map((candidate) =>
            candidate.id === table.id
              ? {
                  ...candidate,
                  id: newDefaultTable.id,
                  isDefault: true,
                  defaultTableId: newDefaultTable.id,
                }
              : candidate,
          ),
        );
      } catch (error) {
        console.error(`Error saving default table "${table.name}":`, error);
        failed.push(table.name);
      }
    }
    const saved = unsaved.length - failed.length;
    if (saved > 0) {
      await syncDefaultDocumentsAfterMutation();
    }
    if (failed.length === 0) {
      toast({ title: labels.toastSuccess, description: labels.toastDefaultsSaved(saved) });
    } else if (saved > 0) {
      toast({
        title: labels.toastError,
        description: labels.toastDefaultsPartial(saved, failed),
        variant: "destructive",
      });
    } else {
      toast({
        title: labels.toastError,
        description: labels.toastDefaultsFailed(failed),
        variant: "destructive",
      });
    }
  };

  const handleDeleteDefaultTable = async (defaultTableId: string) => {
    try {
      await deleteTourDefaultTable(defaultTableId);
      if (editing?.kind === "default" && editing.id === defaultTableId) {
        resetCurrentTable();
      }
      await syncDefaultDocumentsAfterMutation();
    } catch (error) {
      console.error("Error deleting default table:", error);
      toast({
        title: labels.toastError,
        description: labels.toastDefaultsFailed([defaultTableId]),
        variant: "destructive",
      });
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    try {
      await deleteOverride({ id: overrideId, table: "power" });
      if (editing?.kind === "override" && editing.id === overrideId) {
        resetCurrentTable();
      }
      toast({ title: labels.toastSuccess, description: labels.toastOverrideDeleted });
    } catch (error) {
      console.error("Error deleting override:", error);
      toast({
        title: labels.toastError,
        description: labels.toastOverrideDeleteError,
        variant: "destructive",
      });
    }
  };

  const hydrateDisplayPowerTable = useCallback(
    (input: Omit<Parameters<typeof hydratePowerTable>[0], "defaults">) =>
      hydratePowerTable({
        ...input,
        defaults: {
          fallbackPowerFactor: config.defaultPowerFactor ?? 0.9,
          fallbackSafetyMargin: safetyMargin,
          phaseMode,
          powerFactor: pf,
          perRowPowerFactor: perRowPf,
        },
      }),
    [config.defaultPowerFactor, safetyMargin, phaseMode, pf, perRowPf],
  );

  const mapTourDefaultTableToPowerTable = useCallback(
    (table: TourDefaultTable): PowerTable => {
      const rows = getPowerTableRows(table.table_data);
      const snapshot = mergeStoredPowerSnapshot(toStoredPowerFields(table.metadata), toStoredPowerFields(table.table_data));
      const pduType = getStringField(table.metadata, "pdu_type") || "";
      const customPduType = getStringField(table.metadata, "custom_pdu_type");
      return hydrateDisplayPowerTable({
        id: `new-default-${table.id}`,
        name: table.table_name,
        rows,
        totalWatts: table.total_value || 0,
        snapshot,
        pduType,
        customPduType,
        patch: {
          position: getStringField(table.metadata, "position"),
          customPosition: getStringField(table.metadata, "custom_position"),
          includesHoist: getBooleanField(table.metadata, "includes_hoist"),
          isDefault: true,
          defaultTableId: table.id,
        },
      });
    },
    [hydrateDisplayPowerTable],
  );

  const copySourceTables = (defaultTables || [])
    .filter(
      (table) =>
        table.set_id === copySourceSetId && table.table_type === "power",
    )
    .map(mapTourDefaultTableToPowerTable);

  const copySourceTableIds = copySourceTables
    .map((table) => table.defaultTableId)
    .filter((tableId): tableId is string => Boolean(tableId));
  const selectedCopyTableCount = selectedCopyTableIds.filter((tableId) =>
    copySourceTableIds.includes(tableId),
  ).length;
  const allCopySourceTablesSelected =
    copySourceTableIds.length > 0 &&
    selectedCopyTableCount === copySourceTableIds.length;

  const toggleCopyTableSelection = (tableId: string, checked: boolean) => {
    setSelectedCopyTableIds((previous) => {
      if (checked) return Array.from(new Set([...previous, tableId]));
      return previous.filter((selectedId) => selectedId !== tableId);
    });
  };

  const toggleAllCopySourceTables = (checked: boolean) => {
    setSelectedCopyTableIds(checked ? copySourceTableIds : []);
  };

  const copySelectedDefaultTables = async () => {
    const selectedIds = selectedCopyTableIds.filter((tableId) =>
      copySourceTableIds.includes(tableId),
    );
    if (selectedIds.length === 0) {
      toast({
        title: labels.toastError,
        description: "Selecciona al menos una tabla para copiar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const targetSetId = selectedDefaultSetId || (await getOrCreateDefaultSetId());
      await copyTourDefaultTablesToSet({
        tableIds: selectedIds,
        targetSetId,
      });
      setSelectedCopyTableIds([]);
      setSelectedDefaultSetId(targetSetId);
      setIsCreatingDefaultSet(false);
      await syncDefaultDocumentsAfterMutation();
    } catch (error: unknown) {
      console.error("Error copying default tables:", error);
      toast({
        title: labels.toastError,
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  // Tour defaults for display (new system with legacy fallback)
  const tourDefaultDisplayTables: PowerTable[] = useMemo(() => {
    const canDisplayNewSystemTables =
      Boolean(selectedDefaultSetId) || defaultSets.length <= 1;
    const newSystemTables = (defaultTables || [])
      .filter(
        (table) =>
          canDisplayNewSystemTables &&
          table.table_type === "power" &&
          (!selectedDefaultSetId || table.set_id === selectedDefaultSetId),
      )
      .map(mapTourDefaultTableToPowerTable);

    if (newSystemTables.length > 0 || !features.legacyTourDefaultsFallback) {
      return newSystemTables;
    }

    if (defaultSets.length > 0) {
      return [];
    }

    return legacyTourDefaults.map((legacyDefault) => {
      const snapshot = {
        calculation: legacyDefault.metadata?.calculation,
        pf: legacyDefault.metadata?.pf ?? legacyDefault.pf,
        safetyMargin: legacyDefault.metadata?.safetyMargin ?? legacyDefault.safetyMargin,
        phaseMode: legacyDefault.metadata?.phaseMode,
        voltage: legacyDefault.metadata?.voltage,
      };
      const pduType = legacyDefault.pdu_type || "";
      const customPduType = legacyDefault.custom_pdu_type || undefined;
      return hydrateDisplayPowerTable({
        id: `legacy-default-${legacyDefault.id}`,
        name: legacyDefault.table_name,
        rows: [],
        totalWatts: legacyDefault.total_watts || 0,
        snapshot,
        pduType,
        customPduType,
        patch: {
          position: legacyDefault.position ?? undefined,
          customPosition: legacyDefault.custom_position ?? undefined,
          includesHoist: legacyDefault.includes_hoist,
          isDefault: true,
        },
      });
    });
  }, [
    defaultSets.length,
    defaultTables,
    selectedDefaultSetId,
    legacyTourDefaults,
    features.legacyTourDefaultsFallback,
    hydrateDisplayPowerTable,
    mapTourDefaultTableToPowerTable,
  ]);

  // Read-only defaults shown in URL override mode
  const readOnlyDefaultTables: PowerTable[] = useMemo(() => {
    if (!isUrlOverrideMode || !overrideData) return [];
    return (overrideData.defaults as ReadOnlyPowerDefault[])
      .filter((table) => table.table_type === "power")
      .map((table) => {
        const rows: PowerTableRow[] = table.table_data?.rows || [];
        const snapshot = mergeStoredPowerSnapshot(table.metadata, table.table_data);
        const pduType = table.metadata?.pdu_type || "";
        const customPduType = table.metadata?.custom_pdu_type;
        return hydrateDisplayPowerTable({
          id: `default-${table.id}`,
          name: `${table.table_name} (Default)`,
          rows,
          totalWatts: table.total_value || 0,
          snapshot,
          pduType,
          customPduType,
          patch: {
            position: table.metadata?.position,
            customPosition: table.metadata?.custom_position,
            includesHoist: table.metadata?.includes_hoist || false,
            isDefault: true,
          },
        });
      });
  }, [isUrlOverrideMode, overrideData, hydrateDisplayPowerTable]);

  // Persisted overrides for this tour date (department-scoped)
  const overrideDisplayTables: PowerTable[] = useMemo(
    () =>
      powerOverrides
        .filter((override) => !override.department || override.department === department)
        .map((override) => {
          const rows: PowerTableRow[] = override.override_data?.rows || [];
          const snapshot = {
            calculation: override.override_data?.calculation,
            pf: override.override_data?.pf,
            safetyMargin: override.override_data?.safetyMargin,
            phaseMode: override.override_data?.phaseMode,
            voltage: override.override_data?.voltage,
          };
          const pduType = override.pdu_type || "";
          const customPduType = override.custom_pdu_type || undefined;
          return hydrateDisplayPowerTable({
            id: `override-${override.id}`,
            name: override.table_name,
            rows,
            totalWatts: override.total_watts || 0,
            snapshot,
            pduType,
            customPduType,
            patch: {
              position: override.position ?? undefined,
              customPosition: override.custom_position ?? undefined,
              includesHoist: override.includes_hoist,
              isOverride: true,
              overrideId: override.id,
            },
          });
        }),
    [powerOverrides, department, hydrateDisplayPowerTable],
  );

  const getTourInfo = () => {
    if (isUrlOverrideMode && overrideData) {
      return {
        tourName: overrideData.tourName,
        tourDate: overrideData.tourDate,
        locationName: overrideData.locationName,
      };
    }
    if (!selectedJob?.tour_date) return null;
    return {
      tourName: selectedJob.tour_date.tour?.name || "Unknown Tour",
      tourDate: selectedJob.tour_date.date || selectedJob.start_time,
      locationName:
        selectedJob.tour_date.location?.name ||
        selectedJob.location?.name ||
        "Unknown Location",
    };
  };

  const handleExportPDF = async () => {
    let exportTables: PowerTable[];
    let headerTitle: string;
    let pdfDate: string;
    let fileName: string;

    if (isTourDefaults) {
      exportTables = tourDefaultDisplayTables;
      headerTitle = config.defaultsReportTitle(tourName);
      pdfDate = new Date().toISOString();
      fileName = config.defaultsPdfFileName(tourName);
    } else if (isOverrideMode) {
      const tourInfo = getTourInfo();
      if (isUrlOverrideMode && !overrideData) {
        toast({
          title: labels.toastNoTourDataTitle,
          description: labels.toastNoTourDataBody,
          variant: "destructive",
        });
        return;
      }
      exportTables = [...readOnlyDefaultTables, ...overrideDisplayTables];
      const baseTitle = isUrlOverrideMode
        ? `${tourInfo?.tourName} - ${tourInfo?.locationName}`
        : selectedJob?.title || "Power Report";
      headerTitle = baseTitle;
      pdfDate =
        (isUrlOverrideMode ? tourInfo?.tourDate : selectedJob?.start_time) ||
        new Date().toISOString();
      fileName = config.pdfFileName(baseTitle);
    } else {
      if (!selectedJobId) {
        toast({
          title: labels.toastNoJobTitle,
          description: labels.toastNoJobBody,
          variant: "destructive",
        });
        return;
      }
      exportTables = activeTables;
      const jobTitle = selectedJob?.title || "Power Report";
      const jobLocation = selectedJob?.location?.name || "";
      const baseHeaderTitle = jobLocation ? `${jobTitle} - ${jobLocation}` : jobTitle;
      const stageLabel = formatTechnicalStageLabel(selectedStage);
      headerTitle = stageLabel ? `${baseHeaderTitle} - ${stageLabel}` : baseHeaderTitle;
      pdfDate = selectedJob?.start_time || selectedJob?.date || new Date().toISOString();
      fileName = appendTechnicalStageToFilename(
        config.pdfFileName(jobTitle),
        selectedStage,
      );
    }

    try {
      const aggregation = aggregatePowerCalculations(exportTables);

      let logoUrl: string | undefined;
      try {
        if ((isTourDefaults || isUrlOverrideMode) && tourIdParam) {
          const { fetchTourLogo } = await import("@/utils/pdf/logoUtils");
          logoUrl = await fetchTourLogo(tourIdParam);
        } else if (selectedJobId) {
          const { fetchJobLogo } = await import("@/utils/pdf/logoUtils");
          logoUrl = await fetchJobLogo(selectedJobId);
        }
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const pdfBlob = await exportToPDF(
        headerTitle,
        exportTables.map((table) => ({
          ...table,
          toolType: "consumos" as const,
          phaseMode: table.calculation?.phaseMode ?? phaseMode,
        })),
        "power",
        headerTitle,
        pdfDate,
        undefined,
        {
          totalSystemWatts: aggregation.totalWatts,
          adjustedSystemWatts: aggregation.adjustedWatts,
          totalSystemAmps: aggregation.currentLine,
          totalSystemKva:
            aggregation.totalVa === null ? null : aggregation.totalVa / 1000,
          aggregationReason: aggregation.reason,
        },
        undefined,
        logoUrl,
        features.fohSchuko ? fohSchukoRequired : undefined,
      );

      // Auto-complete department Consumos tasks only after successful upload
      let completedTasksCount = 0;
      if (selectedJobId && !isTourDefaults) {
        completedTasksCount = await uploadPowerReportAndCompleteTask({
          department,
          fileName,
          jobId: selectedJobId,
          pdfBlob,
          stage: selectedStage,
        });
        if (completedTasksCount > 0) {
          console.log(`Auto-completed ${completedTasksCount} ${department} Consumos task(s)`);
        }
      }

      if (isNormalMode && selectedJobId) {
        const savedTables = await saveJobPowerRequirementTablesGeneration({
          client: dataLayerClient,
          department,
          jobId: selectedJobId,
          settings: (table) => getTableSnapshotSettings(table as PowerTable),
          stage: selectedStage,
          tables: exportTables,
        });

        setTables((storedTables) =>
          storedTables.map((storedTable) => {
            const savedTable = savedTables.find(
              (saved) => saved.tableId === storedTable.id,
            );
            return savedTable
              ? {
                  ...storedTable,
                  generationTimestamp: savedTable.generationTimestamp,
                  powerRequirementId: savedTable.powerRequirementId,
                }
              : storedTable;
          }),
        );

        queryClient.invalidateQueries({
          queryKey: jobPowerRequirementTablesQueryKey(selectedJobId, department),
        });
      }

      toast({
        title: labels.toastSuccess,
        description: isTourDefaults
          ? labels.toastPdfGenerated
          : completedTasksCount > 0
            ? labels.toastPdfAutoCompleted(completedTasksCount)
            : selectedJobId
              ? labels.toastPdfUploaded
              : labels.toastPdfGenerated,
      });

      downloadPdfBlob(pdfBlob, fileName);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: labels.toastError,
        description: labels.toastPdfError,
        variant: "destructive",
      });
    }
  };

  return {
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
    tourInfo: getTourInfo(),
  };
}
