import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  deleteJobPowerRequirementTable,
  resolveRetiredPowerRequirementIds,
} from "@/features/technical-tools/power/powerPersistence";
import type {
  PowerTable,
  TechnicalDepartment,
} from "@/features/technical-tools/power/types";
import { dataLayerClient } from "@/services/dataLayerClient";

import {
  jobPowerRequirementTablesQueryKey,
  mapPowerRequirementRowToTable,
  useJobPowerRequirementTables,
} from "./useJobPowerRequirementTables";

type UseSavedPowerRequirementTablesOptions = {
  department: TechnicalDepartment;
  fallbackPowerFactor: number;
  fallbackSafetyMargin: number;
  isNormalMode: boolean;
  perRowPf: boolean;
  selectedJobId: string;
  setTables: Dispatch<SetStateAction<PowerTable[]>>;
  /** The editor's current tables, used to work out which saved rows a save retires. */
  tables: PowerTable[];
};

/**
 * Owns the saved `power_requirement_tables` rows behind the Consumos editor:
 * loading them into the builder once per job/department, tracking which rows
 * the editor is holding, and deleting a row when its table is removed.
 */
export function useSavedPowerRequirementTables({
  department,
  fallbackPowerFactor,
  fallbackSafetyMargin,
  isNormalMode,
  perRowPf,
  selectedJobId,
  setTables,
  tables,
}: UseSavedPowerRequirementTablesOptions) {
  const queryClient = useQueryClient();
  // Load the saved power requirement set for the job so it can be edited
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
        fallbackPowerFactor,
        fallbackSafetyMargin,
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
    fallbackPowerFactor,
    fallbackSafetyMargin,
    setTables,
  ]);

  const loadedPowerRequirementIds = useMemo(
    () => (savedTablesQuery.data ?? []).map((row) => row.id),
    [savedTablesQuery.data],
  );

  /** Persisted rows the next save of `savingTables` replaces — see the helper. */
  const getRetiredPowerRequirementIds = (savingTables: PowerTable[]) =>
    resolveRetiredPowerRequirementIds({
      loadedIds: loadedPowerRequirementIds,
      savingTables,
      tables,
    });

  /**
   * Deletes the row a table was loaded from. Returns `false` when the delete
   * failed, so the caller can keep showing the table instead of hiding a row
   * that is still in the database.
   */
  const deletePersistedTable = useCallback(
    async (table: PowerTable): Promise<boolean> => {
      if (!isNormalMode || !selectedJobId || !table.powerRequirementId) return true;

      try {
        await deleteJobPowerRequirementTable({
          client: dataLayerClient,
          jobId: selectedJobId,
          table,
        });
      } catch (error) {
        console.error("Error deleting saved power requirement table:", error);
        return false;
      }

      // The hydration guard above only fires once per job, so the badge count
      // has to be adjusted here or it keeps advertising the deleted row.
      setLoadedSavedCount((previous) => Math.max(0, previous - 1));
      await queryClient.invalidateQueries({
        queryKey: jobPowerRequirementTablesQueryKey(selectedJobId, department),
      });
      return true;
    },
    [department, isNormalMode, queryClient, selectedJobId],
  );

  return {
    deletePersistedTable,
    getRetiredPowerRequirementIds,
    loadedSavedCount,
  };
}
