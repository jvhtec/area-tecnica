import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ArrowLeft, Trash2 } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { useTourOverrideMode } from '@/hooks/useTourOverrideMode';
import { TourOverrideModeHeader } from '@/components/tours/TourOverrideModeHeader';
import { Badge } from '@/components/ui/badge';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import {
  CUSTOM_POWER_POSITION_VALUE,
  getPowerPositionCustomValue,
  getPowerPositionSelectValue,
  NO_POWER_POSITION_VALUE,
  POWER_POSITION_PRESETS,
} from '@/utils/powerPositions';

const videoComponentDatabase = [
  { id: 1, name: 'Pantalla Central', watts: 700 },
  { id: 2, name: 'IMAGE Left', watts: 700 },
  { id: 3, name: 'IMAGE Right', watts: 700 },
  { id: 4, name: 'LED Screen', watts: 700 }
];

const SQRT3 = Math.sqrt(3);
const PDU_TYPES_THREE = ['CEE16A 3P+N+G', 'CEE32A 3P+N+G', 'CEE63A 3P+N+G', 'CEE125A 3P+N+G', 'Powerlock 400A 3P+N+G'];
const PDU_TYPES_SINGLE = ['Schuko 16A', 'CEE32A 1P+N+G', 'CEE63A 1P+N+G'];
const TABLE_SETTINGS_SAVE_DEBOUNCE_MS = 300;

interface TableRow {
  quantity: string;
  componentId: string;
  watts: string;
  componentName?: string;
  lineName?: string;
  totalWatts?: number;
}

interface Table {
  name: string;
  rows: TableRow[];
  totalWatts?: number;
  adjustedWatts?: number;
  totalVa?: number;
  currentPerPhase?: number;
  pduType?: string;
  customPduType?: string;
  position?: string;
  customPosition?: string;
  id?: number | string;
  includesHoist?: boolean;
  isDefault?: boolean;
}

const VideoConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');
  
  // Tour override mode detection
  const tourId = searchParams.get('tourId');
  const tourDateId = searchParams.get('tourDateId');
  const mode = searchParams.get('mode');
  const isTourDefaults = mode === 'tour-defaults';
  
  const { 
    isOverrideMode, 
    overrideData, 
    isLoading: overrideLoading,
    saveOverride 
  } = useTourOverrideMode(tourId || undefined, tourDateId || undefined, 'video');

  // Tour defaults hooks
  const { 
    defaultSets,
    createSet,
    createTable: createTourDefaultTable 
  } = useTourDefaultSets(tourId || '');

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [fohSchukoRequired, setFohSchukoRequired] = useState<boolean>(true);
  const [safetyMargin, setSafetyMargin] = useState(20);
  const [phaseMode, setPhaseMode] = useState<'single' | 'three'>('three');
  const [pf, setPf] = useState<number>(0.9);
  const [voltage, setVoltage] = useState<number>(400);
  const [tourName, setTourName] = useState<string>('');

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
    position: undefined,
    customPosition: undefined,
  });
  const pendingTableSaveTimeoutsRef = useRef<Record<string, number>>({});

  // Auto-adjust voltage based on supply type
  useEffect(() => {
    setVoltage(phaseMode === 'single' ? 230 : 400);
  }, [phaseMode]);

  useEffect(() => {
    return () => {
      Object.values(pendingTableSaveTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

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
        const { data } = await supabase
          .from('jobs')
          .select('id, title, start_time')
          .eq('id', jobIdFromUrl)
          .single();
        if (data) setSelectedJob(data);
      } catch {}
    };
    applyJobFromUrl();
  }, [jobIdFromUrl, jobs]);

  // Helper function to get or create the set ID for video department
  const getOrCreateVideoSetId = async (): Promise<string> => {
    // Check if a video set already exists
    const existingVideoSet = defaultSets.find(set => set.department === 'video');
    
    if (existingVideoSet) {
      return existingVideoSet.id;
    }

    // Create a new video set
    const newSet = await createSet({
      tour_id: tourId!,
      name: `${tourName} Video Defaults`,
      department: 'video',
      description: 'Video department power defaults'
    });
    
    return newSet.id;
  };

  // NEW: Save as tour defaults using the new system
  const saveTourDefault = async (table: Table) => {
    if (!tourId) return;

    try {
      // Get or create the video set ID
      const setId = await getOrCreateVideoSetId();

      // Now create the table with the detailed data
      await createTourDefaultTable({
        set_id: setId,
        table_name: table.name,
        table_data: {
          rows: table.rows,
          safetyMargin,
          pf,
          phaseMode,
          voltage
        },
        table_type: 'power',
        total_value: table.totalWatts || 0,
        metadata: {
          current_per_phase: table.currentPerPhase,
          pdu_type: table.customPduType || table.pduType,
          custom_pdu_type: table.customPduType,
          includes_hoist: table.includesHoist || false,
          position: table.position,
          custom_position: table.customPosition,
          safetyMargin,
          pf,
          phaseMode,
          voltage
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
      const component = videoComponentDatabase.find((c) => c.id.toString() === value);
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
    if (!jobId) return;
    setSelectedJobId(jobId);
    const job = jobs?.find((j) => j.id === jobId) || null;
    setSelectedJob(job);
  };

  const calculateLineCurrent = (totalWatts: number) => {
    const adjustedWatts = totalWatts * (1 + safetyMargin / 100);
    const currentLine = phaseMode === 'single'
      ? adjustedWatts / (voltage * pf)
      : adjustedWatts / (SQRT3 * voltage * pf);
    return { adjustedWatts, currentLine };
  };

  const PDU_TYPES = phaseMode === 'single' ? PDU_TYPES_SINGLE : PDU_TYPES_THREE;
  const planningLimit = (amps: number) => amps * 0.8;
  const recommendPDU = (currentLine: number) => {
    if (phaseMode === 'single') {
      if (currentLine <= planningLimit(16)) return PDU_TYPES_SINGLE[0];
      if (currentLine <= planningLimit(32)) return PDU_TYPES_SINGLE[1];
      return PDU_TYPES_SINGLE[2];
    }
    if (currentLine <= planningLimit(16)) return PDU_TYPES_THREE[0];
    if (currentLine <= planningLimit(32)) return PDU_TYPES_THREE[1];
    if (currentLine <= planningLimit(63)) return PDU_TYPES_THREE[2];
    if (currentLine <= planningLimit(125)) return PDU_TYPES_THREE[3];
    return PDU_TYPES_THREE[4];
  };

  const savePowerRequirementTable = async (table: Table) => {
    if (isOverrideMode && overrideData) {
      // Save as override for tour date
      const overrideSuccess = await saveOverride('power', {
        table_name: table.name,
        total_watts: table.totalWatts || 0,
        current_per_phase: table.currentPerPhase || 0,
        pdu_type: table.customPduType || table.pduType || '',
        custom_pdu_type: table.customPduType,
        position: table.position || null,
        custom_position: table.customPosition || null,
        includes_hoist: table.includesHoist || false,
        override_data: {
          rows: table.rows,
          safetyMargin: safetyMargin
        }
      });

      if (overrideSuccess) {
        toast({
          title: "Success",
          description: "Override saved for tour date",
        });
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('power_requirement_tables')
        .insert({
          job_id: selectedJobId,
          department: 'video',
          table_name: table.name,
          total_watts: table.totalWatts || 0,
          current_per_phase: table.currentPerPhase || 0,
          pdu_type: table.customPduType || table.pduType || '',
          custom_pdu_type: table.customPduType,
          position: table.position || null,
          custom_position: table.customPosition || null,
          table_data: { rows: table.rows },
          includes_hoist: table.includesHoist || false
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
      const component = videoComponentDatabase.find((c) => c.id.toString() === row.componentId);
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
    const { adjustedWatts, currentLine } = calculateLineCurrent(totalWatts);
    const pduSuggestion = recommendPDU(currentLine);
    const totalVa = pf > 0 ? adjustedWatts / pf : adjustedWatts; // apparent power (VA) with safety margin

    const newTable = {
      name: tableName,
      rows: calculatedRows,
      totalWatts,
      adjustedWatts,
      totalVa,
      currentPerPhase: currentLine,
      pduType: pduSuggestion,
      customPduType: undefined,
      position: currentTable.position,
      customPosition: currentTable.customPosition,
      includesHoist: false,
      id: Date.now(),
    };

    setTables((prev) => [...prev, newTable]);
    
    // Save based on mode
    if (isTourDefaults) {
      await saveTourDefault(newTable);
    } else if (selectedJobId) {
      await savePowerRequirementTable(newTable);
    }
    
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
  };

  const removeTable = (tableId: number | string) => {
    // Only allow removal of regular tables (numeric IDs), not default tables
    if (typeof tableId === 'number') {
      setTables((prev) => prev.filter((table) => table.id !== tableId));
    }
  };

  const scheduleTableSettingsSave = (table: Table) => {
    if (isTourDefaults || !selectedJobId || table.id === undefined) {
      return;
    }

    const timeoutKey = String(table.id);
    const existingTimeout = pendingTableSaveTimeoutsRef.current[timeoutKey];
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    pendingTableSaveTimeoutsRef.current[timeoutKey] = window.setTimeout(() => {
      delete pendingTableSaveTimeoutsRef.current[timeoutKey];

      void savePowerRequirementTable(table).catch((error) => {
        console.error('Error saving table settings:', error);
      });
    }, TABLE_SETTINGS_SAVE_DEBOUNCE_MS);
  };

  const updateTableSettings = (tableId: number | string, updates: Partial<Table>) => {
    const existingTable = tables.find((table) => table.id === tableId);
    if (!existingTable) {
      return;
    }

    const updatedTable = { ...existingTable, ...updates };

    setTables((prev) =>
      prev.map((table) => (table.id === tableId ? updatedTable : table))
    );

    scheduleTableSettingsSave(updatedTable);
  };

  const handleExportPDF = async () => {
    const jobToUse = isOverrideMode && overrideData 
      ? { id: 'override', title: `${overrideData.tourName} - ${overrideData.locationName}` }
      : selectedJob;

    if (!jobToUse) {
      toast({
        title: isOverrideMode ? 'No tour data' : 'No job selected',
        description: isOverrideMode ? 'Tour data not loaded' : 'Please select a job before exporting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Combine defaults and current tables for export
      const allTables = isOverrideMode 
        ? [...defaultTables, ...tables]
        : tables;

      // Generate power summary for consumos reports
      const totalSystemWatts = allTables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
      const totalSystemAmps = allTables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0);
      const totalSystemKva = allTables.reduce((sum, table) => sum + (table.totalVa || table.totalWatts || 0), 0) / 1000;
      const powerSummary = { totalSystemWatts, totalSystemAmps, totalSystemKva };

      let logoUrl: string | undefined = undefined;
      try {
        if (isOverrideMode && tourId) {
          const { fetchTourLogo } = await import('@/utils/pdf/logoUtils');
          logoUrl = await fetchTourLogo(tourId);
        } else if (selectedJobId) {
          const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
          logoUrl = await fetchJobLogo(selectedJobId);
        }
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const pdfBlob = await exportToPDF(
        jobToUse.title,
        allTables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        jobToUse.title,
        jobToUse?.start_time || new Date().toISOString(),
        undefined,
        powerSummary,
        safetyMargin,
        logoUrl,
        fohSchukoRequired
      );

      const fileName = `Video Power Report - ${jobToUse.title}.pdf`;
      
      // Auto-complete video Consumos tasks only after successful upload
      // This automation is department-specific: only video department tasks are affected
      let completedTasksCount = 0;
      if (!isTourDefaults && selectedJobId) {
        try {
          const { uploadJobPdfWithCleanup } = await import('@/utils/jobDocumentsUpload');
          await uploadJobPdfWithCleanup(selectedJobId, pdfBlob, fileName, 'calculators/consumos');
          
          // Auto-complete Consumos tasks for video department only
          const { autoCompleteConsumosTasks } = await import('@/utils/taskAutoCompletion');
          const result = await autoCompleteConsumosTasks(selectedJobId, 'video');
          completedTasksCount = result.completedCount;
          
          if (result.completedCount > 0) {
            console.log(`Auto-completed ${result.completedCount} video Consumos task(s)`);
          }
        } catch (err) {
          // If auto-completion fails, log but don't fail the upload
          if (err instanceof Error && err.message.includes('uploadJobPdfWithCleanup')) {
            throw err; // Re-throw upload errors
          }
          console.warn('Task auto-completion failed:', err);
        }
        
        toast({
          title: 'Success',
          description: completedTasksCount > 0
            ? `PDF uploaded successfully. ${completedTasksCount} Consumos task(s) auto-completed.`
            : 'PDF has been generated and uploaded successfully.'
        });
      } else {
        toast({ title: 'Success', description: 'PDF has been generated successfully.' });
      }

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

  const [defaultTables, setDefaultTables] = useState<Table[]>([]);

  // Load defaults when in override mode
  useEffect(() => {
    if (isOverrideMode && overrideData) {
      const powerDefaults = overrideData.defaults
        .filter(table => table.table_type === 'power')
        .map(table => {
          const w = table.total_value || 0;
          const adjW = w * (1 + safetyMargin / 100);
          return {
            name: `${table.table_name} (Default)`,
            rows: table.table_data.rows || [],
            totalWatts: table.total_value,
            adjustedWatts: adjW,
            totalVa: pf > 0 ? adjW / pf : adjW,
            currentPerPhase: table.metadata?.current_per_phase,
            pduType: table.metadata?.pdu_type,
            customPduType: table.metadata?.custom_pdu_type,
            includesHoist: table.metadata?.includes_hoist || false,
            position: table.metadata?.position,
            customPosition: table.metadata?.custom_position,
            id: `default-${table.id}`,
            isDefault: true
          };
        });
      
      setDefaultTables(powerDefaults);
    }
  }, [isOverrideMode, overrideData]);

  // Load tour name for display
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

  if (overrideLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto my-6">
        <CardContent className="pt-6">
          <p>Loading tour override data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/video')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl font-bold">
              {isOverrideMode ? 'Override Mode - ' : ''}Power Calculator
            </CardTitle>
            {isTourDefaults && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Tour Defaults
              </Badge>
            )}
          </div>
        </div>
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

          {isOverrideMode && overrideData && (
            <TourOverrideModeHeader
              tourName={overrideData.tourName}
              tourDate={overrideData.tourDate}
              locationName={overrideData.locationName}
              defaultsCount={defaultTables.length}
              overridesCount={tables.length}
              department="video"
            />
          )}

          {/* Show defaults section when in override mode */}
          {isOverrideMode && defaultTables.length > 0 && (
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="font-semibold mb-3 text-green-800">Tour Defaults (Read-Only)</h3>
              {defaultTables.map((table) => (
                <div key={table.id} className="border rounded-lg overflow-x-auto mt-4 bg-white">
                  <div className="bg-green-100 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{table.name}</h4>
                      <Badge variant="outline" className="bg-green-50 text-green-700">Default</Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Watts:</span> {table.totalWatts?.toFixed(2)} W
                      </div>
                      <div>
                        <span className="font-medium">Potencia Aparente:</span> {((table.totalVa || table.totalWatts || 0) / 1000).toFixed(2)} kVA
                      </div>
                      <div>
                        <span className="font-medium">{phaseMode === 'three' ? 'Current per Phase:' : 'Current:'}</span> {table.currentPerPhase?.toFixed(2)} A
                      </div>
                      <div>
                        <span className="font-medium">PDU Type:</span> {table.customPduType || table.pduType}
                      </div>
                      <div>
                        <span className="font-medium">Position:</span> {table.customPosition || table.position || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Supply / Voltage / PF controls to match sound tool */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-xs text-muted-foreground">230 V (1φ) o 400 V LL (3φ) por defecto</p>
            </div>
            <div className="space-y-2">
              <Label>Power Factor (PF)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.1"
                max="1"
                value={pf}
                onChange={(e) => setPf(Math.max(0.1, Math.min(1, Number(e.target.value) || 0.85)))}
              />
              <p className="text-xs text-muted-foreground">Usa 0.9 como referencia</p>
            </div>
          </div>

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

          {!jobIdFromUrl && (
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

          <div className="flex items-center space-x-2">
            <Checkbox id="foh-schuko" checked={fohSchukoRequired} onCheckedChange={(c) => setFohSchukoRequired(!!c)} />
            <Label htmlFor="foh-schuko">Se requiere potencia de 16A en formato schuko hembra en posicion FoH</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableName">
              {isTourDefaults ? 'Default Name' : 'Table Name'}
            </Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={isTourDefaults ? "Enter default name" : "Enter table name"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Component</th>
                  <th className="px-4 py-3 text-left font-medium">Watts (per unit)</th>
                  <th className="w-12 px-4 py-3 text-left font-medium">&nbsp;</th>
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
                      <Input
                        value={row.lineName || ''}
                        onChange={(e) => updateInput(index, 'lineName', e.target.value)}
                        placeholder="Optional line name"
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
                          {videoComponentDatabase.map((component) => (
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

          <div className="flex gap-2">
            <Button onClick={addRow}>Add Row</Button>
            <Button onClick={generateTable} variant="secondary">
              {isTourDefaults ? 'Save Tour Default' : 'Generate Table'}
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {tables.length > 0 && !isTourDefaults && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="h-4 w-4" />
                Export & Upload PDF
              </Button>
            )}
          </div>

          {/* Updated tables section to show safety margin adjusted watts */}
          {tables.map((table) => (
            <div key={table.id} className="border rounded-lg overflow-x-auto mt-6">
              <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{table.name}</h3>
                  {isOverrideMode && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">Override</Badge>
                  )}
                </div>
                {typeof table.id === 'number' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeTable(table.id as number)}
                  >
                    Remove Table
                  </Button>
                )}
              </div>
              <div className="p-4 bg-muted/50 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`hoist-${table.id}`}
                      checked={table.includesHoist}
                      onCheckedChange={(checked) => {
                        updateTableSettings(table.id as number | string, { includesHoist: !!checked });
                      }}
                    />
                    <Label htmlFor={`hoist-${table.id}`}>Requires additional hoist power (CEE32A 3P+N+G)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>PDU Type Override:</Label>
                    <Select
                      value={table.customPduType ? ((phaseMode === 'single' ? PDU_TYPES_SINGLE : PDU_TYPES_THREE).includes(table.customPduType) ? table.customPduType : 'custom') : 'default'}
                      onValueChange={(value) => {
                        if (value === 'default') {
                          updateTableSettings(table.id as number | string, { customPduType: undefined });
                          return;
                        }
                        if (value === 'custom') {
                          updateTableSettings(table.id as number | string, { customPduType: '' });
                          return;
                        }
                        updateTableSettings(table.id as number | string, { customPduType: value });
                      }}
                    >
                      <SelectTrigger className="w-[220px]"><SelectValue placeholder="Use recommended PDU type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Use recommended ({table.pduType})</SelectItem>
                        {(phaseMode === 'single' ? PDU_TYPES_SINGLE : PDU_TYPES_THREE).map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                        <SelectItem value="custom">Custom PDU Type</SelectItem>
                      </SelectContent>
                    </Select>
                    {table.customPduType !== undefined && !((phaseMode === 'single' ? PDU_TYPES_SINGLE : PDU_TYPES_THREE).includes(table.customPduType || '')) && (
                      <Input
                        placeholder="Enter custom PDU type"
                        value={table.customPduType || ''}
                        onChange={(e) => updateTableSettings(table.id as number | string, { customPduType: e.target.value })}
                        className="w-[220px]"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Label>Position:</Label>
                      <Select
                        value={getPowerPositionSelectValue(table.position, table.customPosition)}
                        onValueChange={(value) => {
                          if (value === NO_POWER_POSITION_VALUE) {
                            updateTableSettings(table.id as number | string, { position: undefined, customPosition: undefined });
                            return;
                          }
                          if (value === CUSTOM_POWER_POSITION_VALUE) {
                            updateTableSettings(table.id as number | string, { position: undefined, customPosition: '' });
                            return;
                          }
                          updateTableSettings(table.id as number | string, { position: value, customPosition: undefined });
                        }}
                      >
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="No position" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_POWER_POSITION_VALUE}>No position</SelectItem>
                          {POWER_POSITION_PRESETS.map((position) => (
                            <SelectItem key={position} value={position}>{position}</SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_POWER_POSITION_VALUE}>Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {getPowerPositionSelectValue(table.position, table.customPosition) === CUSTOM_POWER_POSITION_VALUE && (
                      <Input
                        placeholder="Enter custom position"
                        value={getPowerPositionCustomValue(table.position, table.customPosition)}
                        onChange={(e) =>
                          updateTableSettings(table.id as number | string, { position: undefined, customPosition: e.target.value })
                        }
                        className="w-[220px]"
                      />
                    )}
                  </div>
                </div>
              </div>
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Quantity</th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Component</th>
                    <th className="px-4 py-3 text-left font-medium">Watts (per unit)</th>
                    <th className="px-4 py-3 text-left font-medium">Total Watts</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.lineName || 'N/A'}</td>
                      <td className="px-4 py-3">{row.componentName}</td>
                      <td className="px-4 py-3">{row.watts}</td>
                      <td className="px-4 py-3">{row.totalWatts?.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      Total Watts:
                    </td>
                    <td className="px-4 py-3">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                  {safetyMargin > 0 && (
                    <tr className="border-t bg-muted/50 font-medium">
                      <td colSpan={4} className="px-4 py-3 text-right">
                        Adjusted Watts ({safetyMargin}% safety margin):
                      </td>
                      <td className="px-4 py-3">{table.adjustedWatts?.toFixed(2)} W</td>
                    </tr>
                  )}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      Potencia Aparente:
                    </td>
                    <td className="px-4 py-3">{((table.totalVa || table.totalWatts || 0) / 1000).toFixed(2)} kVA</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      {phaseMode === 'three' ? 'Current per Phase:' : 'Current:'}
                    </td>
                    <td className="px-4 py-3">{table.currentPerPhase?.toFixed(2)} A</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      PDU Type:
                    </td>
                    <td className="px-4 py-3">
                      {table.customPduType || table.pduType}
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      Position:
                    </td>
                    <td className="px-4 py-3">
                      {table.customPosition || table.position || 'N/A'}
                    </td>
                  </tr>
                  {table.includesHoist && (
                    <tr className="border-t bg-muted/50 font-medium">
                      <td colSpan={5} className="px-4 py-3">
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

export default VideoConsumosTool;
