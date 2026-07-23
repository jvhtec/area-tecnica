import { useEffect, useRef, useState } from "react";

import {
  calculateMixedLoadApparentPower,
  createCalculatedPowerTable,
  getPowerPduOptions,
  getVoltageForPhase,
  PowerCalculationValidationError,
} from "@/features/technical-tools/power/powerCalculations";
import {
  buildPowerOverridePayload,
  buildPowerTableData,
  buildPowerTableMetadata,
} from "@/features/technical-tools/power/powerPersistence";
import { parsePowerCalculationSnapshot } from "@/features/technical-tools/power/powerSnapshots";
import type {
  PhaseMode,
  PowerElectricalSettings,
  PowerTable,
  PowerTableRow,
} from "@/features/technical-tools/power/types";
import { isSameTechnicalStage } from "@/features/technical-tools/stage/stageAllocation";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import type { useToast } from "@/hooks/use-toast";
import type {
  TourDatePowerOverrideData,
  useTourDateOverrides,
} from "@/hooks/useTourDateOverrides";
import type { useTourDefaultSets } from "@/hooks/useTourDefaultSets";
import { dataLayerClient } from "@/services/dataLayerClient";
import {
  CUSTOM_POWER_POSITION_VALUE,
  NO_POWER_POSITION_VALUE,
} from "@/utils/powerPositions";
import type { Dispatch, SetStateAction } from "react";
import {
  DEFAULT_FIXTURE_TYPE,
  FIXTURE_PF,
  type ConsumosComponent,
  type ConsumosDepartmentConfig,
  type FixtureType,
} from "./config";
import type { ConsumosJob } from "./consumosUtils";
import type { CustomPowerComponentInput } from "./useCustomPowerComponents";
import {
  mapPowerRequirementRowToTable,
  useJobPowerRequirementTables,
} from "./useJobPowerRequirementTables";
import { useXmlpPowerImport } from "./useXmlpPowerImport";

const DEFAULT_PDU_SELECT_VALUE = "default";
const CUSTOM_PDU_SELECT_VALUE = "Custom";

type EditingTarget =
  | { kind: "table"; id: number | string }
  | { kind: "default"; id: string }
  | { kind: "override"; id: string };

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown error";

const getRecommendedFixturePf = (fixtureType?: string): number =>
  FIXTURE_PF[(fixtureType as FixtureType) || DEFAULT_FIXTURE_TYPE]?.pf ??
  FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf;

interface UseConsumosBuilderOptions {
  components: ConsumosComponent[];
  config: ConsumosDepartmentConfig;
  createComponent: (input: CustomPowerComponentInput) => Promise<ConsumosComponent>;
  createPowerOverride: ReturnType<
    typeof useTourDateOverrides
  >["createPowerOverride"];
  department: ConsumosDepartmentConfig["department"];
  features: ConsumosDepartmentConfig["features"];
  isNormalMode: boolean;
  isOverrideMode: boolean;
  isTourDefaults: boolean;
  jobIdFromUrl: string | null;
  jobs: ConsumosJob[] | undefined;
  labels: ConsumosDepartmentConfig["labels"];
  overrideTourDateId: string;
  perRowPf: boolean;
  selectedJobId: string;
  selectedStage: TechnicalStage | null | undefined;
  setSelectedJob: Dispatch<SetStateAction<ConsumosJob | null>>;
  setSelectedJobId: Dispatch<SetStateAction<string>>;
  syncDefaultDocumentsAfterMutation: () => Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
  updatePowerOverride: ReturnType<
    typeof useTourDateOverrides
  >["updatePowerOverride"];
  updateTourDefaultTable: ReturnType<
    typeof useTourDefaultSets
  >["updateTable"];
}

