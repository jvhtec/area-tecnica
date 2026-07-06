import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useJobSelection } from "@/hooks/useJobSelection";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useTourDefaultSets, type TourDefaultTable } from "@/hooks/useTourDefaultSets";
import { useTourPowerDefaults } from "@/hooks/useTourPowerDefaults";
import { useTourDateOverrides } from "@/hooks/useTourDateOverrides";
import { useTourOverrideMode } from "@/hooks/useTourOverrideMode";
import type { TourPackageSize } from "@/utils/tourPackages";
import { dataLayerClient } from "@/services/dataLayerClient";
import { optimizedInvalidation, queryKeys } from "@/lib/react-query";
import { exportToPDF } from "@/utils/pdfExport";
import { syncTourDefaultDocuments, toastTourDefaultDocumentNoUpdate } from "@/utils/tourDefaultDocumentSync";
import {
  CUSTOM_POWER_POSITION_VALUE,
  NO_POWER_POSITION_VALUE,
} from "@/utils/powerPositions";
import type {
  PhaseMode,
  PowerElectricalSettings,
  PowerTable,
  PowerTableRow,
} from "@/features/technical-tools/power/types";
import {
  calculateMixedLoadApparentPower,
  createCalculatedPowerTable,
  getPowerPduOptions,
  getVoltageForPhase,
} from "@/features/technical-tools/power/powerCalculations";
import {
  buildPowerOverridePayload,
  buildPowerTableData,
  buildPowerTableMetadata,
  buildTourPowerDefaultTable,
  saveJobPowerRequirementTablesGeneration,
  uploadPowerReportAndCompleteTask,
} from "@/features/technical-tools/power/powerPersistence";
import {
  appendTechnicalStageToFilename,
  formatTechnicalStageLabel,
  isSameTechnicalStage,
  useSelectedTechnicalStage,
} from "@/features/technical-tools/stage/stageAllocation";
import {
  DEFAULT_FIXTURE_TYPE,
  FIXTURE_PF,
  type ConsumosDepartmentConfig,
  type FixtureType,
} from "./config";
import {
  jobPowerRequirementTablesQueryKey,
  mapPowerRequirementRowToTable,
  useJobPowerRequirementTables,
} from "./useJobPowerRequirementTables";
import {
  cloneTableToStage,
  cloneTablesToStage,
  toPresetSnapshot,
} from "@/features/technical-tools/table-presets/stageCopy";
import {
  useQuickPresets,
  type QuickPreset,
} from "@/features/technical-tools/table-presets/useQuickPresets";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import {
  type CustomPowerComponentInput,
  useCustomPowerComponents,
} from "./useCustomPowerComponents";
import { useConsumosComponents } from "./useConsumosComponents";

const DEFAULT_PDU_SELECT_VALUE = "default";
const CUSTOM_PDU_SELECT_VALUE = "Custom";

type EditingTarget =
  | { kind: "table"; id: number | string }
  | { kind: "default"; id: string }
  | { kind: "override"; id: string };

type ConsumosJob = {
  id: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  date?: string;
  tour_date_id?: string | null;
  tour_date?: {
    date?: string;
    tour?: { name?: string } | null;
    location?: { name?: string } | null;
  } | null;
  location?: { name?: string } | null;
};

