import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ArrowLeft, Save, Trash2 } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection, JobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import { Badge } from '@/components/ui/badge';
import { useOverrideManagement } from '@/hooks/useOverrideManagement';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const soundComponentDatabase = [
  { id: 1, name: ' K1 ', watts: 600 },
  { id: 2, name: ' K2 ', watts: 400 },
  { id: 3, name: ' K3 ', watts: 300 },
  { id: 4, name: ' KARA II ', watts: 250 },
  { id: 5, name: ' KIVA ', watts: 200 },
  { id: 6, name: ' KS28 ', watts: 800 },
  { id: 7, name: ' K1-SB ', watts: 700 },
  { id: 8, name: ' ROBERT JULIAT ARAMIS ', watts: 1200 },
  { id: 9, name: ' ROBERT JULIAT MERLIN ', watts: 1500 },
  { id: 10, name: ' ROBERT JULIAT CYRANO ', watts: 2500 },
  { id: 11, name: ' ROBERT JULIAT LANCELOT ', watts: 4000 },
  { id: 12, name: ' ROBERT JULIAT KORRIGAN ', watts: 700 },
];

const VOLTAGE_3PHASE = 400;
const POWER_FACTOR = 0.85;
const PHASES = 3;
const PDU_TYPES = ['CEE32A 3P+N+G', 'CEE63A 3P+N+G', 'CEE400A 3P+N+G'];

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
  currentPerPhase?: number;
  pduType?: string;
  customPduType?: string;
  id?: number | string;
  includesHoist?: boolean;
  isOverride?: boolean;
  overrideId?: string;
  defaultTableId?: string;
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  
  const tourId = searchParams.get('tourId');
  const tourDateId = searchParams.get('tourDateId');
  const mode = searchParams.get('mode');
  const isDefaults = mode === 'defaults';
  const isTourContext = !!tourId;
  const isTourDateContext = !!tourDateId;

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [selectedPduType, setSelectedPduType] = useState<string>('default');
  const [customPduType, setCustomPduType] = useState('');
  const [includesHoist, setIncludesHoist] = useState(false);
  const [currentSetName, setCurrentSetName] = useState('');
  const [isJobOverrideMode, setIsJobOverrideMode] = useState(false);
  const [jobTourInfo, setJobTourInfo] = useState<{ tourName: string; date: string; location: string } | null>(null);

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
  });

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
    unsavedTables,
    existingOverrides,
    addUnsavedTable,
    removeUnsavedTable,
    saveAllOverrides,
    deleteOverrideTable,
    setJobOverrideContext,
    hasUnsavedChanges,
    overridesLoading
  } = useOverrideManagement(
    isTourDateContext ? tourDateId : null,
    'sound',
    'power'
  );

  const [tourName, setTourName] = useState<string>('');
  const [tourDateInfo, setTourDateInfo] = useState<{ date: string; location: string } | null>(null);

  useEffect(() => {
    if (selectedJob?.tour_date_id && !isTourContext) {
      setIsJobOverrideMode(true);
      setJobOverrideContext(selectedJob.tour_date_id);
      loadJobTourInfo();
    } else {
      setIsJobOverrideMode(false);
      setJobOverrideContext(null);
      setJobTourInfo(null);
    }
  }, [selectedJob, isTourContext, setJobOverrideContext]);

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
      const convertedTables = defaultTables
        .filter(dt => dt.table_type === 'power')
        .map((dt, index) => ({
          name: dt.table_name,
          rows: dt.table_data.rows || [{
            quantity: '1',
            componentId: '',
            watts: dt.total_value.toString(),
            componentName: dt.table_name,
            totalWatts: dt.total_value
          }],
          totalWatts: dt.total_value,
          currentPerPhase: dt.metadata?.currentPerPhase,
          pduType: dt.metadata?.pduType,
          customPduType: dt.metadata?.customPduType,
          includesHoist: dt.metadata?.includesHoist,
          id: Date.now() + index,
          defaultTableId: dt.id
        }));
      setTables(convertedTables);
    }
  }, [isDefaults, defaultTables]);

  // Load existing overrides
  useEffect(() => {
    if ((isTourDateContext || isJobOverrideMode) && existingOverrides.length > 0) {
      const convertedTables = existingOverrides.map((override, index) => ({
        name: override.table_name || override.item_name,
        rows: override.override_data?.tableData?.rows || [{
          quantity: '1',
          componentId: '',
          watts: override.total_watts.toString(),
          componentName: override.table_name || override.item_name,
          totalWatts: override.total_watts
        }],
        totalWatts: override.total_watts,
        currentPerPhase: override.current_per_phase,
        pduType: override.pdu_type,
        customPduType: override.custom_pdu_type,
        includesHoist: override.includes_hoist,
        id: `override-${override.id}`,
        overrideId: override.id,
        isOverride: true
      }));
      setTables(convertedTables);
    }
  }, [isTourDateContext, isJobOverrideMode, existingOverrides]);

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

  const calculateCurrentPerPhase = (totalWatts: number): number => {
    return totalWatts / (VOLTAGE_3PHASE * POWER_FACTOR * Math.sqrt(PHASES));
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
      const defaultSet = await createSet({
        tour_id: tourId,
        name: currentSetName,
        description: `Power calculation set with ${tables.length} tables`,
        department: 'sound'
      });

      for (const table of tables) {
        await createDefaultTable({
          set_id: defaultSet.id,
          table_name: table.name,
          table_data: {
            rows: table.rows,
            toolType: 'consumos'
          },
          table_type: 'power',
          total_value: table.totalWatts || 0,
          metadata: {
            currentPerPhase: table.currentPerPhase,
            pduType: table.pduType,
            customPduType: table.customPduType,
            includesHoist: table.includesHoist
          }
        });
      }

      toast({
        title: 'Success',
        description: `Default set "${currentSetName}" saved successfully`,
      });

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

  const generateTable = () => {
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
        parseFloat(row.quantity) && parseFloat(row.watts)
          ? parseFloat(row.quantity) * parseFloat(row.watts)
          : 0;
      return {
        ...row,
        componentName: component?.name || '',
        totalWatts,
      };
    });

    const totalWatts = calculatedRows.reduce((sum, row) => sum + (row.totalWatts || 0), 0);
    const currentPerPhase = calculateCurrentPerPhase(totalWatts);

    const finalPduType = selectedPduType === 'custom' ? customPduType : 
                        selectedPduType === 'default' ? PDU_TYPES[0] : selectedPduType;

    const newTable: Table = {
      name: tableName,
      rows: calculatedRows,
      totalWatts,
      currentPerPhase,
      pduType: finalPduType,
      customPduType: selectedPduType === 'custom' ? customPduType : undefined,
      includesHoist,
      id: Date.now(),
      isOverride: isTourDateContext || isJobOverrideMode
    };

    if (isDefaults) {
      setTables((prev) => [...prev, newTable]);
    } else if (isTourDateContext || isJobOverrideMode) {
      // Add to unsaved tables instead of saving immediately
      addUnsavedTable(newTable);
    } else {
      setTables((prev) => [...prev, newTable]);
    }
    
    resetCurrentTable();
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [{ quantity: '', componentId: '', watts: '' }],
    });
    setTableName('');
    setSelectedPduType('default');
    setCustomPduType('');
    setIncludesHoist(false);
  };

  const removeTable = (tableId: number | string) => {
    if (typeof tableId === 'string' && tableId.startsWith('override-')) {
      removeUnsavedTable(tableId);
    } else {
      setTables((prev) => prev.filter((table) => table.id !== tableId));
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    const success = await deleteOverrideTable(overrideId);
    if (success) {
      setTables((prev) => prev.filter((table) => table.overrideId !== overrideId));
    }
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

    try {
      const totalSystemWatts = tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
      const totalSystemAmps = tables.reduce((sum, table) => sum + (table.currentPerPhase || 0) * 3, 0);
      const powerSummary = { totalSystemWatts, totalSystemAmps };

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
        tables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        selectedJob.title,
        jobDateStr,
        undefined,
        powerSummary,
        safetyMargin,
        logoUrl
      );

      const fileName = `Consumos Report - ${selectedJob.title}.pdf`;
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
              Power Calculator
            </CardTitle>
            {isDefaults && (
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
            {isTourContext && !isDefaults && !isTourDateContext && (
              <p className="text-sm text-muted-foreground mt-1">
                Creating power requirements for tour: <span className="font-medium">{tourName}</span>
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
          {/* Override mode notifications */}
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

          {/* Manual save section for override modes */}
          {(isTourDateContext || isJobOverrideMode) && hasUnsavedChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    Unsaved Override Tables ({unsavedTables.length})
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    You have unsaved override tables. Save them when ready.
                  </p>
                </div>
                <Button
                  onClick={saveAllOverrides}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Override Tables
                </Button>
              </div>
            </div>
          )}

          {isDefaults && (
            <div className="space-y-2">
              <Label htmlFor="setName">Default Set Name</Label>
              <Input
                id="setName"
                value={currentSetName}
                onChange={(e) => setCurrentSetName(e.target.value)}
                placeholder="Enter set name (e.g., 'Main Stage Power')"
              />
            </div>
          )}

          {!isTourContext && (
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">
                {isDefaults ? 'Power Default Name' : 'Table Name'}
              </Label>
              <Input
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder={isDefaults ? "Enter default name (e.g., K2 Array)" : "Enter table name"}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="safetyMargin">Safety Margin (%)</Label>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pduType">PDU Type</Label>
              <Select
                value={selectedPduType}
                onValueChange={setSelectedPduType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PDU Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default ({PDU_TYPES[0]})</SelectItem>
                  {PDU_TYPES.slice(1).map((pdu) => (
                    <SelectItem key={pdu} value={pdu}>
                      {pdu}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {selectedPduType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="customPduType">Custom PDU Type</Label>
                <Input
                  id="customPduType"
                  value={customPduType}
                  onChange={(e) => setCustomPduType(e.target.value)}
                  placeholder="Enter custom PDU type"
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includesHoist"
              checked={includesHoist}
              onCheckedChange={(checked) => setIncludesHoist(checked as boolean)}
            />
            <Label htmlFor="includesHoist" className="text-sm font-medium">
              Includes Hoist Power Requirement
            </Label>
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
                      <Input type="number" value={row.watts} readOnly className="w-full bg-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={addRow}>Add Row</Button>
            <Button onClick={generateTable} variant="secondary">
              {isDefaults ? 'Save Default' : 'Generate Table'}
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {tables.length > 0 && !isDefaults && !isTourContext && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="w-4 h-4" />
                Export &amp; Upload PDF
              </Button>
            )}
          </div>

          {/* Display unsaved override tables */}
          {unsavedTables.map((table) => (
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6 border-yellow-300">
              <div className="bg-yellow-50 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{table.name}</h3>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Unsaved Override</Badge>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeUnsavedTable(table.id!)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
                      Total Power:
                    </td>
                    <td className="px-4 py-3">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="px-4 py-3 text-sm text-gray-600 bg-muted/30">
                <p>Current per Phase: {table.currentPerPhase?.toFixed(2)} A</p>
                <p>PDU: {table.customPduType || table.pduType}</p>
                {table.includesHoist && <p className="italic">Additional Hoist Power Required: CEE32A 3P+N+G</p>}
              </div>
            </div>
          ))}

          {/* Display saved override tables */}
          {tables.filter(table => table.isOverride).map((table) => (
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6 border-blue-300">
              <div className="bg-blue-50 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{table.name}</h3>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">Saved Override</Badge>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Override Table</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this override table? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => table.overrideId && handleDeleteOverride(table.overrideId)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                      Total Power:
                    </td>
                    <td className="px-4 py-3">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="px-4 py-3 text-sm text-gray-600 bg-muted/30">
                <p>Current per Phase: {table.currentPerPhase?.toFixed(2)} A</p>
                <p>PDU: {table.customPduType || table.pduType}</p>
                {table.includesHoist && <p className="italic">Additional Hoist Power Required: CEE32A 3P+N+G</p>}
              </div>
            </div>
          ))}

          {/* Display regular tables */}
          {tables.filter(table => !table.isOverride).map((table) => (
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6">
              <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <h3 className="font-semibold">{table.name}</h3>
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
                      Total Power:
                    </td>
                    <td className="px-4 py-3">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="px-4 py-3 text-sm text-gray-600 bg-muted/30">
                <p>Current per Phase: {table.currentPerPhase?.toFixed(2)} A</p>
                <p>PDU: {table.customPduType || table.pduType}</p>
                {table.includesHoist && <p className="italic">Additional Hoist Power Required: CEE32A 3P+N+G</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConsumosTool;
