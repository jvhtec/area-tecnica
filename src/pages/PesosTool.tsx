import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection, JobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { dataLayerClient } from '@/services/dataLayerClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import { useTourDateOverrides } from '@/hooks/useTourDateOverrides';
import { PesosToolView } from './pesos-tool/PesosToolView';
import {
  calculateWeightRows,
  formatRiggingPoint,
  sumWeightRows,
} from '@/features/technical-tools/weights/weightCalculations';
import { uploadWeightReportAndCompleteTasks } from '@/features/technical-tools/weights/weightPersistence';
import {
  appendTechnicalStageToFilename,
  formatTechnicalStageLabel,
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

// Database for sound components.
const soundComponentDatabase = [
  { id: 1, name: ' K1 ', weight: 106 },
  { id: 2, name: ' K2 ', weight: 56 },
  { id: 3, name: ' K3 ', weight: 43 },
  { id: 4, name: ' KARA II ', weight: 25 },
  { id: 5, name: ' KIVA ', weight: 14 },
  { id: 6, name: ' KS28 ', weight: 79 },
  { id: 7, name: ' K1-SB ', weight: 83 },
  { id: 8, name: ' BUMPER K1 ', weight: 108 },
  { id: 9, name: ' BUMPER K2 ', weight: 60 },
  { id: 10, name: ' BUMPER K3 ', weight: 50 },
  { id: 11, name: ' BUMPER KARA ', weight: 20 },
  { id: 12, name: ' BUMPER KIVA ', weight: 13 },
  { id: 13, name: ' BUMPER KS28 ', weight: 15 },
  { id: 14, name: ' KARADOWNK1 ', weight: 15 },
  { id: 15, name: ' KARADOWNK2 ', weight: 15 },
  { id: 16, name: ' MOTOR 2T ', weight: 90 },
  { id: 17, name: ' MOTOR 1T ', weight: 70 },
  { id: 18, name: ' MOTOR 750Kg ', weight: 60 },
  { id: 19, name: ' MOTOR 500Kg ', weight: 50 },
  { id: 20, name: ' POLIPASTO 1T ', weight: 10.4 },
  { id: 21, name: ' TFS900H ', weight: 102 },
  { id: 22, name: ' TFA600 ', weight: 41 },
  { id: 23, name: ' TFS550H ', weight: 13.4 },
  { id: 24, name: ' TFS550L ', weight: 27 },
  { id: 25, name: ' BUMPER TFS900 ', weight: 20 },
  { id: 26, name: ' TFS900>TFA600 ', weight: 14 },
  { id: 27, name: ' TFS900>TFS550 ', weight: 14 },
  { id: 28, name: ' BUMPER TFS550 ', weight: 16 },
  { id: 29, name: ' CABLEADO L ', weight: 100 },
  { id: 30, name: ' CABLEADO H ', weight: 250 },
];

interface TableRow {
  id: string;
  quantity: string;
  componentId: string;
  weight: string;
  componentName?: string;
  totalWeight?: number;
}

const createRowId = () =>
  globalThis.crypto?.randomUUID?.() ?? `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const createEmptyRow = (): TableRow => ({
  id: createRowId(),
  quantity: "",
  componentId: "",
  weight: "",
});

interface Table {
  name: string;
  rows: TableRow[];
  totalWeight?: number;
  id?: number;
  stageNumber?: number | null;
  stageName?: string | null;
  dualMotors?: boolean;
  riggingPoints?: string; // Stores the generated SX suffix(es)
  clusterId?: string;     // New property to group tables (e.g. mirrored pair)
  cablePick?: boolean;
  cablePickWeight?: string;
  defaultTableId?: string;
  overrideId?: string;
  isOverride?: boolean;
  baseName?: string;
}

interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

const PesosTool: React.FC = () => {
  const navigate = useNavigate();
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

  // Job-based override mode detection
  const [isJobOverrideMode, setIsJobOverrideMode] = useState(false);
  const [jobTourInfo, setJobTourInfo] = useState<{ tourName: string; date: string; location: string } | null>(null);
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

  const deriveBaseName = (name: string) => {
    const match = name.match(/^(.*?)(?:\s*\(.*\))?$/);
    return match ? match[1].trim() : name;
  };

  const formatSuffixNumber = (value: number) => formatRiggingPoint('SX', value);

  const getRiggingPointNumbers = (riggingPoints?: string): number[] =>
    Array.from(riggingPoints?.matchAll(/SX0*(\d+)/gi) ?? [])
      .map((match) => Number.parseInt(match[1], 10))
      .filter((value) => Number.isFinite(value) && value > 0);

  const assignSuffixes = (tablesToAssign: Table[]): Table[] => {
    const countersByStage = new Map<string, number>();

    return tablesToAssign.map((table) => {
      const baseName = table.baseName || deriveBaseName(table.name);
      const stageKey = table.stageNumber != null ? `stage-${table.stageNumber}` : 'default';
      const counter = countersByStage.get(stageKey) || 1;
      const persistedRiggingNumbers = getRiggingPointNumbers(table.riggingPoints);
      const shouldPreservePersistedRigging =
        Boolean(table.defaultTableId || table.overrideId) && persistedRiggingNumbers.length > 0;

      if (shouldPreservePersistedRigging) {
        countersByStage.set(stageKey, Math.max(counter, Math.max(...persistedRiggingNumbers) + 1));
        return {
          ...table,
          baseName,
          name: `${baseName} (${table.riggingPoints})`,
        };
      }

      if (table.dualMotors) {
        const suffixOne = formatSuffixNumber(counter);
        const suffixTwo = formatSuffixNumber(counter + 1);
        const riggingPoints = `${suffixOne}, ${suffixTwo}`;
        countersByStage.set(stageKey, counter + 2);
        return {
          ...table,
          baseName,
          name: `${baseName} (${riggingPoints})`,
          riggingPoints,
        };
      }

      const suffix = formatSuffixNumber(counter);
      countersByStage.set(stageKey, counter + 1);
      return {
        ...table,
        baseName,
        name: `${baseName} (${suffix})`,
        riggingPoints: suffix,
      };
    });
  };

  const updateTablesState = (updater: (prev: Table[]) => Table[]): Table[] => {
    let nextTables: Table[] = [];
    setTables((prev) => {
      nextTables = assignSuffixes(updater(prev));
      return nextTables;
    });
    return nextTables;
  };

  // Updated hooks for tour defaults
  const {
    defaultSets,
    defaultTables,
    createSet,
    createTable: createDefaultTable,
    deleteSet,
    deleteTable: deleteDefaultTable,
    isLoading: defaultsLoading
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
    isLoading: overridesLoading
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
  const [tourName, setTourName] = useState<string>('');
  const [tourDateInfo, setTourDateInfo] = useState<{ date: string; location: string } | null>(null);
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

  // Detect job-based override mode
  useEffect(() => {
    if (selectedJob?.tour_date_id && !isTourContext) {
      setIsJobOverrideMode(true);
      loadJobTourInfo();
    } else {
      setIsJobOverrideMode(false);
      setJobTourInfo(null);
    }
  }, [selectedJob, isTourContext]);

  const loadJobTourInfo = async () => {
    if (!selectedJob?.tour_date_id) return;

    try {
      const { data } = await dataLayerClient.from('tour_dates')
        .select(`
          date,
          tour:tours(name),
          location:locations(name)
        `)
        .eq('id', selectedJob.tour_date_id)
        .single();

      if (data) {
        setJobTourInfo({
          tourName: (data.tour as any)?.name || 'Unknown Tour',
          date: new Date(data.date).toLocaleDateString(),
          location: (data.location as any)?.name || 'Unknown Location'
        });
      }
    } catch (error) {
      console.error('Error loading job tour info:', error);
    }
  };

  useEffect(() => {
    const fetchTourInfo = async () => {
      if (tourId) {
        const { data } = await dataLayerClient.from('tours')
          .select('name')
          .eq('id', tourId)
          .single();

        if (data) {
          setTourName(data.name);
        }
      }

      if (tourDateId) {
        const { data } = await dataLayerClient.from('tour_dates')
          .select(`
            date,
            locations (
              name
            )
          `)
          .eq('id', tourDateId)
          .single();

        if (data) {
          setTourDateInfo({
            date: new Date(data.date).toLocaleDateString(),
            location: (data.locations as any)?.name || 'Unknown location'
          });
        }
      }
    };

    fetchTourInfo();
  }, [tourId, tourDateId]);

  const handleBackNavigation = () => {
    if (isTourContext) {
      navigate('/tours');
    } else {
      navigate('/sound');
    }
  };

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
  }, [isDefaults, isTourDefaults, defaultSets, defaultTables, selectedDefaultSetId]);

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
  }, [isTourDateContext, weightOverrides]);


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

  const handleExportPDF = async () => {
    if (!selectedJobId || !selectedJob) {
      toast({
        title: 'No job selected',
        description: 'Please select a job before exporting.',
        variant: 'destructive',
      });
      return;
    }

    const getMotorCountLabel = (table: Table) => {
      const motorCount = getRiggingPointNumbers(table.riggingPoints).length;
      if (motorCount > 0) return String(motorCount);
      if (table.dualMotors) return '2';
      return table.totalWeight > 0 ? '1' : 'N/A';
    };

    const summaryRows: SummaryRow[] = activeTables.map((table) => {
      const cleanName = table.name.split('(')[0].trim();
      return {
        clusterName: cleanName,
        riggingPoints: getMotorCountLabel(table),
        clusterWeight: table.totalWeight || 0,
      };
    });

    // Group tables by clusterId to handle cable picks
    const clusters = activeTables.reduce((acc, table) => {
      if (table.clusterId) {
        if (!acc[table.clusterId]) {
          acc[table.clusterId] = [];
        }
        acc[table.clusterId].push(table);
      }
      return acc;
    }, {} as Record<string, Table[]>);

    // If Cable Pick is enabled for a cluster, add one cable pick summary row per cluster
    let cablePickCounter = 0;
    Object.values(clusters).forEach((clusterTables) => {
      const tableWithCablePick = clusterTables.find((table) => table.cablePick);
      if (!tableWithCablePick) return;
      cablePickCounter += 1;
      summaryRows.push({
        clusterName: 'CABLE PICK',
        riggingPoints: '—',
        clusterWeight: parseFloat(tableWithCablePick.cablePickWeight || "0") || 0,
      });
    });

    try {
      let logoUrl: string | undefined = undefined;
      try {
        const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
        logoUrl = await fetchJobLogo(selectedJobId);
        console.log("Logo URL for PDF:", logoUrl);
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const stageLabel = formatTechnicalStageLabel(selectedStage);
      const reportTitle = stageLabel ? `${selectedJob.title} - ${stageLabel}` : selectedJob.title;

      const pdfBlob = await exportToPDF(
        reportTitle,
        activeTables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        reportTitle,
        selectedJob?.start_time || new Date().toISOString(),
        summaryRows,
        undefined,
        undefined, // FIXED: Remove safety margin for weight reports
        logoUrl
      );

      const fileName = appendTechnicalStageToFilename(
        `Pesos Report - ${selectedJob.title}.pdf`,
        selectedStage
      );
      let completedTasksCount = 0;

      // Upload PDF first - only auto-complete tasks if upload succeeds
      completedTasksCount = await uploadWeightReportAndCompleteTasks({
        fileName,
        jobId: selectedJobId,
        pdfBlob,
        stage: selectedStage,
      });

      if (completedTasksCount > 0) {
        console.log(`Auto-completed ${completedTasksCount} Pesos task(s)`);
      }

      toast({
        title: 'Success',
        description: completedTasksCount > 0
          ? `PDF uploaded successfully. ${completedTasksCount} Pesos task(s) auto-completed.`
          : 'PDF has been generated and uploaded successfully.',
      });

      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to generate or upload the PDF.',
        variant: 'destructive',
      });
    }
  };

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