type ReadOnlyPowerDefault = {
  id: string;
  table_type: string;
  table_name: string;
  total_value?: number;
  table_data?: {
    rows?: PowerTableRow[];
    pf?: number;
    safetyMargin?: number;
  };
  metadata?: {
    pf?: number;
    safetyMargin?: number;
    current_per_phase?: number;
    pdu_type?: string;
    custom_pdu_type?: string;
    position?: string;
    custom_position?: string;
    includes_hoist?: boolean;
  };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "unknown error";

const getRecommendedFixturePf = (fixtureType?: string) =>
  FIXTURE_PF[(fixtureType as FixtureType) || DEFAULT_FIXTURE_TYPE]?.pf ??
  FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf;

const downloadPdfBlob = (pdfBlob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(pdfBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};

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
  }, [isTourDefaults, features.fohSchuko, selectedDefaultSetId, defaultTables]);

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
    [persistFohForSelectedSet, selectedDefaultSetId],
  );

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

  // Electrical settings
  const [safetyMargin, setSafetyMargin] = useState(config.defaultSafetyMargin);
  const [phaseMode, setPhaseMode] = useState<PhaseMode>("three");
  const [voltage, setVoltage] = useState<number>(getVoltageForPhase("three"));
  const [pf, setPf] = useState<number>(config.defaultPowerFactor ?? 0.9);
  const [fohSchukoRequired, setFohSchukoRequired] = useState<boolean>(true);

  useEffect(() => {
    setVoltage(getVoltageForPhase(phaseMode));
  }, [phaseMode]);

  const pduOptions = getPowerPduOptions(department, phaseMode);

  // Builder state
  const makeEmptyRow = (): PowerTableRow =>
    perRowPf
      ? {
          quantity: "",
          componentId: "",
          watts: "",
          fixtureType: DEFAULT_FIXTURE_TYPE,
          pf: FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf.toFixed(2),
        }
      : { quantity: "", componentId: "", watts: "" };

  const [tableName, setTableName] = useState("");
  const [currentRows, setCurrentRows] = useState<PowerTableRow[]>([makeEmptyRow()]);
  const [selectedPosition, setSelectedPosition] = useState<string>(NO_POWER_POSITION_VALUE);
  const [customPosition, setCustomPosition] = useState<string>("");
  const [selectedPduType, setSelectedPduType] = useState<string>(DEFAULT_PDU_SELECT_VALUE);
  const [customPduType, setCustomPduType] = useState<string>("");
  const [includesHoist, setIncludesHoist] = useState(false);
  const [editing, setEditing] = useState<EditingTarget | null>(null);

  const [tables, setTables] = useState<PowerTable[]>([]);

  useEffect(() => {
    if (
      selectedPduType !== DEFAULT_PDU_SELECT_VALUE &&
      selectedPduType !== CUSTOM_PDU_SELECT_VALUE &&
      !pduOptions.includes(selectedPduType)
    ) {
      setSelectedPduType(DEFAULT_PDU_SELECT_VALUE);
    }
  }, [pduOptions, selectedPduType]);

  // Preselect job from query param and fetch details if not in the list
  useEffect(() => {
    const applyJobFromUrl = async () => {
      if (!jobIdFromUrl) return;
      try {
        setSelectedJobId(jobIdFromUrl);
        const found = (jobs || []).find((job) => job.id === jobIdFromUrl) || null;
        if (found) {
          setSelectedJob(found);
          return;
        }
        const { data } = await dataLayerClient
          .from("jobs")
          .select("id, title, start_time, end_time, tour_date_id")
          .eq("id", jobIdFromUrl)
          .single();
        if (data) setSelectedJob(data);
      } catch (error) {
        console.warn("Failed to preselect job from URL in consumos tool", error);
      }
    };
    applyJobFromUrl();
  }, [jobIdFromUrl, jobs]);

  const handleJobSelect = (jobId: string) => {
    if (!jobId) return;
    setSelectedJobId(jobId);
    const job = jobs?.find((candidate) => candidate.id === jobId) || null;
    setSelectedJob(job);
  };

  // NEW: load the saved power requirement set for the job so it can be edited
  // instead of forcing users to rebuild it from scratch.
  const savedTablesQuery = useJobPowerRequirementTables({
    department,
    enabled: isNormalMode,
    jobId: selectedJobId,
  });
  const hydratedJobKeyRef = useRef<string | null>(null);
  const [loadedSavedCount, setLoadedSavedCount] = useState(0);

  useEffect(() => {
    if (!isNormalMode || !selectedJobId || !savedTablesQuery.data) return;
    const hydrationKey = `${selectedJobId}:${department}`;
    if (hydratedJobKeyRef.current === hydrationKey) return;
    hydratedJobKeyRef.current = hydrationKey;

    const savedTables = savedTablesQuery.data.map((row) =>
      mapPowerRequirementRowToTable(row, {
        fallbackSafetyMargin: config.defaultSafetyMargin,
        perRowPf,
      }),
    );
    setLoadedSavedCount(savedTables.length);
    if (savedTables.length === 0) return;

    // Keep any tables the user built before picking the job
    setTables((prev) => [...savedTables, ...prev.filter((table) => !table.powerRequirementId)]);
  }, [savedTablesQuery.data, selectedJobId, isNormalMode, department, perRowPf, config.defaultSafetyMargin]);

  const activeTables = selectedStage
    ? tables.filter((table) => isSameTechnicalStage(table.stageNumber, selectedStage))
    : tables;

  const getPowerSettings = (): PowerElectricalSettings => ({
    safetyMargin,
    phaseMode,
    voltage,
    ...(perRowPf ? {} : { powerFactor: pf }),
  });

  const getTableSnapshotSettings = (table: PowerTable): PowerElectricalSettings => ({
    safetyMargin: table.snapshotSafetyMargin ?? safetyMargin,
    phaseMode: table.snapshotPhaseMode ?? phaseMode,
    voltage: table.snapshotVoltage ?? voltage,
    ...(perRowPf
      ? {}
      : { powerFactor: table.snapshotPowerFactor ?? pf }),
  });

  // Builder row handlers
  const addRow = () => setCurrentRows((prev) => [...prev, makeEmptyRow()]);

  const removeRow = (index: number) => {
    setCurrentRows((prev) => {
      const filtered = prev.filter((_, rowIndex) => rowIndex !== index);
      return filtered.length > 0 ? filtered : [makeEmptyRow()];
    });
  };

  const updateInput = (index: number, field: keyof PowerTableRow, value: string) => {
    setCurrentRows((prev) => {
      const rows = [...prev];
      if (field === "componentId" && value) {
        const component = components.find(
          (candidate) => candidate.id.toString() === value,
        );
        if (perRowPf) {
          const fixtureType =
            component?.fixtureType || rows[index].fixtureType || DEFAULT_FIXTURE_TYPE;
          rows[index] = {
            ...rows[index],
            componentId: value,
            watts: component ? component.watts.toString() : "",
            fixtureType,
            pf: getRecommendedFixturePf(fixtureType).toFixed(2),
          };
        } else {
          rows[index] = {
            ...rows[index],
            componentId: value,
            watts: component ? component.watts.toString() : "",
          };
        }
      } else if (field === "fixtureType") {
        rows[index] = {
          ...rows[index],
          fixtureType: value,
          pf: getRecommendedFixturePf(value).toFixed(2),
        };
      } else {
        rows[index] = { ...rows[index], [field]: value };
      }
      return rows;
    });
  };

  const addComponentToRow = async (
    index: number,
    input: CustomPowerComponentInput,
  ) => {
    let component;
    try {
      component = await createComponent(input);
    } catch (error) {
      console.error("Error adding consumos component:", error);
      toast({
        title: labels.toastError,
        description: labels.toastComponentSaveError,
        variant: "destructive",
      });
      return;
    }
    toast({ title: labels.toastSuccess, description: labels.toastComponentSaved });
    setCurrentRows((previous) => {
      const rows = [...previous];
      rows[index] = {
        ...rows[index],
        componentId: component.id.toString(),
        watts: component.watts.toString(),
        ...(perRowPf
          ? {
              fixtureType: component.fixtureType || DEFAULT_FIXTURE_TYPE,
              pf: getRecommendedFixturePf(component.fixtureType).toFixed(2),
            }
          : {}),
      };
      return rows;
    });
  };

  const resetCurrentTable = () => {
    setCurrentRows([makeEmptyRow()]);
    setTableName("");
    setSelectedPosition(NO_POWER_POSITION_VALUE);
    setCustomPosition("");
    setSelectedPduType(DEFAULT_PDU_SELECT_VALUE);
    setCustomPduType("");
    setIncludesHoist(false);
    setEditing(null);
  };

  const loadPowerTableIntoBuilder = (table: PowerTable) => {
    setTableName(table.name);
    setCurrentRows(
      table.rows.length > 0
        ? table.rows.map((row) => ({ ...row }))
        : [makeEmptyRow()],
    );
    if (table.customPosition) {
      setSelectedPosition(CUSTOM_POWER_POSITION_VALUE);
      setCustomPosition(table.customPosition);
    } else if (table.position) {
      setSelectedPosition(table.position);
      setCustomPosition("");
    } else {
      setSelectedPosition(NO_POWER_POSITION_VALUE);
      setCustomPosition("");
    }
    if (table.customPduType) {
      if (pduOptions.includes(table.customPduType)) {
        setSelectedPduType(table.customPduType);
        setCustomPduType("");
      } else {
        setSelectedPduType(CUSTOM_PDU_SELECT_VALUE);
        setCustomPduType(table.customPduType);
      }
    } else {
      setSelectedPduType(DEFAULT_PDU_SELECT_VALUE);
      setCustomPduType("");
    }
    setIncludesHoist(Boolean(table.includesHoist));
  };

  // Load an existing local table into the builder.
  const startEditingTable = (table: PowerTable) => {
    if (table.id === undefined) return;
    loadPowerTableIntoBuilder(table);
    setEditing({ kind: "table", id: table.id });
  };

  const startEditingDefaultTable = (table: PowerTable) => {
    if (!table.defaultTableId) return;
    loadPowerTableIntoBuilder(table);
    setEditing({ kind: "default", id: table.defaultTableId });
  };

  const startEditingOverride = (override: {
    id: string;
    table_name: string;
    total_watts: number;
    position?: string | null;
    custom_position?: string | null;
    custom_pdu_type?: string | null;
    includes_hoist?: boolean;
    override_data?: { rows?: PowerTableRow[] };
  }) => {
    setTableName(override.table_name);
    setCurrentRows(
      override.override_data?.rows?.length
        ? override.override_data.rows.map((row) => ({ ...row }))
        : [
            {
              ...makeEmptyRow(),
              quantity: "1",
              watts: override.total_watts?.toString() || "",
            },
          ],
    );
    if (override.custom_position) {
      setSelectedPosition(CUSTOM_POWER_POSITION_VALUE);
      setCustomPosition(override.custom_position);
    } else if (override.position) {
      setSelectedPosition(override.position);
      setCustomPosition("");
    } else {
      setSelectedPosition(NO_POWER_POSITION_VALUE);
      setCustomPosition("");
    }
    if (override.custom_pdu_type) {
      if (pduOptions.includes(override.custom_pdu_type)) {
        setSelectedPduType(override.custom_pdu_type);
        setCustomPduType("");
      } else {
        setSelectedPduType(CUSTOM_PDU_SELECT_VALUE);
        setCustomPduType(override.custom_pdu_type);
      }
    } else {
      setSelectedPduType(DEFAULT_PDU_SELECT_VALUE);
      setCustomPduType("");
    }
    setIncludesHoist(Boolean(override.includes_hoist));
    setEditing({ kind: "override", id: override.id });
  };

  const buildTableFromBuilder = (): PowerTable => {
    const settings = getPowerSettings();
    const resolvedPosition =
      selectedPosition === NO_POWER_POSITION_VALUE ||
      selectedPosition === CUSTOM_POWER_POSITION_VALUE
        ? undefined
        : selectedPosition;
    const resolvedCustomPosition =
      selectedPosition === CUSTOM_POWER_POSITION_VALUE && customPosition
        ? customPosition
        : undefined;
    const pduOverride =
      selectedPduType !== DEFAULT_PDU_SELECT_VALUE
        ? selectedPduType === CUSTOM_PDU_SELECT_VALUE
          ? customPduType || undefined
          : selectedPduType
        : undefined;

    let preparedRows = currentRows;
    let rawApparentPowerVa: number | undefined;
    if (perRowPf) {
      preparedRows = currentRows.map((row) => {
        const component = components.find(
          (candidate) => candidate.id.toString() === row.componentId,
        );
        const fixtureType =
          row.fixtureType || component?.fixtureType || DEFAULT_FIXTURE_TYPE;
        const rawPf = Number(row.pf);
        const pfValue =
          Number.isFinite(rawPf) && rawPf > 0
            ? Math.min(Math.max(rawPf, 0.1), 1)
            : getRecommendedFixturePf(fixtureType);
        return { ...row, fixtureType, pf: pfValue.toFixed(2) };
      });
      const rowsWithTotals = preparedRows.map((row) => ({
        ...row,
        totalWatts:
          (Number.parseFloat(row.quantity || "0") || 0) *
          (Number.parseFloat(row.watts || "0") || 0),
      }));
      rawApparentPowerVa = calculateMixedLoadApparentPower(rowsWithTotals, (row) =>
        Number(row.pf) || getRecommendedFixturePf(row.fixtureType),
      );
    }

    return createCalculatedPowerTable({
      components,
      currentTable: {
        rows: preparedRows,
        position: resolvedPosition,
        customPosition: resolvedCustomPosition,
      },
      id: Date.now(),
      name: tableName,
      pduOptions,
      rawApparentPowerVa,
      settings,
      tablePatch: {
        customPduType: pduOverride,
        includesHoist,
        stageName: selectedStage?.name ?? null,
        stageNumber: selectedStage?.number ?? null,
        snapshotSafetyMargin: settings.safetyMargin,
        snapshotPhaseMode: settings.phaseMode,
        snapshotVoltage: settings.voltage,
        snapshotPowerFactor: settings.powerFactor,
      },
    }) as PowerTable;
  };

  const persistOverrideUpdate = async (table: PowerTable, overrideId: string) => {
    await updatePowerOverride({
      id: overrideId,
      data: {
        table_name: table.name,
        total_watts: table.totalWatts || 0,
        current_per_phase: table.currentPerPhase || 0,
        pdu_type: table.customPduType || table.pduType || "",
        custom_pdu_type: table.customPduType,
        position: table.position || null,
        custom_position: table.customPosition || null,
        includes_hoist: table.includesHoist || false,
        override_data: buildPowerTableData(table, getTableSnapshotSettings(table)),
      },
    });
  };

  // FOH schuko is a report-level setting; persist it onto each default table's
  // metadata (when the department supports it) so it is remembered per set.
  const fohSchukoSetting = () =>
    features.fohSchuko ? fohSchukoRequired : undefined;

  const persistDefaultTableUpdate = async (table: PowerTable) => {
    if (!table.defaultTableId) return;
    const settings = getTableSnapshotSettings(table);
    await updateTourDefaultTable({
      tableId: table.defaultTableId,
      updates: {
        table_name: table.name,
        table_data: buildPowerTableData(table, settings),
        total_value: table.totalWatts || 0,
        metadata: buildPowerTableMetadata(table, {
          ...settings,
          fohSchuko: fohSchukoSetting(),
        }),
      },
    });
    await syncDefaultDocumentsAfterMutation();
  };

  const generateTable = async () => {
    if (!tableName) {
      toast({
        title: labels.toastMissingNameTitle,
        description: labels.toastMissingNameBody,
        variant: "destructive",
      });
      return;
    }

    const builtTable = buildTableFromBuilder();

    try {
      if (editing?.kind === "override") {
        await persistOverrideUpdate(builtTable, editing.id);
        toast({ title: labels.toastSuccess, description: labels.toastOverrideUpdated });
        resetCurrentTable();
        return;
      }

      if (editing?.kind === "default") {
        const updatedDefaultTable: PowerTable = {
          ...builtTable,
          id: `new-default-${editing.id}`,
          isDefault: true,
          defaultTableId: editing.id,
        };
        await persistDefaultTableUpdate(updatedDefaultTable);
        toast({ title: labels.toastSuccess, description: labels.toastDefaultSaved });
        resetCurrentTable();
        return;
      }

      if (editing?.kind === "table") {
        const original = tables.find((table) => table.id === editing.id);
        if (original) {
          const merged: PowerTable = {
            ...builtTable,
            id: original.id,
            powerRequirementId: original.powerRequirementId,
            generationTimestamp: original.generationTimestamp,
            stageNumber: original.stageNumber ?? builtTable.stageNumber,
            stageName: original.stageName ?? builtTable.stageName,
            isDefault: original.isDefault,
            defaultTableId: original.defaultTableId,
            isOverride: original.isOverride,
            overrideId: original.overrideId,
          };
          setTables((prev) =>
            prev.map((table) => (table.id === editing.id ? merged : table)),
          );
          if (isTourDefaults && merged.defaultTableId) {
            await persistDefaultTableUpdate(merged);
          } else if (isOverrideMode && merged.overrideId) {
            await persistOverrideUpdate(merged, merged.overrideId);
            toast({ title: labels.toastSuccess, description: labels.toastOverrideUpdated });
          }
        }
        resetCurrentTable();
        return;
      }

      if (isOverrideMode && !isTourDefaults) {
        if (!overrideTourDateId) return;
        const created = await createPowerOverride(
          buildPowerOverridePayload({
            department,
            settings: getPowerSettings(),
            table: builtTable,
            tourDateId: overrideTourDateId,
          }),
        );
        toast({ title: labels.toastSuccess, description: labels.toastOverrideSaved });
        setTables((prev) => [
          ...prev,
          { ...builtTable, isOverride: true, overrideId: created?.id },
        ]);
        resetCurrentTable();
        return;
      }

      setTables((prev) => [...prev, builtTable]);
      resetCurrentTable();
    } catch (error: unknown) {
      console.error("Error saving consumos table:", error);
      toast({
        title: labels.toastError,
        description:
          editing?.kind === "override" || isOverrideMode
            ? labels.toastOverrideSaveError
            : getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const removeTable = (tableId: number | string) => {
    const tableToRemove = tables.find((table) => table.id === tableId);
    if (!tableToRemove) {
      toast({
        title: labels.toastError,
        description: labels.toastTableNotFound,
        variant: "destructive",
      });
      return;
    }
    setTables((prev) => prev.filter((table) => table.id !== tableId));
    if (editing?.kind === "table" && editing.id === tableId) {
      resetCurrentTable();
    }
  };

  const updateTableSettings = (tableId: number | string, updates: Partial<PowerTable>) => {
    const existingTable = tables.find((table) => table.id === tableId);
    if (!existingTable) return;

    const updatedTable = { ...existingTable, ...updates };
    setTables((prev) =>
      prev.map((table) => (table.id === tableId ? updatedTable : table)),
    );

    if (isTourDefaults && updatedTable.defaultTableId) {
      void persistDefaultTableUpdate(updatedTable);
    } else if (isOverrideMode && updatedTable.overrideId) {
      void persistOverrideUpdate(updatedTable, updatedTable.overrideId).catch((error) => {
        console.error("Error saving override table settings:", error);
      });
    }
  };

  // Tour defaults persistence
  const pendingSetIdRef = useRef<Promise<string> | null>(null);

  const getOrCreateDefaultSetId = async (): Promise<string> => {
    if (selectedDefaultSetId) {
      return selectedDefaultSetId;
    }
    if (pendingSetIdRef.current) return pendingSetIdRef.current;

    const trimmedSetName = newDefaultSetName.trim();
    if (!trimmedSetName) {
      throw new Error("Select an existing default set or enter a name to create one.");
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

  const computeDisplayTotals = (
    totalWatts: number,
    rows: PowerTableRow[],
    snapshot: { pf?: number; safetyMargin?: number },
  ) => {
    const margin = snapshot.safetyMargin ?? safetyMargin;
    const adjustedWatts = totalWatts * (1 + margin / 100);
    const snapshotPf = snapshot.pf ?? (perRowPf ? undefined : pf);
    let totalVa = adjustedWatts;
    if (snapshotPf && snapshotPf > 0) {
      totalVa = adjustedWatts / snapshotPf;
    } else if (perRowPf && rows.length > 0) {
      const rawVa = calculateMixedLoadApparentPower(rows, (row) => {
        const rowPf = Number(row.pf);
        return Number.isFinite(rowPf) && rowPf > 0 ? rowPf : 0.9;
      });
      totalVa = rawVa * (1 + margin / 100);
    } else if (perRowPf) {
      totalVa = adjustedWatts / 0.9;
    }
    return { adjustedWatts, totalVa };
  };

  const mapTourDefaultTableToPowerTable = (
    table: TourDefaultTable,
  ): PowerTable => {
    const rows: PowerTableRow[] = table.table_data?.rows || [];
    const snapshot = {
      pf: table.metadata?.pf ?? table.table_data?.pf,
      safetyMargin: table.metadata?.safetyMargin ?? table.table_data?.safetyMargin,
    };
    const { adjustedWatts, totalVa } = computeDisplayTotals(
      table.total_value || 0,
      rows,
      snapshot,
    );
    return {
      id: `new-default-${table.id}`,
      name: table.table_name,
      rows,
      totalWatts: table.total_value,
      adjustedWatts,
      totalVa,
      currentPerPhase: table.metadata?.current_per_phase || 0,
      pduType: table.metadata?.pdu_type || "",
      customPduType: table.metadata?.custom_pdu_type || undefined,
      position: table.metadata?.position || undefined,
      customPosition: table.metadata?.custom_position || undefined,
      includesHoist: table.metadata?.includes_hoist || false,
      snapshotSafetyMargin: table.metadata?.safetyMargin ?? table.table_data?.safetyMargin,
      snapshotPhaseMode: table.metadata?.phaseMode ?? table.table_data?.phaseMode,
      snapshotVoltage: table.metadata?.voltage ?? table.table_data?.voltage,
      snapshotPowerFactor: table.metadata?.pf ?? table.table_data?.pf,
      isDefault: true,
      defaultTableId: table.id,
    } as PowerTable;
  };

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
        pf: legacyDefault.metadata?.pf ?? legacyDefault.pf,
        safetyMargin: legacyDefault.metadata?.safetyMargin ?? legacyDefault.safetyMargin,
      };
      const { adjustedWatts, totalVa } = computeDisplayTotals(
        legacyDefault.total_watts || 0,
        [],
        snapshot,
      );
      return {
        id: `legacy-default-${legacyDefault.id}`,
        name: legacyDefault.table_name,
        rows: [] as PowerTableRow[],
        totalWatts: legacyDefault.total_watts,
        adjustedWatts,
        totalVa,
        currentPerPhase: legacyDefault.current_per_phase,
        pduType: legacyDefault.pdu_type,
        customPduType: legacyDefault.custom_pdu_type,
        position: legacyDefault.position ?? undefined,
        customPosition: legacyDefault.custom_position ?? undefined,
        includesHoist: legacyDefault.includes_hoist,
        isDefault: true,
      } as PowerTable;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSets.length, defaultTables, selectedDefaultSetId, legacyTourDefaults, features.legacyTourDefaultsFallback, safetyMargin, pf]);

  // Read-only defaults shown in URL override mode
  const readOnlyDefaultTables: PowerTable[] = useMemo(() => {
    if (!isUrlOverrideMode || !overrideData) return [];
    return (overrideData.defaults as ReadOnlyPowerDefault[])
      .filter((table) => table.table_type === "power")
      .map((table) => {
        const rows: PowerTableRow[] = table.table_data?.rows || [];
        const snapshot = {
          pf: table.metadata?.pf ?? table.table_data?.pf,
          safetyMargin: table.metadata?.safetyMargin ?? table.table_data?.safetyMargin,
        };
        const { adjustedWatts, totalVa } = computeDisplayTotals(
          table.total_value || 0,
          rows,
          snapshot,
        );
        return {
          id: `default-${table.id}`,
          name: `${table.table_name} (Default)`,
          rows,
          totalWatts: table.total_value,
          adjustedWatts,
          totalVa,
          currentPerPhase: table.metadata?.current_per_phase,
          pduType: table.metadata?.pdu_type,
          customPduType: table.metadata?.custom_pdu_type,
          position: table.metadata?.position,
          customPosition: table.metadata?.custom_position,
          includesHoist: table.metadata?.includes_hoist || false,
          isDefault: true,
        } as PowerTable;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUrlOverrideMode, overrideData, safetyMargin, pf]);

  // Persisted overrides for this tour date (department-scoped)
  const overrideDisplayTables: PowerTable[] = useMemo(
    () =>
      powerOverrides
        .filter((override) => !override.department || override.department === department)
        .map((override) => {
          const rows: PowerTableRow[] = override.override_data?.rows || [];
          const snapshot = {
            pf: override.override_data?.pf,
            safetyMargin: override.override_data?.safetyMargin,
          };
          const { adjustedWatts, totalVa } = computeDisplayTotals(
            override.total_watts || 0,
            rows,
            snapshot,
          );
          return {
            id: `override-${override.id}`,
            name: override.table_name,
            rows,
            totalWatts: override.total_watts,
            adjustedWatts,
            totalVa,
            currentPerPhase: override.current_per_phase,
            pduType: override.pdu_type,
            customPduType: override.custom_pdu_type,
            position: override.position ?? undefined,
            customPosition: override.custom_position ?? undefined,
            includesHoist: override.includes_hoist,
            isOverride: true,
            overrideId: override.id,
          } as PowerTable;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [powerOverrides, department, safetyMargin, pf],
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
      const totalSystemWatts = exportTables.reduce(
        (sum, table) => sum + (table.totalWatts || 0),
        0,
      );
      const totalSystemAmps = exportTables.reduce(
        (sum, table) => sum + (table.currentPerPhase || 0),
        0,
      );
      const totalSystemKva =
        exportTables.reduce(
          (sum, table) => sum + (table.totalVa || table.totalWatts || 0),
          0,
        ) / 1000;

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
          phaseMode: table.snapshotPhaseMode ?? phaseMode,
        })),
        "power",
        headerTitle,
        pdfDate,
        undefined,
        { totalSystemWatts, totalSystemAmps, totalSystemKva },
        safetyMargin,
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
    } catch (error: any) {
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
    tourInfo: getTourInfo(),
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
