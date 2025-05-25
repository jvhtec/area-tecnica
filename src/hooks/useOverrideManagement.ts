
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTourDateOverrides } from '@/hooks/useTourDateOverrides';

interface OverrideTable {
  id?: number | string;
  name: string;
  rows: any[];
  totalWeight?: number;
  totalWatts?: number;
  currentPerPhase?: number;
  pduType?: string;
  customPduType?: string;
  includesHoist?: boolean;
  isOverride?: boolean;
  overrideId?: string;
  defaultTableId?: string;
}

export const useOverrideManagement = (
  tourDateId: string | null,
  department: string,
  type: 'weight' | 'power'
) => {
  const { toast } = useToast();
  const [unsavedTables, setUnsavedTables] = useState<OverrideTable[]>([]);
  const [isJobOverrideMode, setIsJobOverrideMode] = useState(false);
  const [selectedJobTourDateId, setSelectedJobTourDateId] = useState<string | null>(null);

  const {
    weightOverrides,
    powerOverrides,
    createWeightOverride,
    createPowerOverride,
    deleteOverride,
    isLoading: overridesLoading
  } = useTourDateOverrides(tourDateId || selectedJobTourDateId || '', type);

  const addUnsavedTable = useCallback((table: OverrideTable) => {
    setUnsavedTables(prev => [...prev, { ...table, isOverride: true }]);
  }, []);

  const removeUnsavedTable = useCallback((tableId: number | string) => {
    setUnsavedTables(prev => prev.filter(table => table.id !== tableId));
  }, []);

  const saveAllOverrides = useCallback(async () => {
    if (unsavedTables.length === 0) {
      toast({
        title: 'No changes to save',
        description: 'There are no unsaved override tables.',
        variant: 'destructive',
      });
      return false;
    }

    const targetTourDateId = tourDateId || selectedJobTourDateId;
    if (!targetTourDateId) {
      toast({
        title: 'Missing tour date',
        description: 'Cannot save overrides without a tour date ID.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      for (const table of unsavedTables) {
        if (type === 'weight') {
          await createWeightOverride({
            tour_date_id: targetTourDateId,
            default_table_id: table.defaultTableId,
            item_name: table.name,
            weight_kg: table.totalWeight || 0,
            quantity: 1,
            category: null,
            department,
            override_data: {
              tableData: table,
              toolType: 'pesos'
            }
          });
        } else {
          await createPowerOverride({
            tour_date_id: targetTourDateId,
            default_table_id: table.defaultTableId,
            table_name: table.name,
            total_watts: table.totalWatts || 0,
            current_per_phase: table.currentPerPhase || 0,
            pdu_type: table.pduType || '',
            custom_pdu_type: table.customPduType,
            includes_hoist: table.includesHoist || false,
            department,
            override_data: {
              tableData: table,
              toolType: 'consumos'
            }
          });
        }
      }

      setUnsavedTables([]);
      toast({
        title: 'Success',
        description: `${unsavedTables.length} override table(s) saved successfully.`,
      });
      return true;
    } catch (error: any) {
      console.error('Error saving overrides:', error);
      toast({
        title: 'Error',
        description: 'Failed to save override tables.',
        variant: 'destructive',
      });
      return false;
    }
  }, [
    unsavedTables,
    tourDateId,
    selectedJobTourDateId,
    department,
    type,
    createWeightOverride,
    createPowerOverride,
    toast
  ]);

  const deleteOverrideTable = useCallback(async (overrideId: string) => {
    try {
      await deleteOverride({ id: overrideId, table: type });
      toast({
        title: 'Success',
        description: 'Override table deleted successfully.',
      });
      return true;
    } catch (error: any) {
      console.error('Error deleting override:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete override table.',
        variant: 'destructive',
      });
      return false;
    }
  }, [deleteOverride, type, toast]);

  const setJobOverrideContext = useCallback((jobTourDateId: string | null) => {
    setSelectedJobTourDateId(jobTourDateId);
    setIsJobOverrideMode(!!jobTourDateId);
  }, []);

  const existingOverrides = type === 'weight' ? weightOverrides : powerOverrides;

  return {
    unsavedTables,
    existingOverrides,
    addUnsavedTable,
    removeUnsavedTable,
    saveAllOverrides,
    deleteOverrideTable,
    setJobOverrideContext,
    isJobOverrideMode,
    hasUnsavedChanges: unsavedTables.length > 0,
    overridesLoading
  };
};
