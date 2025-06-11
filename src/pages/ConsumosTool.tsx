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
import { supabase } from '@/lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TourOverrideModeHeader } from '@/components/tours/TourOverrideModeHeader';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';

const soundComponentDatabase = [
  { id: 1, name: 'LA12X', watts: 2900 },
  { id: 2, name: 'LA8', watts: 2500 },
  { id: 3, name: 'LA4X', watts: 2000 },
  { id: 4, name: 'PLM20000D', watts: 2900 },
  { id: 5, name: 'Control FoH (L)', watts: 3500 },
  { id: 6, name: 'Control FoH (S)', watts: 1500 },
  { id: 7, name: 'Control Mon (L)', watts: 3500 },
  { id: 8, name: 'Control Mon (S)', watts: 1500 },
  { id: 9, name: 'RF Rack', watts: 2500 },
  { id: 10, name: 'Backline', watts: 2500 },
  { id: 11, name: 'Varios', watts: 1500 }
];

interface TableRow {
  quantity: string;
  componentId: string;
  watts: string;
  componentName?: string;
  totalWatts?: number;
}

interface Table {
  name: string;
  rows: TableRow[];
  totalWatts?: number;
  adjustedWatts?: number;
  currentPerPhase?: number;
  pduType?: string;
  customPduType?: string;
  id?: number | string;
  includesHoist?: boolean;
  isDefault?: boolean;
  isOverride?: boolean;
  overrideId?: string;
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();

  // NEW: Add tour defaults mode detection
  const tourId = searchParams.get('tourId');
  const mode = searchParams.get('mode');
  const isTourDefaults = mode === 'tour-defaults';

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [editingOverride, setEditingOverride] = useState<string | null>(null);

  // Tour override detection
  const isJobOverrideMode = Boolean(selectedJob?.tour_date_id);
  const tourDateId = selectedJob?.tour_date_id;

  // NEW: Get tour name for tour defaults mode
  const [tourName, setTourName] = useState<string>('');

  // Tour-specific hooks - use the new defaults system for tour mode
  const { 
    defaultSets,
    createSet,
    createTable: createTourDefaultTable 
  } = useTourDefaultSets(tourId || '');
  
