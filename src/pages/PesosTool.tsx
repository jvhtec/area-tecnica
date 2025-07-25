import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ArrowLeft, Save } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection, JobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTourWeightDefaults } from '@/hooks/useTourWeightDefaults';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import { useTourDateOverrides } from '@/hooks/useTourDateOverrides';
import { Badge } from '@/components/ui/badge';

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

// Global counter for generating SX numbers.
let soundTableCounter = 0;

interface TableRow {
  quantity: string;
  componentId: string;
  weight: string;
  componentName?: string;
  totalWeight?: number;
}

interface Table {
  name: string;
  rows: TableRow[];
  totalWeight?: number;
  id?: number;
  dualMotors?: boolean;
  riggingPoints?: string; // Stores the generated SX suffix(es)
  clusterId?: string;     // New property to group tables (e.g. mirrored pair)
  defaultTableId?: string;
  overrideId?: string;
  isOverride?: boolean;
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
    rows: [{ quantity: '', componentId: '', weight: '' }],
  });

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
          rows: dt.table_data.rows || [{
            quantity: '1',
            componentId: '',
            weight: dt.total_value.toString(),
            componentName: dt.table_name,
            totalWeight: dt.total_value
          }],
          totalWeight: dt.total_value,
          id: Date.now() + index,
          clusterId: dt.metadata?.clusterId,
          dualMotors: dt.metadata?.dualMotors,
          riggingPoints: dt.metadata?.riggingPoints,
          defaultTableId: dt.id
        }));
      setTables(convertedTables);
    }
  }, [isDefaults, defaultTables]);

  // Load tour date overrides when in tour date context
  useEffect(() => {
    if (isTourDateContext && weightOverrides.length > 0) {
      const convertedTables = weightOverrides.map((override, index) => ({
        name: override.item_name,
        rows: override.override_data?.tableData?.rows || [{
          quantity: override.quantity.toString(),
          componentId: '',
          weight: override.weight_kg.toString(),
          componentName: override.item_name,
          totalWeight: override.weight_kg * override.quantity
        }],
        totalWeight: override.weight_kg * override.quantity,
        id: Date.now() + index,
        clusterId: override.override_data?.tableData?.clusterId,
        dualMotors: override.override_data?.tableData?.dualMotors,
        riggingPoints: override.override_data?.tableData?.riggingPoints,
        overrideId: override.id
      }));
      setTables(convertedTables);
    }
  }, [isTourDateContext, weightOverrides]);

  // Helper to generate an SX suffix.
  // Returns a string such as "SX01" or "SX01, SX02" depending on useDualMotors.
  const getSuffix = () => {
    // Since this is the PesosTool for sound department
    if (useDualMotors) {
      soundTableCounter++;
      const num1 = soundTableCounter.toString().padStart(2, '0');
      soundTableCounter++;
      const num2 = soundTableCounter.toString().padStart(2, '0');
      return `SX${num1}, SX${num2}`;
    } else {
      soundTableCounter++;
      const num = soundTableCounter.toString().padStart(2, '0');
      return `SX${num}`;
    }
  };

  const addRow = () => {
    setCurrentTable((prev) => ({
      ...prev,
      rows: [...prev.rows, { quantity: '', componentId: '', weight: '' }],
    }));
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
            clusterId: table.clusterId
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
          cablePick: cablePick,
          cablePickWeight: cablePickWeight
        },
        table_type: 'weight',
        total_value: table.totalWeight || 0,
        metadata: {
          dualMotors: table.dualMotors,
          riggingPoints: table.riggingPoints,
          clusterId: table.clusterId,
          cablePick: cablePick,
          cablePickWeight: cablePickWeight
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
      const leftSuffix = getSuffix();
      const rightSuffix = getSuffix();

      const leftTable: Table = {
        name: `${tableName} L (${leftSuffix})`,
        riggingPoints: leftSuffix,
        rows: calculatedRows,
        totalWeight,
        id: Date.now(),
        dualMotors: useDualMotors,
        clusterId: newClusterId,
      };

      const rightTable: Table = {
        name: `${tableName} R (${rightSuffix})`,
        riggingPoints: rightSuffix,
        rows: calculatedRows,
        totalWeight,
        id: Date.now() + 1,
        dualMotors: useDualMotors,
        clusterId: newClusterId,
      };

      tablesToCreate = [leftTable, rightTable];
    } else {
      // Single table with suffix generation
      const suffix = getSuffix();
      const newTable: Table = {
        name: `${tableName} (${suffix})`,
        riggingPoints: suffix,
        rows: calculatedRows,
        totalWeight,
        id: Date.now(),
        dualMotors: useDualMotors,
        clusterId: newClusterId,
      };

      tablesToCreate = [newTable];
    }

    // Add all tables to state
    setTables((prev) => [...prev, ...tablesToCreate]);

    // Handle saving based on mode
    tablesToCreate.forEach(table => {
      if (isTourDefaults) {
        saveAsTourDefaults(table);
      } else if (isTourDateContext || isJobOverrideMode) {
        table.isOverride = true;
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
      rows: [{ quantity: '', componentId: '', weight: '' }],
    });
    setTableName('');
  };

  const removeTable = (tableId: number) => {
    setTables((prev) => prev.filter((table) => table.id !== tableId));
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

    // If Cable Pick is enabled, add one cable pick summary row per cluster
    if (cablePick) {
      Object.values(clusters).forEach(() => {
        summaryRows.push({
          clusterName: 'CABLE PICK',
          riggingPoints: 'CP01',
          clusterWeight: parseFloat(cablePickWeight),
        });
      });
    }

    try {
      let logoUrl: string | undefined = undefined;
      try {
        const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
        logoUrl = await fetchJobLogo(selectedJobId);
        console.log("Logo URL for PDF:", logoUrl);
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const jobDateStr = new Date().toLocaleDateString('en-GB');
      const pdfBlob = await exportToPDF(
        selectedJob.title,
        tables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        selectedJob.title,
        jobDateStr,
        summaryRows,
        undefined,
        undefined, // FIXED: Remove safety margin for weight reports
        logoUrl
      );

      const fileName = `Pesos Report - ${selectedJob.title}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const filePath = `sound/${selectedJobId}/${crypto.randomUUID()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('task_documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      toast({
        title: 'Success',
        description: 'PDF has been generated and uploaded successfully.',
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
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">
              Weight Calculator
            </CardTitle>
            {/* Tour defaults mode indicator */}
            {isTourDefaults && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Tour Defaults Mode
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Creating defaults for: <span className="font-medium">{tourName}</span>
                </p>
              </div>
            )}
            {isDefaults && !isTourDefaults && (
              <p className="text-sm text-muted-foreground mt-1">
                Managing defaults for: <span className="font-medium">{tourName}</span>
              </p>
            )}
            {isTourDateContext && tourDateInfo && (
              <div className="text-sm text-muted-foreground mt-1">
                <p>Creating overrides for tour date</p>
                <p className="font-medium">{tourDateInfo.date} - {tourDateInfo.location}</p>
              </div>
            )}
            {isTourContext && !isDefaults && !isTourDateContext && !isTourDefaults && (
              <p className="text-sm text-muted-foreground mt-1">
                Creating weight requirements for tour: <span className="font-medium">{tourName}</span>
              </p>
            )}
            {isJobOverrideMode && jobTourInfo && (
              <div className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-2">
                <Badge variant="secondary">Override Mode</Badge>
                <p>Tour: {jobTourInfo.tourName} • {jobTourInfo.date} - {jobTourInfo.location}</p>
              </div>
            )}
          </div>
          <div></div>
        </div>
      </CardHeader>
      <CardContent>
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

          {/* Tour date override notification */}
          {isTourDateContext && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm font-medium text-blue-900">
                  Override Mode Active
                </p>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Any tables you create will be saved as overrides for this specific tour date.
              </p>
            </div>
          )}

          {isDefaults && !isTourDefaults && (
            <div className="space-y-2">
              <Label htmlFor="setName">Default Set Name</Label>
              <Input
                id="setName"
                value={currentSetName}
                onChange={(e) => setCurrentSetName(e.target.value)}
                placeholder="Enter set name (e.g., 'Main Stage Rigging')"
              />
            </div>
          )}

          {/* Don't show job selection in tour defaults mode */}
          {!isTourContext && !isTourDefaults && (
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

          <div className="space-y-2">
            <Label htmlFor="tableName">
              {isDefaults || isTourDefaults ? 'Weight Default Name' : 'Table Name'}
            </Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={isDefaults || isTourDefaults ? "Enter default name (e.g., K2 Array)" : "Enter table name"}
            />
            
            {/* UPDATED: Enable advanced features in tour defaults mode */}
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="dualMotors"
                checked={useDualMotors}
                onCheckedChange={(checked) => setUseDualMotors(checked as boolean)}
              />
              <Label htmlFor="dualMotors" className="text-sm font-medium">
                Dual Motors Configuration
              </Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="mirroredCluster"
                checked={mirroredCluster}
                onCheckedChange={(checked) => setMirroredCluster(checked as boolean)}
              />
              <Label htmlFor="mirroredCluster" className="text-sm font-medium">
                Mirrored Cluster
              </Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="cablePick"
                checked={cablePick}
                onCheckedChange={(checked) => setCablePick(checked as boolean)}
              />
              <Label htmlFor="cablePick" className="text-sm font-medium">
                Cable Pick
              </Label>
              {cablePick && (
                <Select value={cablePickWeight} onValueChange={(value) => setCablePickWeight(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select weight" />
                  </SelectTrigger>
                  <SelectContent>
                    {['100', '200', '300', '400', '500'].map((w) => (
                      <SelectItem key={w} value={w}>
                        {w} kg
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium">Component</th>
                  <th className="px-4 py-3 text-left font-medium">Weight (per unit)</th>
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
                        className="w-full"
                      />
                    </td>
                    <td className="p-4">
                      <Select
                        value={row.componentId}
                        onValueChange={(value) => updateInput(index, 'componentId', value)}
                      >
                        <SelectTrigger className="w-full">
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
                      <Input type="number" value={row.weight} readOnly className="w-full bg-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={addRow}>Add Row</Button>
            <Button onClick={generateTable} variant="secondary">
              {isDefaults ? 'Save Default' : isTourDefaults ? 'Save Tour Default' : 'Generate Table'}
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {tables.length > 0 && !isDefaults && !isTourContext && !isTourDefaults && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="w-4 h-4" />
                Export &amp; Upload PDF
              </Button>
            )}
          </div>

          {/* Display existing default sets */}
          {isDefaults && defaultSets.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Existing Default Sets</h3>
              {defaultSets.map((set) => {
                const setTables = defaultTables.filter(dt => dt.set_id === set.id && dt.table_type === 'weight');
                return (
                  <div key={set.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{set.name}</h4>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteSet(set.id)}
                      >
                        Delete Set
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {set.description} • {setTables.length} tables
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {setTables.map((table) => (
                        <div key={table.id} className="text-sm border rounded p-2">
                          <div className="font-medium">{table.table_name}</div>
                          <div className="text-muted-foreground">{table.total_value.toFixed(2)} kg</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Display existing overrides for tour dates */}
          {isTourDateContext && weightOverrides.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Existing Overrides for This Date</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weightOverrides.map((override) => (
                  <div key={override.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{override.item_name}</h4>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteOverride({ id: override.id, table: 'weight' })}
                      >
                        Delete
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(override.weight_kg * override.quantity).toFixed(2)} kg
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table display with save as default option */}
          {tables.map((table) => (
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6">
              <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{table.name}</h3>
                  {isTourDefaults && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isDefaults && isTourContext && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveAsDefaultSet()}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save as Default
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => table.id && removeTable(table.id)}>
                    Remove Table
                  </Button>
                </div>
              </div>
              
              {/* Advanced Options Display */}
              {(table.dualMotors || table.clusterId || cablePick) && (
                <div className="p-4 bg-muted/50 space-y-2">
                  <h4 className="font-medium text-sm">Configuration:</h4>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {table.dualMotors && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Dual Motors
                      </span>
                    )}
                    {table.clusterId && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        Mirrored Cluster
                      </span>
                    )}
                    {cablePick && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        Cable Pick ({cablePickWeight} kg)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Quantity</th>
                    <th className="px-4 py-3 text-left font-medium">Component</th>
                    <th className="px-4 py-3 text-left font-medium">Weight (per unit)</th>
                    <th className="px-4 py-3 text-left font-medium">Total Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.componentName}</td>
                      <td className="px-4 py-3">{row.weight} kg</td>
                      <td className="px-4 py-3">{row.totalWeight?.toFixed(2)} kg</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Total Weight:
                    </td>
                    <td className="px-4 py-3">{table.totalWeight?.toFixed(2)} kg</td>
                  </tr>
                </tbody>
              </table>
              {table.dualMotors && (
                <div className="px-4 py-2 text-sm text-gray-500 bg-muted/30 italic">
                  *This configuration uses dual motors. Load is distributed between two motors for safety and redundancy.
                </div>
              )}
              {table.riggingPoints && (
                <div className="px-4 py-2 text-sm text-blue-600 bg-blue-50 border-t">
                  <strong>Rigging Points:</strong> {table.riggingPoints}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PesosTool;
