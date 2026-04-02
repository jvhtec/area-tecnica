import React, { useState, useEffect } from 'react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection, JobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import { useTourDateOverrides } from '@/hooks/useTourDateOverrides';
import { PesosToolView } from './pesos-tool/PesosToolView';

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

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [createEmptyRow()],
  });

  const deriveBaseName = (name: string) => {
    const match = name.match(/^(.*?)(?:\s*\(.*\))?$/);
    return match ? match[1].trim() : name;
  };

  const formatSuffixNumber = (value: number) => `SX${value.toString().padStart(2, '0')}`;

  const assignSuffixes = (tablesToAssign: Table[]): Table[] => {
    let counter = 1;
    return tablesToAssign.map((table) => {
      const baseName = table.baseName || deriveBaseName(table.name);

      if (table.dualMotors) {
        const suffixOne = formatSuffixNumber(counter++);
        const suffixTwo = formatSuffixNumber(counter++);
        const riggingPoints = `${suffixOne}, ${suffixTwo}`;
        return {
          ...table,
          baseName,
          name: `${baseName} (${riggingPoints})`,
          riggingPoints,
        };
      }

      const suffix = formatSuffixNumber(counter++);
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

  const {
    weightOverrides,
    createWeightOverride,
    deleteOverride,
    isLoading: overridesLoading
  } = useTourDateOverrides(tourDateId || '', 'weight');

  // Get tour name for display
  const [tourName, setTourName] = useState<string>('');
  const [tourDateInfo, setTourDateInfo] = useState<{ date: string; location: string } | null>(null);

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
        const { data, error } = await supabase
          .from('jobs')
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
    // Check if a sound set already exists
    const existingSoundSet = defaultSets.find(set => set.department === 'sound');

    if (existingSoundSet) {
      return existingSoundSet.id;
    }

    // Create a new sound set
    const newSet = await createSet({
      tour_id: tourId!,
      name: `${tourName} Sound Defaults`,
      department: 'sound',
      description: 'Sound department weight defaults'
    });

    return newSet.id;
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
      const { data } = await supabase
        .from('tour_dates')
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
        const { data } = await supabase
          .from('tours')
          .select('name')
          .eq('id', tourId)
          .single();

        if (data) {
          setTourName(data.name);
        }
      }

      if (tourDateId) {
        const { data } = await supabase
          .from('tour_dates')
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

  // Load existing tour defaults when in defaults mode
  useEffect(() => {
    if (isDefaults && defaultTables.length > 0) {
      // Group tables by set and convert to our local format
      const convertedTables = defaultTables
        .filter(dt => dt.table_type === 'weight')
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
    }
  }, [isDefaults, defaultTables]);

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
        department: 'sound'
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
  const saveAsTourDefaults = async (table: Table) => {
    if (!tourId) return;

    try {
      // Get or create the sound set ID
      const setId = await getOrCreateSoundSetId();

      // Create the table with detailed data and metadata
      await createDefaultTable({
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
          baseName: table.baseName
        }
      });

      toast({
        title: 'Success',
        description: 'Tour default saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving tour default:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tour default',
        variant: 'destructive',
      });
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

  const generateTable = () => {
    if (!tableName) {
      toast({
        title: 'Missing table name',
        description: 'Please enter a name for the table',
        variant: 'destructive',
      });
      return;
    }

    // Calculate each row's total weight.
    const calculatedRows = currentTable.rows.map((row) => {
      const component = soundComponentDatabase.find((c) => c.id.toString() === row.componentId);
      const totalWeight =
        parseFloat(row.quantity) && parseFloat(row.weight)
          ? parseFloat(row.quantity) * parseFloat(row.weight)
          : 0;
      return {
        ...row,
        componentName: component?.name || '',
        totalWeight,
      };
    });

    const totalWeight = calculatedRows.reduce((sum, row) => sum + (row.totalWeight || 0), 0);

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
    createdTablesWithSuffixes.forEach(table => {
      if (isTourDefaults) {
        saveAsTourDefaults(table);
      } else if (isTourDateContext || isJobOverrideMode) {
        saveAsOverride(table);
      }
      // For regular defaults mode, tables are just saved to local state
    });

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

  const removeTable = (tableId: number) => {
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

    const summaryRows: SummaryRow[] = tables.map((table) => {
      const cleanName = table.name.split('(')[0].trim();
      return {
        clusterName: cleanName,
        riggingPoints: table.riggingPoints || '',
        clusterWeight: table.totalWeight || 0,
      };
    });

    // Group tables by clusterId to handle cable picks
    const clusters = tables.reduce((acc, table) => {
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
        riggingPoints: `CP${String(cablePickCounter).padStart(2, "0")}`,
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

      // For now just use the job title - location will be added later when available
      const pdfBlob = await exportToPDF(
        selectedJob.title,
        tables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        selectedJob.title,
        selectedJob?.start_time || new Date().toISOString(),
        summaryRows,
        undefined,
        undefined, // FIXED: Remove safety margin for weight reports
        logoUrl
      );

      const fileName = `Pesos Report - ${selectedJob.title}.pdf`;

      // Upload PDF first - only auto-complete tasks if upload succeeds
      try {
        const { uploadJobPdfWithCleanup } = await import('@/utils/jobDocumentsUpload');
        await uploadJobPdfWithCleanup(selectedJobId, pdfBlob, fileName, 'calculators/pesos');
      } catch (uploadErr) {
        throw uploadErr;
      }

      // Auto-complete all Pesos tasks for this job after successful upload
      // This automation marks relevant tasks as completed with proper audit trail
      let completedTasksCount = 0;
      try {
        const { autoCompletePesosTasks } = await import('@/utils/taskAutoCompletion');
        const result = await autoCompletePesosTasks(selectedJobId);
        completedTasksCount = result.completedCount;

        if (result.completedCount > 0) {
          console.log(`Auto-completed ${result.completedCount} Pesos task(s)`);
        }
      } catch (autoCompleteErr) {
        // Non-fatal: log but don't fail the upload flow
        console.warn('Task auto-completion failed:', autoCompleteErr);
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
      tables={tables}
      currentSetName={currentSetName}
      setCurrentSetName={setCurrentSetName}
      jobIdFromUrl={jobIdFromUrl}
      selectedJobId={selectedJobId}
      handleJobSelect={handleJobSelect}
      jobs={jobs}
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
      deleteSet={deleteSet}
      weightOverrides={weightOverrides}
      deleteOverride={deleteOverride}
      saveAsDefaultSet={saveAsDefaultSet}
      removeTable={removeTable}
    />
  );
};

export default PesosTool;