  const { powerDefaults: legacyTourDefaults = [], createDefault: createLegacyTourDefault } = useTourPowerDefaults(tourId || '');
  const { 
    powerOverrides = [],
    createPowerOverride,
    deleteOverride,
    isCreatingOverride 
  } = useTourDateOverrides(tourDateId || '', 'power');

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
  });

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

  const VOLTAGE_3PHASE = 400;
  const POWER_FACTOR = 0.85;
  const PHASES = 3;

  const calculatePhaseCurrents = (totalWatts: number) => {
    const adjustedWatts = totalWatts * (1 + safetyMargin / 100);
    const wattsPerPhase = adjustedWatts / PHASES;
    const currentPerPhase = wattsPerPhase / (VOLTAGE_3PHASE * POWER_FACTOR);
    return { wattsPerPhase, currentPerPhase, adjustedWatts };
  };

  const PDU_TYPES = ['CEE32A 3P+N+G', 'CEE63A 3P+N+G', 'CEE125A 3P+N+G'];

  const recommendPDU = (current: number) => {
    if (current < 32) return PDU_TYPES[0];
    if (current > 63) return PDU_TYPES[2];
    return PDU_TYPES[2];
  };

  const savePowerRequirementTable = async (table: Table) => {
    try {
      const { error } = await supabase
        .from('power_requirement_tables')
        .insert({
          job_id: selectedJobId,
          department: 'sound',
          table_name: table.name,
          total_watts: table.totalWatts || 0,
          current_per_phase: table.currentPerPhase || 0,
          pdu_type: table.pduType === 'default' ? table.pduType : table.pduType,
          custom_pdu_type: table.customPduType,
          includes_hoist: table.includesHoist
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Power requirement table saved successfully",
      });
    } catch (error: any) {
      console.error('Error saving power requirement table:', error);
      toast({
        title: "Error",
        description: "Failed to save power requirement table",
        variant: "destructive"
      });
    }
  };

  // NEW: Save as tour defaults using the new system
  const saveTourDefault = async (table: Table) => {
    if (!tourId) return;

    try {
      // Get or create the sound set ID
      const setId = await getOrCreateSoundSetId();

      // Now create the table with the detailed data
      await createTourDefaultTable({
        set_id: setId,
        table_name: table.name,
        table_data: {
          rows: table.rows,
          safetyMargin: safetyMargin
        },
        table_type: 'power',
        total_value: table.totalWatts || 0,
        metadata: {
          current_per_phase: table.currentPerPhase,
          pdu_type: table.customPduType || table.pduType,
          custom_pdu_type: table.customPduType,
          safetyMargin: safetyMargin
        }
      });

      toast({
        title: "Success",
        description: "Tour default saved successfully",
      });
    } catch (error: any) {
      console.error('Error saving tour default:', error);
      toast({
        title: "Error",
        description: "Failed to save tour default",
        variant: "destructive"
      });
    }
  };

  const saveTourOverride = async (table: Table) => {
    if (!tourDateId) return;

    try {
      await createPowerOverride({
        tour_date_id: tourDateId,
        table_name: table.name,
        total_watts: table.totalWatts || 0,
        current_per_phase: table.currentPerPhase || 0,
        pdu_type: table.customPduType || table.pduType || '',
        custom_pdu_type: table.customPduType,
        includes_hoist: table.includesHoist || false,
        department: 'sound'
      });

      toast({
        title: "Success",
        description: "Tour override saved successfully",
      });
    } catch (error: any) {
      console.error('Error saving tour override:', error);
      toast({
        title: "Error",
        description: "Failed to save tour override",
        variant: "destructive"
      });
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    try {
      await deleteOverride({ id: overrideId, table: 'power' });
      
      toast({
        title: "Success",
        description: "Override deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting override:', error);
      toast({
        title: "Error",
        description: "Failed to delete override",
        variant: "destructive"
      });
    }
  };

  const handleEditOverride = (override: any) => {
    // Populate current table form with override data
    setTableName(override.table_name);
    setEditingOverride(override.id);
    
    // If override has detailed row data, populate that too
    if (override.override_data?.rows) {
      setCurrentTable({
        name: override.table_name,
        rows: override.override_data.rows
      });
    } else {
      // Create a single row with the total data
      setCurrentTable({
        name: override.table_name,
        rows: [{ quantity: '1', componentId: '', watts: override.total_watts.toString() }]
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

    const calculatedRows = currentTable.rows.map((row) => {
      const component = soundComponentDatabase.find((c) => c.id.toString() === row.componentId);
      const totalWatts =
        parseFloat(row.quantity || '0') && parseFloat(row.watts || '0')
          ? parseFloat(row.quantity) * parseFloat(row.watts)
          : 0;
      return {
        ...row,
        componentName: component?.name || '',
        totalWatts,
      };
    });

    const totalWatts = calculatedRows.reduce((sum, row) => sum + (row.totalWatts || 0), 0);
    const { currentPerPhase, adjustedWatts } = calculatePhaseCurrents(totalWatts);
    const pduSuggestion = recommendPDU(currentPerPhase);

    const newTable = {
      name: tableName,
      rows: calculatedRows,
      totalWatts,
      adjustedWatts,
      currentPerPhase,
      pduType: pduSuggestion,
      customPduType: '',
      includesHoist: false,
      id: Date.now(),
    };

    setTables((prev) => [...prev, newTable]);

    // NEW: Save based on mode - tour defaults mode
    if (isTourDefaults) {
      await saveTourDefault(newTable);
    } else if (isJobOverrideMode) {
      await saveTourOverride(newTable);
    } else if (selectedJobId) {
      await savePowerRequirementTable(newTable);
    }

    resetCurrentTable();
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [{ quantity: '', componentId: '', watts: '' }],
    });
    setTableName('');
    setEditingOverride(null);
  };

  const removeTable = (tableId: number | string) => {
    setTables((prev) => prev.filter((table) => table.id !== tableId));
  };

  const updateTableSettings = (tableId: number | string, updates: Partial<Table>) => {
    setTables((prev) =>
      prev.map((table) => {
        if (table.id === tableId) {
          const updatedTable = { ...table, ...updates };
          if (selectedJobId) {
            savePowerRequirementTable(updatedTable);
          }
          return updatedTable;
        }
        return table;
      })
    );
  };

  const handleExportPDF = async () => {
    if (!selectedJobId) {
      toast({
        title: 'No job selected',
        description: 'Please select a job before exporting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Generate power summary for consumos reports
      const totalSystemWatts = tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
      const totalSystemAmps = tables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0);
      const powerSummary = { totalSystemWatts, totalSystemAmps };

      let logoUrl: string | undefined = undefined;
      try {
        const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
        logoUrl = await fetchJobLogo(selectedJobId);
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const pdfBlob = await exportToPDF(
        selectedJob?.title || 'Power Report',
        tables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        selectedJob?.title || 'Power Report',
        selectedJob?.date || new Date().toISOString(),
        undefined, // summaryRows - undefined for power reports (auto-generated)
        powerSummary,
        safetyMargin,
        logoUrl
      );

      const fileName = `Sound Power Report - ${selectedJob?.title || 'Report'}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const filePath = `sound/${selectedJobId}/${crypto.randomUUID()}.pdf`;

      const { error: uploadError } = await supabase.storage.from('task_documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      toast({
        title: 'Success',
        description: 'PDF has been generated and uploaded successfully.',
      });

      // Also provide download to user
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
      toast({
        title: 'Error',
        description: 'Failed to generate or upload the PDF.',
        variant: 'destructive',
      });
    }
  };

  // NEW: Load tour name for display
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
    };

    fetchTourInfo();
  }, [tourId]);

  // Convert tour defaults to display format
  const tourDefaultTables = legacyTourDefaults.map(def => ({
    id: `default-${def.id}`,
    name: def.table_name,
    rows: [],
    totalWatts: def.total_watts,
    adjustedWatts: def.total_watts * (1 + safetyMargin / 100),
    currentPerPhase: def.current_per_phase,
    pduType: def.pdu_type,
    customPduType: def.custom_pdu_type,
    includesHoist: def.includes_hoist,
    isDefault: true
  }));

  // Convert tour overrides to display format
  const tourOverrideTables = powerOverrides.map(override => ({
    id: `override-${override.id}`,
    name: override.table_name,
    rows: override.override_data?.rows || [],
    totalWatts: override.total_watts,
    adjustedWatts: override.total_watts * (1 + safetyMargin / 100),
    currentPerPhase: override.current_per_phase,
    pduType: override.pdu_type,
    customPduType: override.custom_pdu_type,
    includesHoist: override.includes_hoist,
    isOverride: true,
    overrideId: override.id
  }));

  // Extract tour information from selected job
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
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sound')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl font-bold">Power Calculator</CardTitle>
            {/* NEW: Tour defaults mode indicator */}
            {isTourDefaults && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Tour Defaults
              </Badge>
            )}
            {isJobOverrideMode && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Override
              </Badge>
            )}
          </div>
        </div>
        {/* NEW: Tour defaults mode description */}
        {isTourDefaults && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Creating power defaults for tour: <span className="font-medium">{tourName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              These defaults will apply to all tour dates unless specifically overridden
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* NEW: Tour defaults mode notification */}
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

          {isJobOverrideMode && tourInfo && (
            <TourOverrideModeHeader
              tourName={tourInfo.tourName}
              tourDate={tourInfo.tourDate}
              locationName={tourInfo.locationName}
              defaultsCount={tourDefaultTables.length}
              overridesCount={powerOverrides.length}
              department="sound"
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="safetyMargin">Safety Margin</Label>
            <Select
              value={safetyMargin.toString()}
              onValueChange={(value) => setSafetyMargin(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Safety Margin" />
              </SelectTrigger>
              <SelectContent>
                {[0, 10, 20, 30, 40, 50].map((percentage) => (
                  <SelectItem key={percentage} value={percentage.toString()}>
                    {percentage}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isJobOverrideMode && !isTourDefaults && (
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

          {isJobOverrideMode && (
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

          {/* Display tour default tables when in override mode */}
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
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Default
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>Total Watts: <span className="font-medium">{table.totalWatts?.toFixed(2)} W</span></div>
                      <div>Current per Phase: <span className="font-medium">{table.currentPerPhase?.toFixed(2)} A</span></div>
                      <div>PDU Type: <span className="font-medium">{table.customPduType || table.pduType}</span></div>
                      {table.includesHoist && (
                        <div className="col-span-2 text-green-700">
                          ✓ Includes additional hoist power (CEE32A 3P+N+G)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Display existing tour overrides when in override mode */}
          {isJobOverrideMode && tourOverrideTables.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-orange-900">Existing Overrides</h3>
              {tourOverrideTables.map((table) => (
                <div key={table.id} className="border rounded-lg overflow-hidden bg-orange-50/30">
                  <div className="bg-orange-100 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-orange-900">{table.name}</h4>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        Override
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditOverride({ 
                          id: table.overrideId, 
                          table_name: table.name,
                          total_watts: table.totalWatts,
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>Total Watts: <span className="font-medium">{table.totalWatts?.toFixed(2)} W</span></div>
                      <div>Current per Phase: <span className="font-medium">{table.currentPerPhase?.toFixed(2)} A</span></div>
                      <div>PDU Type: <span className="font-medium">{table.customPduType || table.pduType}</span></div>
                      {table.includesHoist && (
                        <div className="col-span-2 text-orange-700">
                          ✓ Includes additional hoist power (CEE32A 3P+N+G)
                        </div>
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

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium">Component</th>
                  <th className="px-4 py-3 text-left font-medium">Watts (per unit)</th>
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
                        onValueChange={(value) => value && updateInput(index, 'componentId', value)}
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
                      <Input type="number" value={row.watts} readOnly className="w-full bg-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={addRow}>Add Row</Button>
            <Button 
              onClick={generateTable} 
              variant="secondary" 
              disabled={(!isJobOverrideMode && !isTourDefaults) && isCreatingOverride}
            >
              {editingOverride ? 'Update Override' : isTourDefaults ? 'Save Tour Default' : isJobOverrideMode ? 'Create Override' : 'Generate Table'}
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              {editingOverride ? 'Cancel Edit' : 'Reset'}
            </Button>
            {tables.length > 0 && !isTourDefaults && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="h-4 w-4" />
                Export & Upload PDF
              </Button>
            )}
          </div>

          {tables.map((table) => (
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6">
              <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <h3 className="font-semibold">{table.name}</h3>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeTable(table.id as number)}
                >
                  Remove Table
                </Button>
              </div>
              
              <div className="p-4 bg-muted/50 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`hoist-${table.id}`}
                      checked={table.includesHoist}
                      onCheckedChange={(checked) => 
                        updateTableSettings(table.id as number, { includesHoist: !!checked })
                      }
                    />
                    <Label htmlFor={`hoist-${table.id}`}>Requires additional hoist power (CEE32A 3P+N+G)</Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label>PDU Type Override:</Label>
                    <Select
                      value={table.customPduType || 'default'}
                      onValueChange={(value) => 
                        updateTableSettings(table.id as number, { 
                          customPduType: value === 'default' ? undefined : value 
                        })
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Use recommended PDU type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Use recommended PDU type</SelectItem>
                        {PDU_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom PDU Type</SelectItem>
                      </SelectContent>
                    </Select>
                    {table.customPduType === 'custom' && (
                      <Input
                        placeholder="Enter custom PDU type"
                        value={table.customPduType || ''}
                        onChange={(e) => updateTableSettings(table.id as number, { customPduType: e.target.value })}
                        className="w-[200px]"
                      />
                    )}
                  </div>
                </div>
              </div>

              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Quantity</th>
                    <th className="px-4 py-3 text-left font-medium">Component</th>
                    <th className="px-4 py-3 text-left font-medium">Watts (per unit)</th>
                    <th className="px-4 py-3 text-left font-medium">Total Watts</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.componentName}</td>
                      <td className="px-4 py-3">{row.watts}</td>
                      <td className="px-4 py-3">{row.totalWatts?.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Total Watts:
                    </td>
                    <td className="px-4 py-3">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                  {safetyMargin > 0 && (
                    <tr className="border-t bg-muted/50 font-medium">
                      <td colSpan={3} className="px-4 py-3 text-right">
                        Adjusted Watts ({safetyMargin}% safety margin):
                      </td>
                      <td className="px-4 py-3">{table.adjustedWatts?.toFixed(2)} W</td>
                    </tr>
                  )}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Current per Phase:
                    </td>
                    <td className="px-4 py-3">{table.currentPerPhase?.toFixed(2)} A</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      PDU Type:
                    </td>
                    <td className="px-4 py-3">
                      {table.customPduType || table.pduType}
                    </td>
                  </tr>
                  {table.includesHoist && (
                    <tr className="border-t bg-muted/50 font-medium">
                      <td colSpan={4} className="px-4 py-3">
                        Additional Hoist Power Required: CEE32A 3P+N+G
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConsumosTool;
