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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { useTourPowerDefaults } from '@/hooks/useTourPowerDefaults';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import { useTourDateOverrides } from '@/hooks/useTourDateOverrides';

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
  { id: 11, name: 'Varios', watts: 1500 },
  { id: 12, name: 'Shure ULXD', watts: 1000 },
  { id: 13, name: 'Yamaha CL5', watts: 1200 },
];

const VOLTAGE_3PHASE = 400;
const POWER_FACTOR = 0.85;
const PHASES = 3;

const PDU_TYPES = ['CEE32A 3P+N+G', 'CEE63A 3P+N+G', 'CEE125A 3P+N+G'];

interface TableRow {
  quantity: string;
  componentId: string;
  watts: string;
  componentName?: string;
  totalWatts?: number;
}

export interface Table {
  name: string;
  rows: TableRow[];
  totalWatts?: number;
  currentPerPhase?: number;
  pduType?: string;
  id?: number;
  includesHoist?: boolean;
  customPduType?: string;
  defaultTableId?: string;
  overrideId?: string;
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  
  // Tour context detection
  const tourId = searchParams.get('tourId');
  const tourDateId = searchParams.get('tourDateId');
  const mode = searchParams.get('mode'); // 'defaults' or 'override'
  const isDefaults = mode === 'defaults';
  const isTourContext = !!tourId;
  const isTourDateContext = !!tourDateId;

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [currentSetName, setCurrentSetName] = useState('');
  const [tourInfo, setTourInfo] = useState<{ name: string; date?: string; location?: string } | null>(null);

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
  });

  // New hooks for tour defaults
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
    powerOverrides,
    createPowerOverride,
    deleteOverride,
    isLoading: overridesLoading
  } = useTourDateOverrides(tourDateId || '', 'power');

  // Get tour information for display
  useEffect(() => {
    const fetchTourInfo = async () => {
      if (tourId) {
        const { data } = await supabase
          .from('tours')
          .select('name')
          .eq('id', tourId)
          .single();
        
        if (data) {
          setTourInfo({ name: data.name });
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
          setTourInfo({
            name: tourInfo?.name || 'Tour',
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
          currentPerPhase: dt.metadata?.currentPerPhase || 0,
          pduType: dt.metadata?.pduType || '',
          customPduType: dt.metadata?.customPduType,
          includesHoist: dt.metadata?.includesHoist || false,
          id: Date.now() + index,
          defaultTableId: dt.id
        }));
      setTables(convertedTables);
    }
  }, [isDefaults, defaultTables]);

  // Load tour date overrides when in tour date context
  useEffect(() => {
    if (isTourDateContext && powerOverrides.length > 0) {
      const convertedTables = powerOverrides.map((override, index) => ({
        name: override.table_name,
        rows: override.override_data?.rows || [{
          quantity: '1',
          componentId: '',
          watts: override.total_watts.toString(),
          componentName: override.table_name,
          totalWatts: override.total_watts
        }],
        totalWatts: override.total_watts,
        currentPerPhase: override.current_per_phase,
        pduType: override.pdu_type,
        customPduType: override.custom_pdu_type,
        includesHoist: override.includes_hoist,
        id: Date.now() + index,
        overrideId: override.id
      }));
      setTables(convertedTables);
    }
  }, [isTourDateContext, powerOverrides]);

  const addRow = () => {
    setCurrentTable((prev) => ({
      ...prev,
      rows: [...prev.rows, { quantity: '', componentId: '', watts: '' }],
    }));
  };

  const updateInput = (index: number, field: keyof TableRow, value: string) => {
    const newRows = [...currentTable.rows];
    if (field === 'componentId') {
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

  const calculatePhaseCurrents = (totalWatts: number) => {
    const adjustedWatts = totalWatts * (1 + safetyMargin / 100);
    const wattsPerPhase = adjustedWatts / PHASES;
    const currentPerPhase = wattsPerPhase / (VOLTAGE_3PHASE * POWER_FACTOR);
    return { wattsPerPhase, currentPerPhase };
  };

  const recommendPDU = (current: number) => {
    if (current < 32) return PDU_TYPES[0];
    if (current < 63) return PDU_TYPES[1];
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
          pdu_type: table.customPduType || table.pduType || '',
          includes_hoist: table.includesHoist || false,
          custom_pdu_type: table.customPduType,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Power requirement table saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving power requirement table:', error);
      toast({
        title: 'Error',
        description: 'Failed to save power requirement table',
        variant: 'destructive',
      });
    }
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
        description: `Power calculation set with ${tables.length} tables`,
        department: 'sound'
      });

      // Save each table as a default table
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

  const saveAsOverride = async (table: Table) => {
    if (!tourDateId) return;

    try {
      await createPowerOverride({
        tour_date_id: tourDateId,
        default_table_id: table.defaultTableId,
        table_name: table.name,
        pdu_type: table.customPduType || table.pduType || '',
        custom_pdu_type: table.customPduType,
        total_watts: table.totalWatts || 0,
        current_per_phase: table.currentPerPhase || 0,
        includes_hoist: table.includesHoist || false,
        department: 'sound',
        override_data: {
          rows: table.rows,
          toolType: 'consumos'
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
    const { currentPerPhase } = calculatePhaseCurrents(totalWatts);
    const pduSuggestion = recommendPDU(currentPerPhase);

    const newTable: Table = {
      name: tableName,
      rows: calculatedRows,
      totalWatts,
      currentPerPhase,
      pduType: pduSuggestion,
      id: Date.now(),
      includesHoist: false,
      customPduType: undefined,
    };

    setTables((prev) => [...prev, newTable]);

    // Auto-save logic based on context
    if (isTourDateContext) {
      saveAsOverride(newTable);
    } else if (selectedJobId) {
      savePowerRequirementTable(newTable);
    }

    resetCurrentTable();
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [{ quantity: '', componentId: '', watts: '' }],
    });
    setTableName('');
  };

  const removeTable = (tableId: number) => {
    setTables((prev) => prev.filter((table) => table.id !== tableId));
  };

  const updateTableSettings = (tableId: number, updates: Partial<Table>) => {
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
    if (!selectedJobId || !selectedJob) {
      toast({
        title: 'No job selected',
        description: 'Please select a job before exporting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Fetch the job logo (festival or tour)
      let logoUrl: string | undefined = undefined;
      try {
        const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
        logoUrl = await fetchJobLogo(selectedJobId);
        console.log("Logo URL for PDF:", logoUrl);
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
        // Continue without the logo if there's an error
      }

      // Convert the job date into a proper string (if available)
      let jobDate: string;
      if (selectedJob && (selectedJob as any).date) {
        jobDate = new Date((selectedJob as any).date).toLocaleDateString('en-GB');
      } else {
        jobDate = new Date().toLocaleDateString('en-GB');
      }

      const pdfBlob = await exportToPDF(
        selectedJob.title,
        tables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        selectedJob.title,
        jobDate,
        undefined,
        undefined,
        safetyMargin,
        logoUrl  // Pass the logo URL to the PDF generator
      );

      const fileName = `Power Report - ${selectedJob.title}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const filePath = `sound/${selectedJobId}/${crypto.randomUUID()}.pdf`;

      const { error: uploadError } = await supabase.storage.from('task_documents').upload(filePath, file);

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
      console.error('PDF Export Error:', error);
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
            {isDefaults && tourInfo && (
              <p className="text-sm text-muted-foreground mt-1">
                Managing defaults for: <span className="font-medium">{tourInfo.name}</span>
              </p>
            )}
            {isTourDateContext && tourInfo && (
              <div className="text-sm text-muted-foreground mt-1">
                <p>Creating overrides for tour date</p>
                <p className="font-medium">{tourInfo.date} - {tourInfo.location}</p>
              </div>
            )}
            {isTourContext && !isDefaults && !isTourDateContext && tourInfo && (
              <p className="text-sm text-muted-foreground mt-1">
                Creating power requirements for tour: <span className="font-medium">{tourInfo.name}</span>
              </p>
            )}
          </div>
          <div></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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

          {isDefaults && (
            <div className="space-y-2">
              <Label htmlFor="setName">Default Set Name</Label>
              <Input
                id="setName"
                value={currentSetName}
                onChange={(e) => setCurrentSetName(e.target.value)}
                placeholder="Enter set name (e.g., 'Main Stage Power Setup')"
              />
            </div>
          )}

          {!isDefaults && (
            <>
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
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="tableName">
              {isDefaults ? 'Table Name' : 'Table Name'}
            </Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={isDefaults ? "Enter table name (e.g., FoH Rack)" : "Enter table name"}
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
                      <Input
                        type="number"
                        value={row.watts}
                        readOnly
                        className="w-full bg-muted"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={addRow}>Add Row</Button>
            <Button onClick={generateTable} variant="secondary">
              Add Table
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {isDefaults && tables.length > 0 && (
              <Button onClick={saveAsDefaultSet} className="ml-auto gap-2">
                <Save className="h-4 w-4" />
                Save Default Set
              </Button>
            )}
            {tables.length > 0 && !isDefaults && !isTourContext && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="h-4 w-4" />
                Export & Upload PDF
              </Button>
            )}
          </div>

          {/* Display existing default sets */}
          {isDefaults && defaultSets.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Existing Default Sets</h3>
              {defaultSets.map((set) => {
                const setTables = defaultTables.filter(dt => dt.set_id === set.id && dt.table_type === 'power');
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
                          <div className="text-muted-foreground">{table.total_value.toFixed(2)} W</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Display existing overrides for tour dates */}
          {isTourDateContext && powerOverrides.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Existing Overrides for This Date</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {powerOverrides.map((override) => (
                  <div key={override.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{override.table_name}</h4>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteOverride({ id: override.id, table: 'power' })}
                      >
                        Delete
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {override.total_watts.toFixed(2)} W • {override.current_per_phase.toFixed(2)} A
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tables.map((table) => (
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6">
              <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <h3 className="font-semibold">{table.name}</h3>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => table.id && removeTable(table.id)}
                  >
                    Remove Table
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-muted/50 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`hoist-${table.id}`}
                      checked={table.includesHoist}
                      onCheckedChange={(checked) =>
                        table.id && updateTableSettings(table.id, { includesHoist: !!checked })
                      }
                    />
                    <Label htmlFor={`hoist-${table.id}`}>Include Hoist Power (CEE32A 3P+N+G)</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label>Override PDU Type:</Label>
                    <Select
                      value={table.customPduType || 'default'}
                      onValueChange={(value) =>
                        table.id &&
                        updateTableSettings(table.id, {
                          customPduType: value === 'default' ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Use suggested PDU" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Use suggested PDU</SelectItem>
                        {PDU_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Current per Phase:
                    </td>
                    <td className="px-4 py-3">{table.currentPerPhase?.toFixed(2)} A</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Suggested PDU:
                    </td>
                    <td className="px-4 py-3">{table.pduType}</td>
                  </tr>
                  {table.customPduType && (
                    <tr className="border-t bg-muted/50 font-medium text-primary">
                      <td colSpan={3} className="px-4 py-3 text-right">
                        Selected PDU Override:
                      </td>
                      <td className="px-4 py-3">{table.customPduType}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {table.includesHoist && (
                <div className="px-4 py-2 text-sm text-gray-500 bg-muted/30 italic">
                  Additional Hoist Power Required: CEE32A 3P+N+G
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConsumosTool;
