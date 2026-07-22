/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, type Dispatch, type SetStateAction } from "react";
import { assignSuffixes, createRowId, deriveBaseName, type Table } from "@/pages/pesos-tool/pesosToolModel";

type Options = {
  defaultSets: any[];
  defaultTables: any[];
  isDefaults: boolean;
  isTourDefaults: boolean;
  isTourDateContext: boolean;
  selectedDefaultSetId: string;
  setTables: Dispatch<SetStateAction<Table[]>>;
  weightOverrides: any[];
};

export const usePesosLoadedTables = ({ defaultSets, defaultTables, isDefaults, isTourDefaults, isTourDateContext, selectedDefaultSetId, setTables, weightOverrides }: Options) => {
  // Load existing tour defaults when in defaults mode.
  // Also runs for the tour-defaults entry (Tour Management page) so existing
  // tables are shown and newly generated ones append after them with
  // continuous SX numbering instead of restarting from the first number.
  useEffect(() => {
    if (!isDefaults && !isTourDefaults) return;

    const resolvedDefaultSetId =
      selectedDefaultSetId || (defaultSets.length === 1 ? defaultSets[0].id : '');

    if (!resolvedDefaultSetId) {
      setTables([]);
      return;
    }

    // Convert only the active set. Loading every set at once makes SX numbering
    // bleed across packages/default sets; Consumos intentionally gates display
    // the same way when more than one set exists.
    const convertedTables = defaultTables
      .filter(dt => dt.table_type === 'weight' && dt.set_id === resolvedDefaultSetId)
      .map((dt, index) => ({
        name: dt.table_name,
        rows: (dt.table_data?.rows || [{
          quantity: '1',
          componentId: '',
          weight: dt.total_value.toString(),
          componentName: dt.table_name,
          totalWeight: dt.total_value
        }]).map((row: any) => ({ ...row, id: row?.id || createRowId() })),
        totalWeight: dt.total_value,
        id: Date.now() + index,
        clusterId: dt.metadata?.clusterId,
        dualMotors: dt.metadata?.dualMotors,
        riggingPoints: dt.metadata?.riggingPoints,
        cablePick: Boolean(dt.metadata?.cablePick ?? dt.table_data?.cablePick ?? false),
        cablePickWeight: (dt.metadata?.cablePickWeight ?? dt.table_data?.cablePickWeight ?? "100").toString(),
        defaultTableId: dt.id,
        baseName: dt.metadata?.baseName || deriveBaseName(dt.table_name)
      }));
    setTables(assignSuffixes(convertedTables));
  }, [isDefaults, isTourDefaults, defaultSets, defaultTables, selectedDefaultSetId, setTables]);

  // Load tour date overrides when in tour date context
  useEffect(() => {
    if (isTourDateContext && weightOverrides.length > 0) {
      const convertedTables = weightOverrides.map((override, index) => ({
        name: override.item_name,
        rows: (override.override_data?.tableData?.rows || [{
          quantity: override.quantity.toString(),
          componentId: '',
          weight: override.weight_kg.toString(),
          componentName: override.item_name,
          totalWeight: override.weight_kg * override.quantity
        }]).map((row: any) => ({ ...row, id: row?.id || createRowId() })),
        totalWeight: override.weight_kg * override.quantity,
        id: Date.now() + index,
        clusterId: override.override_data?.tableData?.clusterId,
        dualMotors: override.override_data?.tableData?.dualMotors,
        riggingPoints: override.override_data?.tableData?.riggingPoints,
        cablePick: Boolean(override.override_data?.tableData?.cablePick ?? false),
        cablePickWeight: (override.override_data?.tableData?.cablePickWeight ?? "100").toString(),
        overrideId: override.id,
        baseName:
          override.override_data?.tableData?.baseName ||
          deriveBaseName(override.item_name)
      }));
      setTables(assignSuffixes(convertedTables));
    }
  }, [isTourDateContext, setTables, weightOverrides]);
};