export function useConsumosBuilder({
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
}: UseConsumosBuilderOptions) {
  // Electrical settings
  const [safetyMargin, setSafetyMargin] = useState(config.defaultSafetyMargin);
  const [phaseMode, setPhaseModeState] = useState<PhaseMode>("three");
  const [voltage, setVoltage] = useState<number>(getVoltageForPhase("three"));
  const [pf, setPf] = useState<number>(config.defaultPowerFactor ?? 0.9);
  const [fohSchukoRequired, setFohSchukoRequired] = useState<boolean>(true);

  const setPhaseMode = (nextPhaseMode: PhaseMode) => {
    setPhaseModeState(nextPhaseMode);
    setVoltage(getVoltageForPhase(nextPhaseMode));
  };

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
  }, [jobIdFromUrl, jobs, setSelectedJob, setSelectedJobId]);

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
        fallbackPowerFactor: config.defaultPowerFactor ?? 0.9,
        fallbackSafetyMargin: config.defaultSafetyMargin,
        perRowPf,
      }),
    );
    setLoadedSavedCount(savedTables.length);
    if (savedTables.length === 0) return;

    // Keep any tables the user built before picking the job
    setTables((prev) => [...savedTables, ...prev.filter((table) => !table.powerRequirementId)]);
  }, [
    savedTablesQuery.data,
    selectedJobId,
    isNormalMode,
    department,
    perRowPf,
    config.defaultPowerFactor,
    config.defaultSafetyMargin,
  ]);

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
    safetyMargin: table.calculation?.safetyMargin ?? safetyMargin,
    phaseMode: table.calculation?.phaseMode ?? phaseMode,
    voltage: table.calculation?.voltage ?? voltage,
    ...(perRowPf
      ? {}
      : {
          powerFactor: table.calculation?.powerFactor ?? pf,
        }),
  });

  // XMLP amplifier-power import (Soundvision projects, sound department only)
  const { isImportingXmlp, importXmlpPower, addPrebuiltMonitorPdu } = useXmlpPowerImport({
    components,
    pduOptions,
    getSettings: getPowerSettings,
    selectedStage: selectedStage ?? null,
    onTablesImported: (importedTables) => setTables((prev) => [...prev, ...importedTables]),
    onMonitorPduCreated: (table) => setTables((prev) => [...prev, table]),
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
    const tableSettings = getTableSnapshotSettings(table);
    const tablePduOptions = getPowerPduOptions(department, tableSettings.phaseMode);
    setSafetyMargin(tableSettings.safetyMargin);
    setPhaseModeState(tableSettings.phaseMode);
    setVoltage(tableSettings.voltage);
    if (tableSettings.powerFactor !== undefined) setPf(tableSettings.powerFactor);
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
      if (tablePduOptions.includes(table.customPduType)) {
        setSelectedPduType(table.customPduType);
        setCustomPduType("");
      } else {
        setSelectedPduType(CUSTOM_PDU_SELECT_VALUE);
        setCustomPduType(table.customPduType);
      }
    } else if (table.pduType && tablePduOptions.includes(table.pduType)) {
      setSelectedPduType(table.pduType);
      setCustomPduType("");
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
    pdu_type?: string | null;
    includes_hoist?: boolean;
    override_data?: {
      rows?: PowerTableRow[];
      safetyMargin?: number;
      phaseMode?: PhaseMode;
      voltage?: number;
      pf?: number;
      calculation?: unknown;
    };
  }) => {
    const storedCalculation = parsePowerCalculationSnapshot(
      override.override_data?.calculation,
    );
    const restoredPhase =
      storedCalculation?.phaseMode ?? override.override_data?.phaseMode ?? phaseMode;
    const restoredPduOptions = getPowerPduOptions(department, restoredPhase);
    setSafetyMargin(
      storedCalculation?.safetyMargin ??
        override.override_data?.safetyMargin ??
        safetyMargin,
    );
    setPhaseModeState(restoredPhase);
    setVoltage(
      storedCalculation?.voltage ??
        override.override_data?.voltage ??
        getVoltageForPhase(restoredPhase),
    );
    if (!perRowPf) {
      setPf(storedCalculation?.powerFactor ?? override.override_data?.pf ?? pf);
    }
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
      if (restoredPduOptions.includes(override.custom_pdu_type)) {
        setSelectedPduType(override.custom_pdu_type);
        setCustomPduType("");
      } else {
        setSelectedPduType(CUSTOM_PDU_SELECT_VALUE);
        setCustomPduType(override.custom_pdu_type);
      }
    } else if (override.pdu_type && restoredPduOptions.includes(override.pdu_type)) {
      setSelectedPduType(override.pdu_type);
      setCustomPduType("");
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
        const resolvedPf = row.pf?.trim()
          ? row.pf
          : getRecommendedFixturePf(fixtureType).toFixed(2);
        return { ...row, fixtureType, pf: resolvedPf };
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
        override_data: buildPowerTableData(
          table,
          getTableSnapshotSettings(table),
        ) as unknown as TourDatePowerOverrideData,
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

    try {
      const builtTable = buildTableFromBuilder();
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
          }) as Omit<
            import("@/hooks/useTourDateOverrides").TourDatePowerOverride,
            "id" | "created_at" | "updated_at"
          >,
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
          error instanceof PowerCalculationValidationError
            ? labels.toastInvalidCalculation
            : editing?.kind === "override" || isOverrideMode
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

  return {
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
  };
}
