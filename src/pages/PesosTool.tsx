import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJobSelection, JobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { dataLayerClient } from '@/services/dataLayerClient';
import { useSearchParams } from 'react-router-dom';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import { useTourDateOverrides } from '@/hooks/useTourDateOverrides';
import { PesosToolView } from './pesos-tool/PesosToolView';
import { calculateWeightRows, sumWeightRows } from '@/features/technical-tools/weights/weightCalculations';
import {
  isSameTechnicalStage,
  useSelectedTechnicalStage,
} from '@/features/technical-tools/stage/stageAllocation';
import type { TechnicalStage } from '@/features/technical-tools/stage/stageUtils';
import { CopyToStageMenu } from '@/features/technical-tools/table-presets/CopyToStageMenu';
import { QuickPresetsMenu } from '@/features/technical-tools/table-presets/QuickPresetsMenu';
import type { TourPackageSize } from '@/utils/tourPackages';
import { optimizedInvalidation, queryKeys } from '@/lib/react-query';
import { syncTourDefaultDocuments, toastTourDefaultDocumentNoUpdate } from '@/utils/tourDefaultDocumentSync';
import {
  cloneTablesToStage,
  remapClusterIds,
  toPresetSnapshot,
} from '@/features/technical-tools/table-presets/stageCopy';
import {
  useQuickPresets,
  type QuickPreset,
} from '@/features/technical-tools/table-presets/useQuickPresets';
import { XmlpWeightImportButton } from '@/features/technical-tools/weights/XmlpWeightImportButton';
import { soundWeightComponents } from '@/features/technical-tools/weights/soundWeightComponents';
import { useXmlpWeightImport } from '@/features/technical-tools/weights/useXmlpWeightImport';

const soundComponentDatabase = soundWeightComponents;
import { assignSuffixes, createEmptyRow, type Table, type TableRow } from "@/pages/pesos-tool/pesosToolModel";
import { usePesosPdfExport } from "@/pages/pesos-tool/usePesosPdfExport";
import { usePesosLoadedTables } from "@/pages/pesos-tool/usePesosLoadedTables";
import { usePesosContext } from "@/features/technical-tools/weights/usePesosContext";

