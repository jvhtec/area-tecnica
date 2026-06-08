import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection } from '@/hooks/useJobSelection';
import { useTourPowerDefaults } from '@/hooks/useTourPowerDefaults';
import { useTourDateOverrides } from '@/hooks/useTourDateOverrides';
import { useToast } from '@/hooks/use-toast';
import { dataLayerClient } from '@/services/dataLayerClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TourOverrideModeHeader } from '@/components/tours/TourOverrideModeHeader';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import type { Table, TableRow } from './consumos-tool/types';
import { PowerTableCard } from './consumos-tool/components/PowerTableCard';
import {
  createCalculatedPowerTable,
  getPowerPduOptions,
} from '@/features/technical-tools/power/powerCalculations';
import {
  buildPowerOverridePayload,
  buildPowerTableData,
  buildPowerTableMetadata,
  buildTourPowerDefaultTable,
  saveJobPowerRequirementTablesGeneration,
  uploadPowerReportAndCompleteTask,
} from '@/features/technical-tools/power/powerPersistence';
import {
  TechnicalStageSelector,
  appendTechnicalStageToFilename,
  formatTechnicalStageLabel,
  isSameTechnicalStage,
  useSelectedTechnicalStage,
} from '@/features/technical-tools/stage/stageAllocation';
import {
  CUSTOM_POWER_POSITION_VALUE,
  getPowerPositionCustomValue,
  getPowerPositionSelectValue,
  NO_POWER_POSITION_VALUE,
  POWER_POSITION_PRESETS,
} from '@/utils/powerPositions';

