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
import { TourDefaultsSimpleForm } from '@/components/tours/TourDefaultsSimpleForm';

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
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  
  // Tour context detection
  const tourId = searchParams.get('tourId');
  const mode = searchParams.get('mode'); // 'defaults' or 'override'
  const isDefaults = mode === 'defaults';
  const isTourContext = !!tourId;

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);

  // Tour defaults hook
  const {
    powerDefaults,
    createDefault: createTourDefault,
    updateDefault: updateTourDefault,
    deleteDefault: deleteTourDefault,
    isLoading: tourDefaultsLoading
  } = useTourPowerDefaults(tourId || '');

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
  });

  // Load existing tour defaults when in defaults mode
  useEffect(() => {
    if (isDefaults && powerDefaults.length > 0) {
      const convertedTables = powerDefaults.map((def, index) => ({
        name: def.table_name,
        rows: [{
          quantity: '1',
          componentId: '',
          watts: def.total_watts.toString(),
          componentName: def.table_name,
          totalWatts: def.total_watts
        }],
        totalWatts: def.total_watts,
        currentPerPhase: def.current_per_phase,
        pduType: def.pdu_type,
        customPduType: def.custom_pdu_type,
        includesHoist: def.includes_hoist,
        id: Date.now() + index
      }));
      setTables(convertedTables);
    }
  }, [isDefaults, powerDefaults]);

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

  const saveAsTourDefault = async (table: Table) => {
    if (!tourId) return;

    try {
      await createTourDefault({
        tour_id: tourId,
        table_name: table.name,
        pdu_type: table.customPduType || table.pduType || '',
        custom_pdu_type: table.customPduType,
        total_watts: table.totalWatts || 0,
        current_per_phase: table.currentPerPhase || 0,
        includes_hoist: table.includesHoist || false,
        department: null
      });

      toast({
        title: 'Success',
        description: 'Power default saved to tour successfully',
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

    // Auto-save as tour default if in defaults mode
    if (isDefaults && tourId) {
      saveAsTourDefault(newTable);
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

  const handleBackNavigation = () => {
    if (isTourContext) {
      navigate('/tours');
    } else {
      navigate('/sound');
    }
  };

  // If in defaults mode, show simplified interface
  if (isDefaults) {
    const defaultItems = powerDefaults.map(pd => ({
      id: pd.id,
      name: pd.table_name,
      value: pd.total_watts,
      quantity: 1,
      category: undefined
    }));

    return (
      <TourDefaultsSimpleForm
        tourId={tourId!}
        tourName={tourName}
        type="power"
        defaults={defaultItems}
        onSave={handleSaveDefault}
        onUpdate={handleUpdateDefault}
        onDelete={handleDeleteDefault}
        onBack={handleBackNavigation}
      />
    );
  }

  const handleSaveDefault = async (item: { name: string; value: number; quantity: number; category?: string }) => {
    if (!tourId) return;

    await createTourDefault({
      tour_id: tourId,
      table_name: item.name,
      total_watts: item.value * item.quantity,
      current_per_phase: (item.value * item.quantity) / (VOLTAGE_3PHASE * POWER_FACTOR * PHASES),
      pdu_type: recommendPDU((item.value * item.quantity) / (VOLTAGE_3PHASE * POWER_FACTOR * PHASES)),
      custom_pdu_type: undefined,
      includes_hoist: false,
      department: null
    });
  };

  const handleUpdateDefault = async (id: string, updates: any) => {
    const powerDefault = powerDefaults.find(pd => pd.id === id);
    if (!powerDefault) return;

    const totalWatts = (updates.value ?? powerDefault.total_watts) * (updates.quantity ?? 1);
    const currentPerPhase = totalWatts / (VOLTAGE_3PHASE * POWER_FACTOR * PHASES);

    await updateTourDefault({
      id,
      tour_id: powerDefault.tour_id,
      table_name: updates.name ?? powerDefault.table_name,
      total_watts: totalWatts,
      current_per_phase: currentPerPhase,
      pdu_type: powerDefault.pdu_type,
      custom_pdu_type: powerDefault.custom_pdu_type,
      includes_hoist: powerDefault.includes_hoist,
      department: powerDefault.department
    });
  };

  const handleDeleteDefault = async (id: string) => {
    await deleteTourDefault(id);
  };

  // Get tour name for display
  const [tourName, setTourName] = useState<string>('');

  useEffect(() => {
    const fetchTourName = async () => {
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

    fetchTourName();
  }, [tourId]);

  return (
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">
            Power Calculator
          </CardTitle>
        </div>
        {isTourContext && (
          <p className="text-sm text-muted-foreground text-center">
            Creating power requirements for specific dates
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Enter table name"
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
              {isDefaults ? 'Save as Default' : 'Generate Table'}
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {tables.length > 0 && !isDefaults && (
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
                <div className="flex gap-2">
                  {!isDefaults && isTourContext && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveAsTourDefault(table)}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save as Default
                    </Button>
                  )}
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