const PesosTool: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');

  // Tour context detection - UPDATED TOUR DEFAULTS MODE DETECTION
  const tourId = searchParams.get('tourId');
  const tourDateId = searchParams.get('tourDateId');
  const mode = searchParams.get('mode');
  const isDefaults = mode === 'defaults';
  const isTourDefaults = mode === 'tour-defaults'; // Tour defaults mode
  const isTourContext = !!tourId;
  const isTourDateContext = !!tourDateId;

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [useDualMotors, setUseDualMotors] = useState(false);
  const [mirroredCluster, setMirroredCluster] = useState(false);
  const [cablePick, setCablePick] = useState(false);
  const [cablePickWeight, setCablePickWeight] = useState('100');
  const [currentSetName, setCurrentSetName] = useState('');

  const { handleBackNavigation, isJobOverrideMode, jobTourInfo, tourDateInfo, tourName } = usePesosContext({
    selectedJob,
    isTourContext,
    tourId,
    tourDateId,
  });
  const {
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages: jobStages,
  } = useSelectedTechnicalStage({
    enabled: Boolean(selectedJobId) && !isTourContext && !isTourDefaults && !isJobOverrideMode,
    jobId: selectedJobId,
  });

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [createEmptyRow()],
  });


  const updateTablesState = (updater: (prev: Table[]) => Table[]): Table[] => {
    let nextTables: Table[] = [];
    setTables((prev) => {
      nextTables = assignSuffixes(updater(prev));
      return nextTables;
    });
    return nextTables;
  };

  const { isImportingXmlp, importXmlpWeights } = useXmlpWeightImport({
    components: soundComponentDatabase,
    existingTableIds: tables.flatMap((table) => typeof table.id === 'number' ? [table.id] : []),
    selectedStage: selectedStage ?? null,
    onTablesImported: (importedTables) =>
      updateTablesState((previous) => [...previous, ...importedTables]),
  });

  // Updated hooks for tour defaults
  const {
    defaultSets,
    defaultTables,
    createSet,
    createTable: createDefaultTable,
    deleteSet,
    deleteTable: deleteDefaultTable,
  } = useTourDefaultSets(tourId || '', 'sound');

  const [selectedDefaultSetId, setSelectedDefaultSetId] = useState<string>('');
  const [selectedDefaultPackageSize, setSelectedDefaultPackageSize] = useState<TourPackageSize | 'unassigned'>('unassigned');
  const [newDefaultSetName, setNewDefaultSetName] = useState('');

  const handleSelectedDefaultSetIdChange = (setId: string) => {
    setSelectedDefaultSetId(setId);
    const selectedSet = defaultSets.find((set) => set.id === setId);
    setSelectedDefaultPackageSize(selectedSet?.package_size || 'unassigned');
  };

  useEffect(() => {
    if (!isTourDefaults && !isDefaults) return;
    if (selectedDefaultSetId || defaultSets.length !== 1) return;
    setSelectedDefaultSetId(defaultSets[0].id);
    setSelectedDefaultPackageSize(defaultSets[0].package_size || 'unassigned');
  }, [defaultSets, isDefaults, isTourDefaults, selectedDefaultSetId]);

  const {
    weightOverrides,
    createWeightOverride,
    deleteOverride,
  } = useTourDateOverrides(tourDateId || '', 'weight');

  const syncDefaultDocumentsAfterMutation = async () => {
    if ((!isTourDefaults && !isDefaults) || !tourId) return;
    try {
      const result = await syncTourDefaultDocuments({ tourId });
      optimizedInvalidation.invalidateQueryKeys(queryClient, [
        queryKeys.scope('tour-documents', tourId),
        queryKeys.scope('jobcard-tour-documents'),
        queryKeys.scope('tour-documents-for-job'),
      ]);

      if (result.errors.length > 0) {
        toast({
          title: 'Aviso de sincronización de PDF',
          description: `${result.errors.length} documento(s) predeterminados no se pudieron actualizar.`,
          variant: 'destructive',
        });
      } else { toastTourDefaultDocumentNoUpdate(result, toast); }
    } catch (error) {
      console.error('Error syncing tour default documents:', error);
      toast({
        title: 'Aviso de sincronización de PDF',
        description: 'No se pudieron actualizar los PDF predeterminados del paquete.',
        variant: 'destructive',
      });
    }
  };

  // Get tour name for display
  const activeTables = selectedStage
    ? tables.filter((table) => isSameTechnicalStage(table.stageNumber, selectedStage))
    : tables;

  // --- Stage copy & quick presets (normal job mode only) ---
  const isNormalJobMode =
    !isTourContext && !isTourDefaults && !isTourDateContext && !isDefaults && !isJobOverrideMode;
  const {
    presets: quickPresets,
    savePreset,
    isSavingPreset,
    deletePreset,
  } = useQuickPresets<Table>('pesos', 'sound');

  const copyActiveSetToStage = (stage: TechnicalStage) => {
    if (activeTables.length === 0) return;
    // Fresh cluster ids so mirrored pairs/cable picks don't group with the
    // source tables; suffixes are recomputed per stage.
    const clones = remapClusterIds(cloneTablesToStage(activeTables, stage));
    setTables((prev) => assignSuffixes([...prev, ...clones]));
    toast({
      title: 'Success',
      description: `${clones.length} table(s) copied to ${stage.name}.`,
    });
  };

  const saveActiveSetAsPreset = async (name: string): Promise<boolean> => {
    if (activeTables.length === 0) return false;
    try {
      await savePreset({ name, tables: activeTables.map(toPresetSnapshot) });
      toast({ title: 'Success', description: 'Preset saved' });
      return true;
    } catch (error) {
      console.error('Error saving quick preset:', error);
      toast({
        title: 'Error',
        description: 'Failed to save the preset (is the name already in use?)',
        variant: 'destructive',
      });
      return false;
    }
  };

  const applyQuickPreset = (preset: QuickPreset<Table>) => {
    if (preset.tables.length === 0) return;
    const clones = remapClusterIds(cloneTablesToStage(preset.tables, selectedStage ?? null));
    setTables((prev) => assignSuffixes([...prev, ...clones]));
    toast({
      title: 'Success',
      description: `${clones.length} table(s) added from "${preset.name}".`,
    });
  };

  const removeQuickPreset = async (preset: QuickPreset<Table>) => {
    try {
      await deletePreset(preset.id);
      toast({ title: 'Success', description: 'Preset deleted' });
    } catch (error) {
      console.error('Error deleting quick preset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the preset',
        variant: 'destructive',
      });
    }
  };

  // Preselect job from query param and fetch details if not in the list
  useEffect(() => {
    const applyJobFromUrl = async () => {
      if (!jobIdFromUrl) return;
      try {
        setSelectedJobId(jobIdFromUrl);
        const found = (jobs || []).find((j) => j.id === jobIdFromUrl) as JobSelection | undefined;
        if (found) {
          setSelectedJob(found);
          return;
        }
        const { data, error } = await dataLayerClient.from('jobs')
          .select('id, title, start_time, end_time, tour_date_id')
          .eq('id', jobIdFromUrl)
          .single();
        if (!error && data) {
          setSelectedJob(data as unknown as JobSelection);
        }
      } catch (err) {
        console.error('Error applying job from URL:', err);
      }
    };
    applyJobFromUrl();
  }, [jobIdFromUrl, jobs]);

  // Helper function to get or create the set ID for sound department
  const getOrCreateSoundSetId = async (): Promise<string> => {
    if (selectedDefaultSetId) {
      return selectedDefaultSetId;
    }

    const trimmedName = (newDefaultSetName || currentSetName).trim();
    if (!trimmedName) {
      throw new Error('Select an existing default set or enter a name to create one.');
    }

    const newSet = await createSet({
      tour_id: tourId!,
      name: trimmedName,
      department: 'sound',
      description: 'Sound department weight defaults',
      package_size: selectedDefaultPackageSize === 'unassigned' ? null : selectedDefaultPackageSize
    });

    setSelectedDefaultSetId(newSet.id);
    setNewDefaultSetName('');
    return newSet.id;
  };

  const deleteSetAndSync = async (setId: string) => {
    await deleteSet(setId);
    await syncDefaultDocumentsAfterMutation();
  };


  usePesosLoadedTables({
    defaultSets,
    defaultTables,
    isDefaults,
    isTourDefaults,
    isTourDateContext,
    selectedDefaultSetId,
    setTables,
    weightOverrides,
  });


  const addRow = () => {
    setCurrentTable((prev) => ({
      ...prev,
      rows: [...prev.rows, createEmptyRow()],
    }));
  };

  const removeRow = (index: number) => {
    setCurrentTable((prev) => {
      const filteredRows = prev.rows.filter((_, i) => i !== index);
      return {
        ...prev,
        rows: filteredRows.length > 0 ? filteredRows : [createEmptyRow()],
      };
    });
  };

  const updateInput = (index: number, field: keyof TableRow, value: string) => {
    const newRows = [...currentTable.rows];
    if (field === 'componentId') {
      const component = soundComponentDatabase.find((c) => c.id.toString() === value);
      newRows[index] = {
        ...newRows[index],
        [field]: value,
        weight: component ? component.weight.toString() : '',
      };
    } else {
      newRows[index] = {
        ...newRows[index],
        [field]: value,
      };
    }
    setCurrentTable((prev) => ({
      ...prev,
      rows: newRows,
    }));
  };

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    const job = jobs?.find((j) => j.id === jobId) || null;
    setSelectedJob(job);
  };

  const saveAsDefaultSet = async () => {
    if (!tourId || !currentSetName || tables.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please enter a set name and create at least one table',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create the default set
      const defaultSet = await createSet({
        tour_id: tourId,
        name: currentSetName,
        description: `Weight calculation set with ${tables.length} tables`,
        department: 'sound',
        package_size: selectedDefaultPackageSize === 'unassigned' ? null : selectedDefaultPackageSize
      });

      // Save each table as a default table
      for (const table of tables) {
        await createDefaultTable({
          set_id: defaultSet.id,
          table_name: table.name,
          table_data: {
            rows: table.rows,
            toolType: 'pesos'
          },
          table_type: 'weight',
          total_value: table.totalWeight || 0,
          metadata: {
            dualMotors: table.dualMotors,
            riggingPoints: table.riggingPoints,
            clusterId: table.clusterId,
            baseName: table.baseName
          }
        });
      }

      await syncDefaultDocumentsAfterMutation();

      toast({
        title: 'Success',
        description: `Default set "${currentSetName}" saved successfully`,
      });

      // Reset form
      setCurrentSetName('');
      setTables([]);
      resetCurrentTable();
    } catch (error: any) {
      console.error('Error saving default set:', error);
      toast({
        title: 'Error',
        description: 'Failed to save default set',
        variant: 'destructive',
      });
    }
  };

  // UPDATED: Save as tour defaults using the new system
  const saveAsTourDefaults = async (
    table: Table,
    orderIndex?: number,
    options: { syncAfterSave?: boolean } = {}
  ): Promise<boolean> => {
    if (!tourId) return false;

    try {
      // Get or create the sound set ID
      const setId = await getOrCreateSoundSetId();

      // Create the table with detailed data and metadata
      const savedTable = await createDefaultTable({
        set_id: setId,
        table_name: table.name,
        table_data: {
          rows: table.rows,
          dualMotors: table.dualMotors,
          mirroredCluster: table.clusterId ? true : false,
          riggingPoints: table.riggingPoints,
          cablePick: table.cablePick,
          cablePickWeight: table.cablePickWeight,
          baseName: table.baseName
        },
        table_type: 'weight',
        total_value: table.totalWeight || 0,
        metadata: {
          dualMotors: table.dualMotors,
          riggingPoints: table.riggingPoints,
          clusterId: table.clusterId,
          cablePick: table.cablePick,
          cablePickWeight: table.cablePickWeight,
          baseName: table.baseName,
          ...(typeof orderIndex === 'number' ? { order_index: orderIndex } : {})
        }
      });

      setTables((previous) =>
        previous.map((candidate) =>
          candidate.id === table.id
            ? { ...candidate, defaultTableId: savedTable.id }
            : candidate
        )
      );

      toast({
        title: 'Success',
        description: 'Predeterminado de gira guardado correctamente',
      });
      if (options.syncAfterSave !== false) {
        await syncDefaultDocumentsAfterMutation();
      }
      return true;
    } catch (error: any) {
      console.error('Error saving tour default:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el predeterminado de gira',
        variant: 'destructive',
      });
      return false;
    }
  };

  const saveAsOverride = async (table: Table) => {
    // Job-based override mode
    if (isJobOverrideMode && selectedJob?.tour_date_id) {
      try {
        await createWeightOverride({
          tour_date_id: selectedJob.tour_date_id,
          default_table_id: table.defaultTableId,
          item_name: table.name,
          weight_kg: table.totalWeight || 0,
          quantity: 1,
          category: null,
          department: 'sound',
          override_data: {
            tableData: table,
            toolType: 'pesos'
          }
        });

        toast({
          title: 'Success',
          description: 'Override saved for tour date',
        });
        return;
      } catch (error: any) {
        console.error('Error saving override:', error);
        toast({
          title: 'Error',
          description: 'Failed to save override',
          variant: 'destructive',
        });
        return;
      }
    }

    if (!tourDateId) return;

    try {
      // Save the table as an override
      await createWeightOverride({
        tour_date_id: tourDateId,
        default_table_id: table.defaultTableId,
        item_name: table.name,
        weight_kg: table.totalWeight || 0,
        quantity: 1,
        category: null,
        department: 'sound',
        override_data: {
          tableData: table,
          toolType: 'pesos'
        }
      });

      toast({
        title: 'Success',
        description: 'Override saved for this tour date',
      });
    } catch (error: any) {
      console.error('Error saving override:', error);
      toast({
        title: 'Error',
        description: 'Failed to save override',
        variant: 'destructive',
      });
    }
  };

  const generateTable = async () => {
    if (!tableName) {
      toast({
        title: 'Missing table name',
        description: 'Please enter a name for the table',
        variant: 'destructive',
      });
      return;
    }

    // Calculate each row's total weight.
    const calculatedRows = calculateWeightRows(currentTable.rows, soundComponentDatabase);
    const totalWeight = sumWeightRows(calculatedRows);

    // For grouping, assign a new clusterId for this generation.
    const newClusterId = Date.now().toString();

    // FIXED: Always generate rigging points/suffixes for pesos tool, regardless of mode
    let tablesToCreate: Table[] = [];

    if (mirroredCluster) {
      // For mirrored clusters, generate two tables sharing the same clusterId.
      const leftTable: Table = {
        name: `${tableName} L`,
        baseName: `${tableName} L`,
        riggingPoints: '',
        rows: calculatedRows,
        totalWeight,
        id: Date.now(),
        stageName: selectedStage?.name ?? null,
        stageNumber: selectedStage?.number ?? null,
        dualMotors: useDualMotors,
        clusterId: newClusterId,
        cablePick,
        cablePickWeight,
      };

      const rightTable: Table = {
        name: `${tableName} R`,
        baseName: `${tableName} R`,
        riggingPoints: '',
        rows: calculatedRows,
        totalWeight,
        id: Date.now() + 1,
        stageName: selectedStage?.name ?? null,
        stageNumber: selectedStage?.number ?? null,
        dualMotors: useDualMotors,
        clusterId: newClusterId,
        cablePick,
        cablePickWeight,
      };

      tablesToCreate = [leftTable, rightTable];
    } else {
      // Single table with suffix generation
      const newTable: Table = {
        name: tableName,
        baseName: tableName,
        riggingPoints: '',
        rows: calculatedRows,
        totalWeight,
        id: Date.now(),
        stageName: selectedStage?.name ?? null,
        stageNumber: selectedStage?.number ?? null,
        dualMotors: useDualMotors,
        clusterId: newClusterId,
        cablePick,
        cablePickWeight,
      };

      tablesToCreate = [newTable];
    }

    if (isTourDateContext || isJobOverrideMode) {
      tablesToCreate = tablesToCreate.map((table) => ({ ...table, isOverride: true }));
    }

    const newTableIds = tablesToCreate.map((table) => table.id ?? 0);

    // Add all tables to state with recalculated suffixes
    const updatedTables = updateTablesState((prev) => [...prev, ...tablesToCreate]);
    const createdTablesWithSuffixes = updatedTables.filter((table) =>
      newTableIds.includes(table.id ?? 0)
    );

    // Handle saving based on mode
    if (isTourDefaults) {
      let savedCount = 0;
      for (const table of createdTablesWithSuffixes) {
        if (await saveAsTourDefaults(
          table,
          updatedTables.findIndex((candidate) => candidate.id === table.id),
          { syncAfterSave: false }
        )) {
          savedCount += 1;
        }
      }
      if (savedCount > 0) {
        await syncDefaultDocumentsAfterMutation();
      }
    } else {
      createdTablesWithSuffixes.forEach(table => {
        if (isTourDateContext || isJobOverrideMode) {
          saveAsOverride(table);
        }
        // For regular defaults mode, tables are just saved to local state
      });
    }

    resetCurrentTable();
    setUseDualMotors(false);
    setMirroredCluster(false);
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [createEmptyRow()],
    });
    setTableName('');
  };

  const removeTable = async (tableId: number) => {
    const tableToRemove = tables.find((table) => table.id === tableId);

    if (tableToRemove?.defaultTableId) {
      try {
        await deleteDefaultTable(tableToRemove.defaultTableId);
        await syncDefaultDocumentsAfterMutation();
      } catch (error) {
        console.error('Error deleting default weight table:', error);
        toast({
          title: 'Error',
          description: 'No se pudo eliminar la tabla predeterminada.',
          variant: 'destructive',
        });
        return;
      }
    }

    updateTablesState((prev) => prev.filter((table) => table.id !== tableId));
  };

  const handleExportPDF = usePesosPdfExport({ activeTables, selectedJob, selectedJobId, selectedStage });

  return (
    <PesosToolView
      handleBackNavigation={handleBackNavigation}
      handleExportPDF={handleExportPDF}
      isTourDefaults={isTourDefaults}
      tourName={tourName}
      isDefaults={isDefaults}
      isTourDateContext={isTourDateContext}
      tourDateInfo={tourDateInfo}
      isTourContext={isTourContext}
      isJobOverrideMode={isJobOverrideMode}
      jobTourInfo={jobTourInfo}
      tables={activeTables}
      currentSetName={currentSetName}
      setCurrentSetName={setCurrentSetName}
      jobIdFromUrl={jobIdFromUrl}
      selectedJobId={selectedJobId}
      handleJobSelect={handleJobSelect}
      jobs={jobs}
      selectedStageNumber={selectedStageNumber}
      setSelectedStageNumber={setSelectedStageNumber}
      jobStages={jobStages}
      tableName={tableName}
      setTableName={setTableName}
      useDualMotors={useDualMotors}
      setUseDualMotors={setUseDualMotors}
      mirroredCluster={mirroredCluster}
      setMirroredCluster={setMirroredCluster}
      cablePick={cablePick}
      setCablePick={setCablePick}
      cablePickWeight={cablePickWeight}
      setCablePickWeight={setCablePickWeight}
      soundComponentDatabase={soundComponentDatabase}
      currentTable={currentTable}
      updateInput={updateInput}
      removeRow={removeRow}
      addRow={addRow}
      generateTable={generateTable}
      resetCurrentTable={resetCurrentTable}
      defaultSets={defaultSets}
      defaultTables={defaultTables}
      selectedDefaultSetId={selectedDefaultSetId}
      setSelectedDefaultSetId={handleSelectedDefaultSetIdChange}
      selectedDefaultPackageSize={selectedDefaultPackageSize}
      setSelectedDefaultPackageSize={setSelectedDefaultPackageSize}
      newDefaultSetName={newDefaultSetName}
      setNewDefaultSetName={setNewDefaultSetName}
      deleteSet={deleteSetAndSync}
      weightOverrides={weightOverrides}
      deleteOverride={deleteOverride}
      saveAsDefaultSet={saveAsDefaultSet}
      removeTable={removeTable}
      headerExtras={
        isNormalJobMode ? (
          <>
            <XmlpWeightImportButton
              isImporting={isImportingXmlp}
              onImport={(file) => void importXmlpWeights(file)}
            />
            {jobStages.length > 1 && activeTables.length > 0 && (
              <CopyToStageMenu
                label="Copy set to..."
                stages={jobStages}
                excludeStageNumber={selectedStage?.number ?? null}
                onCopy={copyActiveSetToStage}
              />
            )}
            <QuickPresetsMenu
              labels={{
                button: 'Presets',
                heading: 'Quick presets',
                empty: 'No presets saved for this department yet.',
                tableCount: (count) => `${count} table(s)`,
                apply: 'Apply to current stage',
                deleteAction: 'Delete preset',
                saveCurrentHeading: 'Save current set as preset',
                namePlaceholder: 'Preset name',
                saveAction: 'Save preset',
              }}
              presets={quickPresets}
              canSaveCurrent={activeTables.length > 0}
              isSaving={isSavingPreset}
              onApply={applyQuickPreset}
              onDelete={removeQuickPreset}
              onSaveCurrent={saveActiveSetAsPreset}
            />
          </>
        ) : undefined
      }
    />
  );
};

export default PesosTool;