const soundComponentDatabase = [
  { id: 1, name: 'LA12X', watts: 2000 },
  { id: 2, name: 'LA8', watts: 1500 },
  { id: 3, name: 'LA4X', watts: 750 },
  { id: 4, name: 'PLM20000D', watts: 2900 },
  { id: 5, name: 'Control FoH (L)', watts: 3500 },
  { id: 6, name: 'Control FoH (S)', watts: 1500 },
  { id: 7, name: 'Control Mon (L)', watts: 3500 },
  { id: 8, name: 'Control Mon (S)', watts: 1500 },
  { id: 9, name: 'RF Rack', watts: 2500 },
  { id: 10, name: 'Backline', watts: 2500 },
  { id: 11, name: 'Varios', watts: 1500 }
];

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');

  // Tour defaults
  const tourId = searchParams.get('tourId');
  const mode = searchParams.get('mode');
  const isTourDefaults = mode === 'tour-defaults' || mode === 'defaults';

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [fohSchukoRequired, setFohSchukoRequired] = useState<boolean>(true);
  const [safetyMargin, setSafetyMargin] = useState(20); // sensible default for live shows
  const [editingOverride, setEditingOverride] = useState<string | null>(null);

  // NEW: supply type, PF, and voltage (auto from supply type)
  const [phaseMode, setPhaseMode] = useState<'single' | 'three'>('three');
  const [pf, setPf] = useState<number>(0.95);
  const [voltage, setVoltage] = useState<number>(400); // 400 V LL for 3φ by default (Spain)

  useEffect(() => {
    setVoltage(phaseMode === 'single' ? 230 : 400);
  }, [phaseMode]);

  // Tour override detection
  const isJobOverrideMode = Boolean(selectedJob?.tour_date_id);
  const tourDateId = selectedJob?.tour_date_id;
  const {
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages: jobStages,
  } = useSelectedTechnicalStage({
    enabled: Boolean(selectedJobId) && !isTourDefaults && !isJobOverrideMode,
    jobId: selectedJobId,
  });

  // NEW: Get tour name for tour defaults mode
  const [tourName, setTourName] = useState<string>('');

  // Tour-specific hooks - new defaults system
  const {
    defaultSets,
    defaultTables,
    createSet,
    createTable: createTourDefaultTable,
    updateTable: updateTourDefaultTable
  } = useTourDefaultSets(tourId || '');

  const { powerDefaults: legacyTourDefaults = [], createDefault: createLegacyTourDefault } = useTourPowerDefaults(tourId || '');
  const {
    powerOverrides = [],
    createPowerOverride,
    updatePowerOverride,
    deleteOverride,
    isCreatingOverride
  } = useTourDateOverrides(tourDateId || '', 'power');

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
    position: undefined,
    customPosition: undefined,
  });

  // Preselect job from query param and fetch details if not in the list
  useEffect(() => {
    const applyJobFromUrl = async () => {
      if (!jobIdFromUrl) return;
      try {
        setSelectedJobId(jobIdFromUrl);
        const found = (jobs || []).find((j: any) => j.id === jobIdFromUrl) || null;
        if (found) {
          setSelectedJob(found);
          return;
        }
        const { data } = await dataLayerClient.from('jobs')
          .select('id, title, start_time, end_time, tour_date_id, date, location')
          .eq('id', jobIdFromUrl)
          .single();
        if (data) setSelectedJob(data);
      } catch { }
    };
    applyJobFromUrl();
  }, [jobIdFromUrl, jobs]);

  // Helper function to get or create the set ID for sound department
  const getOrCreateSoundSetId = async (): Promise<string> => {
    const existingSoundSet = defaultSets.find(set => set.department === 'sound');
    if (existingSoundSet) return existingSoundSet.id;

    const newSet = await createSet({
      tour_id: tourId!,
      name: `${tourName} Sound Defaults`,
      department: 'sound',
      description: 'Sound department power defaults'
    });
    return newSet.id;
  };

  const addRow = () => {
    setCurrentTable((prev) => ({
      ...prev,
      rows: [...prev.rows, { quantity: '', componentId: '', watts: '' }],
    }));
  };

  const removeRow = (index: number) => {
    setCurrentTable((prev) => {
      const filteredRows = prev.rows.filter((_, i) => i !== index);
      return {
        ...prev,
        rows: filteredRows.length > 0 ? filteredRows : [{ quantity: '', componentId: '', watts: '' }],
      };
    });
  };

  const updateInput = (index: number, field: keyof TableRow, value: string) => {
    const newRows = [...currentTable.rows];
    if (field === 'componentId' && value) {
      const component = soundComponentDatabase.find((c) => c.id.toString() === value);
      newRows[index] = {
        ...newRows[index],
        [field]: value,
        watts: component ? component.watts.toString() : '',
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

  const getPowerSettings = () => ({ safetyMargin, powerFactor: pf, phaseMode, voltage });
  const PDU_TYPES = getPowerPduOptions('sound', phaseMode);
  const activeTables = selectedStage
    ? tables.filter((table) => isSameTechnicalStage(table.stageNumber, selectedStage))
    : tables;

  // NEW: Save as tour defaults using the new system
  const { createTable: _createTourDefaultTableInternal } = { createTable: createTourDefaultTable }; // keep name stable
  const saveTourDefault = async (table: Table) => {
    if (!tourId) return;
    try {
      const setId = await getOrCreateSoundSetId();
      const newDefaultTable = await _createTourDefaultTableInternal(
        buildTourPowerDefaultTable({
          setId,
          settings: getPowerSettings(),
          table,
        })
      );

      const tableIndex = tables.findIndex(t => t.id === table.id);
      if (tableIndex !== -1) {
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, isDefault: true, defaultTableId: newDefaultTable.id } : t));
      }

      toast({ title: "Success", description: "Tour default saved successfully" });
    } catch (error: any) {
      console.error('Error saving tour default:', error);
      toast({ title: "Error", description: `Failed to save tour default: ${error?.message || 'unknown error'}`, variant: "destructive" });
    }
  };

  const saveTourOverride = async (table: Table) => {
    if (!tourDateId) return;
    try {
      await createPowerOverride(buildPowerOverridePayload({
        department: 'sound',
        settings: getPowerSettings(),
        table,
        tourDateId,
      }));
      toast({ title: "Success", description: "Tour override saved successfully" });
    } catch (error: any) {
      console.error('Error saving tour override:', error);
      toast({ title: "Error", description: "Failed to save tour override", variant: "destructive" });
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    try {
      await deleteOverride({ id: overrideId, table: 'power' });
      toast({ title: "Success", description: "Override deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting override:', error);
      toast({ title: "Error", description: "Failed to delete override", variant: "destructive" });
    }
  };

  const handleEditOverride = (override: any) => {
    setTableName(override.table_name);
    setEditingOverride(override.id);
    if (override.override_data?.rows) {
      setCurrentTable({
        name: override.table_name,
        rows: override.override_data.rows,
        position: override.position || undefined,
        customPosition: override.custom_position || undefined,
      });
    } else {
      setCurrentTable({
        name: override.table_name,
        rows: [{ quantity: '1', componentId: '', watts: override.total_watts.toString() }],
        position: override.position || undefined,
        customPosition: override.custom_position || undefined,
      });
    }
  };

  const generateTable = async () => {
    if (!tableName) {
      toast({ title: 'Missing table name', description: 'Please enter a name for the table', variant: 'destructive' });
      return;
    }

    const newTable = createCalculatedPowerTable<TableRow, typeof soundComponentDatabase[number]>({
      components: soundComponentDatabase,
      currentTable,
      id: Date.now(),
      name: tableName,
      pduOptions: PDU_TYPES,
      settings: getPowerSettings(),
      tablePatch: {
        isDefault: false,
        defaultTableId: undefined,
        stageName: selectedStage?.name ?? null,
        stageNumber: selectedStage?.number ?? null,
      },
    }) as Table;

    if (isTourDefaults) {
      // user can tweak before saving defaults
    } else if (isJobOverrideMode) {
      await saveTourOverride(newTable);
    }

    setTables((prev) => [...prev, newTable]);
    resetCurrentTable();
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [{ quantity: '', componentId: '', watts: '' }],
      position: undefined,
      customPosition: undefined,
    });
    setTableName('');
    setEditingOverride(null);
  };

  const removeTable = async (tableId: number | string) => {
    const tableToRemove = tables.find((table) => table.id === tableId);
    if (!tableToRemove) {
      toast({ title: "Error", description: "Power requirement table not found", variant: "destructive" });
      return;
    }

    setTables((prev) => prev.filter((table) => table.id !== tableId));
  };

  // Save unsaved default tables
  const saveDefaultTables = async () => {
    const unsavedTables = tables.filter(table => !table.isDefault && !table.defaultTableId);
    if (unsavedTables.length === 0) {
      toast({ title: "No unsaved tables", description: "All tables have already been saved as defaults" });
      return;
    }
    try {
      const setId = await getOrCreateSoundSetId();
      for (let i = 0; i < unsavedTables.length; i++) {
        const table = unsavedTables[i];
        if (i > 0) await new Promise(r => setTimeout(r, 100));
        const newDefaultTable = await createTourDefaultTable(
          buildTourPowerDefaultTable({
            orderIndex: i,
            setId,
            settings: getPowerSettings(),
            table,
          })
        );
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, isDefault: true, defaultTableId: newDefaultTable.id } : t));
      }
      toast({ title: "Success", description: `${unsavedTables.length} default table(s) saved successfully` });
    } catch (error: any) {
      console.error('Error saving default tables:', error);
      toast({ title: "Error", description: `Failed to save some default tables: ${error?.message || 'unknown error'}`, variant: "destructive" });
    }
  };

  const updateTableSettings = async (tableId: number | string, updates: Partial<Table>) => {
    const existingTable = tables.find((table) => table.id === tableId);
    if (!existingTable) return;

    const updatedTable = { ...existingTable, ...updates };
    setTables((prev) =>
      prev.map((table) => (table.id === tableId ? updatedTable : table))
    );

    if (isTourDefaults && existingTable.isDefault && existingTable.defaultTableId && updateTourDefaultTable) {
      updateTourDefaultTable({
        tableId: existingTable.defaultTableId,
        updates: {
          table_data: buildPowerTableData(updatedTable, getPowerSettings()),
          total_value: updatedTable.totalWatts || 0,
          metadata: buildPowerTableMetadata(updatedTable, getPowerSettings()),
        }
      });
    } else if (isJobOverrideMode && existingTable.isOverride && existingTable.overrideId && updatePowerOverride) {
      updatePowerOverride({
        id: existingTable.overrideId,
        data: {
          total_watts: updatedTable.totalWatts || 0,
          current_per_phase: updatedTable.currentPerPhase || 0,
          pdu_type: updatedTable.customPduType || updatedTable.pduType || '',
          custom_pdu_type: updatedTable.customPduType,
          position: updatedTable.position || null,
          custom_position: updatedTable.customPosition || null,
          includes_hoist: updatedTable.includesHoist || false,
          override_data: buildPowerTableData(updatedTable, getPowerSettings()),
        }
      });
    }
  };

  const handleExportPDF = async () => {
    if (!selectedJobId && !isTourDefaults) {
      toast({ title: 'No job selected', description: 'Please select a job before exporting.', variant: 'destructive' });
      return;
    }

    try {
      // Override mode: overrides replace defaults for that date
      // Tour-defaults mode: print stored defaults only
      // Normal mode: print user-created tables
      const allTables = isJobOverrideMode
        ? tourOverrideTables
        : isTourDefaults
          ? tourDefaultTables
          : activeTables;

      const totalSystemWatts = allTables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
      const totalSystemAmps = allTables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0);
      const totalSystemKva = allTables.reduce((sum, table) => sum + (table.totalVa || table.totalWatts || 0), 0) / 1000;
      const powerSummary = { totalSystemWatts, totalSystemAmps, totalSystemKva };

      let logoUrl: string | undefined = undefined;
      try {
        if (isTourDefaults && tourId) {
          const { fetchTourLogo } = await import('@/utils/pdf/logoUtils');
          logoUrl = await fetchTourLogo(tourId);
        } else if (selectedJobId) {
          const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
          logoUrl = await fetchJobLogo(selectedJobId);
        }
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const jobTitle = isTourDefaults ? `${tourName} - Sound Power Defaults` : (selectedJob?.title || 'Power Report');
      const jobLocation = selectedJob?.location?.name || '';
      const baseHeaderTitle = jobLocation ? `${jobTitle} - ${jobLocation}` : jobTitle;
      const stageLabel = formatTechnicalStageLabel(selectedStage);
      const headerTitle = stageLabel ? `${baseHeaderTitle} - ${stageLabel}` : baseHeaderTitle;

      const pdfBlob = await exportToPDF(
        headerTitle,
        allTables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        headerTitle,
        isTourDefaults ? new Date().toISOString() : (selectedJob?.date || new Date().toISOString()),
        undefined,
        powerSummary,
        safetyMargin,
        logoUrl,
        fohSchukoRequired
      );

      const fileName = isTourDefaults
        ? `${tourName} - Sound Power Defaults.pdf`
        : appendTechnicalStageToFilename(
            `Sound Power Report - ${selectedJob?.title || 'Report'}.pdf`,
            selectedStage
          );

      // Auto-complete sound Consumos tasks only after successful upload
      // This automation is department-specific: only sound department tasks are affected
      let completedTasksCount = 0;
      if (selectedJobId) {
        completedTasksCount = await uploadPowerReportAndCompleteTask({
          department: 'sound',
          fileName,
          jobId: selectedJobId,
          pdfBlob,
          stage: selectedStage,
        });

        if (completedTasksCount > 0) {
          console.log(`Auto-completed ${completedTasksCount} sound Consumos task(s)`);
        }
      }

      if (!isTourDefaults && !isJobOverrideMode && selectedJobId) {
        const savedTables = await saveJobPowerRequirementTablesGeneration({
          client: dataLayerClient,
          department: 'sound',
          jobId: selectedJobId,
          settings: getPowerSettings(),
          stage: selectedStage,
          tables: allTables,
        });

        setTables((storedTables) =>
          storedTables.map((storedTable) => {
            const savedTable = savedTables.find((saved) => saved.tableId === storedTable.id);
            return savedTable
              ? {
                  ...storedTable,
                  generationTimestamp: savedTable.generationTimestamp,
                  powerRequirementId: savedTable.powerRequirementId,
                }
              : storedTable;
          })
        );
      }

      toast({
        title: 'Success',
        description: isTourDefaults
          ? 'PDF has been generated and downloaded successfully.'
          : completedTasksCount > 0
            ? `PDF uploaded successfully. ${completedTasksCount} Consumos task(s) auto-completed.`
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
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      toast({ title: 'Error', description: 'Failed to generate or upload the PDF.', variant: 'destructive' });
    }
  };

  // NEW: Load tour name for display
  useEffect(() => {
    const fetchTourInfo = async () => {
      if (tourId) {
        const { data } = await dataLayerClient.from('tours').select('name').eq('id', tourId).single();
        if (data) setTourName(data.name);
      }
    };
    fetchTourInfo();
  }, [tourId]);

  // Convert defaults/overrides into display tables
  const newTourDefaultTables = (defaultTables || [])
    .filter(table => table.table_type === 'power')
    .map(table => {
      // Read saved electrical metadata from table.metadata or table.table_data
      const savedPf = table.metadata?.pf ?? table.table_data?.pf ?? pf;
      const savedSafetyMargin = table.metadata?.safetyMargin ?? table.table_data?.safetyMargin ?? safetyMargin;

      // Compute electrical values using saved metadata
      const adjW = (table.total_value || 0) * (1 + savedSafetyMargin / 100);
      const totalVa = savedPf > 0 ? adjW / savedPf : adjW;

      return {
        id: `new-default-${table.id}`,
        name: table.table_name,
        rows: table.table_data?.rows || [],
        totalWatts: table.total_value,
        adjustedWatts: adjW,
        totalVa: totalVa,
        currentPerPhase: table.metadata?.current_per_phase || 0,
        pduType: table.metadata?.pdu_type || '',
        customPduType: table.metadata?.custom_pdu_type || '',
        position: table.metadata?.position || undefined,
        customPosition: table.metadata?.custom_position || undefined,
        includesHoist: table.metadata?.includes_hoist || false,
        isDefault: true,
        defaultTableId: table.id
      };
    });

  const legacyTourDefaultTables = legacyTourDefaults.map(def => {
    // Read saved electrical metadata from def.metadata or def (legacy structure)
    const savedPf = def.metadata?.pf ?? def.pf ?? pf;
    const savedSafetyMargin = def.metadata?.safetyMargin ?? def.safetyMargin ?? safetyMargin;

    // Compute electrical values using saved metadata
    const adjW = (def.total_watts || 0) * (1 + savedSafetyMargin / 100);
    const totalVa = savedPf > 0 ? adjW / savedPf : adjW;

    return {
      id: `legacy-default-${def.id}`,
      name: def.table_name,
      rows: [] as Table['rows'],
      totalWatts: def.total_watts,
      adjustedWatts: adjW,
      totalVa: totalVa,
      currentPerPhase: def.current_per_phase,
      pduType: def.pdu_type,
      customPduType: def.custom_pdu_type,
      position: def.position,
      customPosition: def.custom_position,
      includesHoist: def.includes_hoist,
      isDefault: true
    };
  });

  const tourDefaultTables = newTourDefaultTables.length > 0 ? newTourDefaultTables : legacyTourDefaultTables;

  const tourOverrideTables = powerOverrides.map(override => {
    // Read saved electrical metadata from override.override_data
    const savedPf = override.override_data?.pf ?? pf;
    const savedSafetyMargin = override.override_data?.safetyMargin ?? safetyMargin;

    // Compute electrical values using saved metadata
    const adjW = (override.total_watts || 0) * (1 + savedSafetyMargin / 100);
    const totalVa = savedPf > 0 ? adjW / savedPf : adjW;

    return {
      id: `override-${override.id}`,
      name: override.table_name,
      rows: override.override_data?.rows || [],
      totalWatts: override.total_watts,
      adjustedWatts: adjW,
      totalVa: totalVa,
      currentPerPhase: override.current_per_phase,
      pduType: override.pdu_type,
      customPduType: override.custom_pdu_type,
      position: override.position,
      customPosition: override.custom_position,
      includesHoist: override.includes_hoist,
      isOverride: true,
      overrideId: override.id
    };
  });

  const getTourInfo = () => {
    if (!selectedJob?.tour_date) return null;
    return {
      tourName: selectedJob.tour_date.tour?.name || 'Unknown Tour',
      tourDate: selectedJob.tour_date.date || selectedJob.start_time,
      locationName: selectedJob.tour_date.location?.name || selectedJob.location?.name || 'Unknown Location'
    };
  };
  const tourInfo = getTourInfo();

  return (
    <div className="w-full p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/sound')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                Power Calculator
              </h1>
              {isTourDefaults && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Tour Defaults Mode
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Creating defaults for: <span className="font-medium">{tourName}</span>
                  </p>
                </div>
              )}
              {isJobOverrideMode && tourInfo && (
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Badge variant="secondary">Override Mode</Badge>
                  <p>Tour: {tourInfo.tourName} • {tourInfo.tourDate} - {tourInfo.locationName}</p>
                </div>
              )}
            </div>
          </div>
          {activeTables.length > 0 && (
            <Button onClick={handleExportPDF} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              {isTourDefaults ? 'Export PDF' : 'Export & Upload PDF'}
            </Button>
          )}
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inputs & Builder */}
        <div className="lg:col-span-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Job-based override notification */}
                {isJobOverrideMode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm font-medium text-blue-900">
                        Job Override Mode Active
                      </p>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      This job is part of a tour. Any tables you create will be saved as overrides for the specific tour date.
                    </p>
                  </div>
                )}

                {/* Tour defaults mode notification */}
                {isTourDefaults && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm font-medium text-green-900">
                        Tour Defaults Mode Active
                      </p>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      Any tables you create will be saved as global defaults for this tour. These defaults will apply to all tour dates unless specifically overridden.
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox id="foh-schuko" checked={fohSchukoRequired} onCheckedChange={(c) => setFohSchukoRequired(!!c)} />
                  <Label htmlFor="foh-schuko">Se requiere potencia de 16A en formato schuko hembra en posicion FoH</Label>
                </div>

                {/* Supply/PF controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Supply</Label>
                    <Select value={phaseMode} onValueChange={(v) => setPhaseMode(v as 'single' | 'three')}>
                      <SelectTrigger><SelectValue placeholder="Select supply" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Monofásico (230 V)</SelectItem>
                        <SelectItem value="three">Trifásico (400 V LL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Voltage</Label>
                    <Input type="number" value={voltage} onChange={(e) => setVoltage(Number(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground">230 V (1φ) o 400 V LL (3φ) por defecto en ES</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Power Factor (PF)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="1"
                      value={pf}
                      onChange={(e) => setPf(Math.max(0.1, Math.min(1, Number(e.target.value) || 0.83)))}
                    />
                    <p className="text-xs text-muted-foreground">Usa 0.9 si la PDU mezcla amplificadores nuevos y viejos (p.ej LA8).</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="safetyMargin">Safety Margin</Label>
                  <Select value={safetyMargin.toString()} onValueChange={(value) => setSafetyMargin(Number(value))}>
                    <SelectTrigger><SelectValue placeholder="Select Safety Margin" /></SelectTrigger>
                    <SelectContent>
                      {[0, 10, 20, 30, 40, 50].map((percentage) => (
                        <SelectItem key={percentage} value={percentage.toString()}>{percentage}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hide job selection when coming from card (jobId in URL), or in tour defaults mode */}
                {!isJobOverrideMode && !isTourDefaults && !jobIdFromUrl && (
                  <div className="space-y-2">
                    <Label htmlFor="jobSelect">Select Job</Label>
                    <Select value={selectedJobId} onValueChange={handleJobSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs?.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!isTourDefaults && !isJobOverrideMode && (
                  <TechnicalStageSelector
                    label="Stage"
                    selectedStageNumber={selectedStageNumber}
                    stages={jobStages}
                    onChange={setSelectedStageNumber}
                  />
                )}

                {(isJobOverrideMode || isTourDefaults) && tourDefaultTables.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-900">
                      {isTourDefaults ? 'Existing Tour Defaults' : 'Tour Default Tables'}
                    </h3>
                    {tourDefaultTables.map((table) => (
                      <div key={table.id} className="border rounded-lg overflow-hidden bg-blue-50/30">
                        <div className="bg-blue-100 px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-blue-900">{table.name}</h4>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Default</Badge>
                          </div>
                        </div>
                        <div className="p-4 space-y-2 text-sm">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>Total Watts: <span className="font-medium">{table.totalWatts?.toFixed(2)} W</span></div>
                            <div>Potencia Aparente: <span className="font-medium">{((table.totalVa || table.totalWatts || 0) / 1000).toFixed(2)} kVA</span></div>
                            <div>{phaseMode === 'three' ? 'Current per Phase' : 'Current'}: <span className="font-medium">{table.currentPerPhase?.toFixed(2)} A</span></div>
                            <div>PDU Type: <span className="font-medium">{table.customPduType || table.pduType}</span></div>
                            {table.includesHoist && (
                              <div className="col-span-1 sm:col-span-2 text-green-700">✓ Includes additional hoist power (CEE32A 3P+N+G)</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isJobOverrideMode && tourOverrideTables.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-orange-900">Existing Overrides</h3>
                    {tourOverrideTables.map((table) => (
                      <div key={table.id} className="border rounded-lg overflow-hidden bg-orange-50/30">
                        <div className="bg-orange-100 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-orange-900">{table.name}</h4>
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Override</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditOverride({
                                id: table.overrideId,
                                table_name: table.name,
                                total_watts: table.totalWatts,
                                position: table.position,
                                custom_position: table.customPosition,
                                override_data: { rows: table.rows }
                              })}
                              className="gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => table.overrideId && handleDeleteOverride(table.overrideId)}
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="p-4 space-y-2 text-sm">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>Total Watts: <span className="font-medium">{table.totalWatts?.toFixed(2)} W</span></div>
                            <div>Potencia Aparente: <span className="font-medium">{((table.totalVa || table.totalWatts || 0) / 1000).toFixed(2)} kVA</span></div>
                            <div>{phaseMode === 'three' ? 'Current per Phase' : 'Current'}: <span className="font-medium">{table.currentPerPhase?.toFixed(2)} A</span></div>
                            <div>PDU Type: <span className="font-medium">{table.customPduType || table.pduType}</span></div>
                            <div>Position: <span className="font-medium">{table.customPosition || table.position || 'N/A'}</span></div>
                            {table.includesHoist && (
                              <div className="col-span-1 sm:col-span-2 text-orange-700">✓ Includes additional hoist power (CEE32A 3P+N+G)</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tableName">
                    {isTourDefaults ? 'Default Name' : 'Table Name'} {editingOverride && <span className="text-orange-600">(Editing Override)</span>}
                  </Label>
                  <Input
                    id="tableName"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder={isTourDefaults ? "Enter default name" : "Enter table name"}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select
                      value={getPowerPositionSelectValue(currentTable.position, currentTable.customPosition)}
                      onValueChange={(value) =>
                        setCurrentTable((prev) => ({
                          ...prev,
                          position:
                            value === NO_POWER_POSITION_VALUE || value === CUSTOM_POWER_POSITION_VALUE
                              ? undefined
                              : value,
                          customPosition:
                            value === CUSTOM_POWER_POSITION_VALUE ? prev.customPosition || '' : undefined,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_POWER_POSITION_VALUE}>No position</SelectItem>
                        {POWER_POSITION_PRESETS.map((position) => (
                          <SelectItem key={position} value={position}>
                            {position}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_POWER_POSITION_VALUE}>Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {getPowerPositionSelectValue(currentTable.position, currentTable.customPosition) === CUSTOM_POWER_POSITION_VALUE && (
                    <div className="space-y-2">
                      <Label>Custom Position</Label>
                      <Input
                        value={getPowerPositionCustomValue(currentTable.position, currentTable.customPosition)}
                        onChange={(e) =>
                          setCurrentTable((prev) => ({
                            ...prev,
                            position: undefined,
                            customPosition: e.target.value,
                          }))
                        }
                        placeholder="Enter custom position"
                      />
                    </div>
                  )}
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-sm">Quantity</th>
                          <th className="px-4 py-3 text-left font-medium text-sm">Component</th>
                          <th className="px-4 py-3 text-left font-medium text-sm">Watts (per unit)</th>
                          <th className="w-12 px-4 py-3 text-left font-medium text-sm">&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTable.rows.map((row, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-4">
                              <Input
                                type="number"
                                value={row.quantity}
                                onChange={(e) => updateInput(index, 'quantity', e.target.value)}
                                min="0"
                                className="w-full min-w-[100px]"
                              />
                            </td>
                            <td className="p-4">
                              <Select
                                value={row.componentId}
                                onValueChange={(value) => value && updateInput(index, 'componentId', value)}
                              >
                                <SelectTrigger className="w-full min-w-[150px]">
                                  <SelectValue placeholder="Select component" />
                                </SelectTrigger>
                                <SelectContent>
                                  {soundComponentDatabase.map((component) => (
                                    <SelectItem key={component.id} value={component.id.toString()}>
                                      {component.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-4">
                              <Input type="number" value={row.watts} readOnly className="w-full min-w-[120px] bg-muted" />
                            </td>
                            <td className="p-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRow(index)}
                                className="text-destructive hover:text-destructive"
                                aria-label="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={addRow}>Add Row</Button>
                  <Button
                    onClick={generateTable}
                    variant="secondary"
                    disabled={(!isJobOverrideMode && !isTourDefaults) && isCreatingOverride}
                  >
                    {editingOverride ? 'Update Override' : isTourDefaults ? 'Generate Table' : isJobOverrideMode ? 'Create Override' : 'Generate Table'}
                  </Button>
                  <Button onClick={resetCurrentTable} variant="destructive">
                    {editingOverride ? 'Cancel Edit' : 'Reset'}
                  </Button>
                  {isTourDefaults && tables.some(table => !table.isDefault && !table.defaultTableId) && (
                    <Button onClick={saveDefaultTables} variant="default" className="bg-green-600 hover:bg-green-700">
                      Save Default Tables
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Results Column 1 */}
        <div className="lg:col-span-4">
          <div className="space-y-6">
            {/* First half of tables */}
            {activeTables.slice(0, Math.ceil(activeTables.length / 2)).map((table) => (
              <PowerTableCard
                key={table.id}
                table={table}
                pduTypes={PDU_TYPES}
                safetyMargin={safetyMargin}
                phaseMode={phaseMode}
                onRemove={() => removeTable(table.id as number)}
                onUpdateSettings={(patch) => updateTableSettings(table.id as number, patch)}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Results Column 2 */}
        <div className="lg:col-span-4">
          <div className="space-y-6">
            {/* Second half of tables */}
            {activeTables.slice(Math.ceil(activeTables.length / 2)).map((table) => (
              <PowerTableCard
                key={table.id}
                table={table}
                pduTypes={PDU_TYPES}
                safetyMargin={safetyMargin}
                phaseMode={phaseMode}
                onRemove={() => removeTable(table.id as number)}
                onUpdateSettings={(patch) => updateTableSettings(table.id as number, patch)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsumosTool;
