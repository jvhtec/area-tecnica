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
import { useNavigate } from 'react-router-dom';
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
  
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [defaultTables, setDefaultTables] = useState<Table[]>([]);
  const [useDualMotors, setUseDualMotors] = useState(false);
  const [mirroredCluster, setMirroredCluster] = useState(false);
  const [cablePick, setCablePick] = useState(false);
  const [cablePickWeight, setCablePickWeight] = useState('100');

  // Override mode state
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [tourInfo, setTourInfo] = useState<{
    tourName: string;
    tourDate: string;
    locationName: string;
  } | null>(null);

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', weight: '' }],
  });

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
    
    // Check if this job has a tour_date_id to activate override mode
    if (job?.tour_date_id) {
      setIsOverrideMode(true);
      loadTourInfo(job.tour_date_id);
      loadDefaultTables(job.tour_date_id);
    } else {
      setIsOverrideMode(false);
      setTourInfo(null);
      setDefaultTables([]);
    }
  };

  const loadTourInfo = async (tourDateId: string) => {
    try {
      const { data: tourDateData, error } = await supabase
        .from('tour_dates')
        .select(`
          date,
          tour:tours (name),
          location:locations (name)
        `)
        .eq('id', tourDateId)
        .single();

      if (error) throw error;

      setTourInfo({
        tourName: (tourDateData.tour as any)?.name || 'Unknown Tour',
        tourDate: tourDateData.date,
        locationName: (tourDateData.location as any)?.name || 'Unknown Location'
      });
    } catch (error) {
      console.error('Error loading tour info:', error);
    }
  };

  const loadDefaultTables = async (tourDateId: string) => {
    try {
      // Get tour_id from tour_date
      const { data: tourDateData, error: tourDateError } = await supabase
        .from('tour_dates')
        .select('tour_id')
        .eq('id', tourDateId)
        .single();

      if (tourDateError) throw tourDateError;

      // Get default weight tables for sound department
      const { data: defaultTablesData, error: tablesError } = await supabase
        .from('tour_default_tables')
        .select(`
          *,
          tour_default_sets!inner(tour_id, department)
        `)
        .eq('tour_default_sets.tour_id', tourDateData.tour_id)
        .eq('tour_default_sets.department', 'sound')
        .eq('table_type', 'weight');

      if (tablesError) throw tablesError;

      const convertedDefaults = defaultTablesData.map((table, index) => ({
        name: `${table.table_name} (Default)`,
        rows: table.table_data.rows || [],
        totalWeight: table.total_value,
        id: -(index + 1), // Use negative numbers for defaults
        isDefault: true,
        clusterId: table.metadata?.clusterId,
        dualMotors: table.metadata?.dualMotors,
        riggingPoints: table.metadata?.riggingPoints
      }));

      setDefaultTables(convertedDefaults);
    } catch (error) {
      console.error('Error loading default tables:', error);
    }
  };

  const saveAsOverride = async (table: Table) => {
    if (!isOverrideMode || !selectedJob?.tour_date_id) return;

    try {
      const { error } = await supabase
        .from('tour_date_weight_overrides')
        .insert({
          tour_date_id: selectedJob.tour_date_id,
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

      if (error) throw error;

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

    // For grouping cable pick later, assign a new clusterId for this generation.
    const newClusterId = Date.now().toString();

    if (isOverrideMode) {
      // In override mode, create table and save as override
      const newTable: Table = {
        name: tableName,
        rows: calculatedRows,
        totalWeight,
        id: Date.now(),
        clusterId: newClusterId,
      };
      setTables((prev) => [...prev, newTable]);
      saveAsOverride(newTable);
    } else if (mirroredCluster) {
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

      setTables((prev) => [...prev, leftTable, rightTable]);
    } else {
      // Single table: assign the newClusterId to it.
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
      setTables((prev) => [...prev, newTable]);
    }
    
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

    // Combine defaults and current tables for export in override mode
    const allTables = isOverrideMode 
      ? [...defaultTables, ...tables]
      : tables;

    const summaryRows: SummaryRow[] = allTables.map((table) => {
      const cleanName = table.name.split('(')[0].trim();
      return {
        clusterName: cleanName,
        riggingPoints: table.riggingPoints || '',
        clusterWeight: table.totalWeight || 0,
      };
    });

    // Group tables by clusterId to handle cable picks
    const clusters = allTables.reduce((acc, table) => {
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
        if (isOverrideMode && selectedJob.tour_date_id) {
          // Get tour_id from tour_date_id
          const { data: tourDateData } = await supabase
            .from('tour_dates')
            .select('tour_id')
            .eq('id', selectedJob.tour_date_id)
            .single();
          
          if (tourDateData?.tour_id) {
            const { fetchTourLogo } = await import('@/utils/pdf/logoUtils');
            logoUrl = await fetchTourLogo(tourDateData.tour_id);
          }
        } else {
          const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
          logoUrl = await fetchJobLogo(selectedJobId);
        }
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const jobDateStr = new Date().toLocaleDateString('en-GB');
      const pdfBlob = await exportToPDF(
        selectedJob.title,
        allTables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        selectedJob.title,
        jobDateStr,
        summaryRows,
        undefined,
        undefined,
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/sound')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isOverrideMode ? 'Override Mode - ' : ''}Weight Calculator
            </CardTitle>
          </div>
          <div></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Override mode header */}
          {isOverrideMode && tourInfo && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-blue-900">
                  Override Mode - Sound Department
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-900">Tour:</span>
                  <span className="text-blue-700">{tourInfo.tourName}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-900">Date:</span>
                  <span className="text-blue-700">{new Date(tourInfo.tourDate).toLocaleDateString('en-GB')}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-900">Location:</span>
                  <span className="text-blue-700">{tourInfo.locationName}</span>
                </div>
              </div>
              
              <div className="flex gap-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {defaultTables.length} Default{defaultTables.length !== 1 ? 's' : ''}
                </Badge>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {tables.length} Override{tables.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <p className="text-sm text-blue-600 mt-3">
                Any tables created here will be saved as overrides for this specific tour date.
                These will be combined with defaults when exporting PDFs.
              </p>
            </div>
          )}

          {/* Show defaults section when in override mode */}
          {isOverrideMode && defaultTables.length > 0 && (
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="font-semibold mb-3 text-green-800">Tour Defaults (Read-Only)</h3>
              {defaultTables.map((table) => (
                <div key={table.id} className="border rounded-lg overflow-hidden mt-4 bg-white">
                  <div className="bg-green-100 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{table.name}</h4>
                      <Badge variant="outline" className="bg-green-50 text-green-700">Default</Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-sm">
                      <span className="font-medium">Total Weight:</span> {table.totalWeight?.toFixed(2)} kg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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

          <div className="space-y-2">
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Enter table name"
            />
            
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
              Generate Table
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {tables.length > 0 && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="w-4 h-4" />
                Export &amp; Upload PDF
              </Button>
            )}
          </div>

          {/* Table display with override badges */}
          {tables.map((table) => (
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6">
              <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{table.name}</h3>
                  {isOverrideMode && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">Override</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isOverrideMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* Save as default logic if needed */}}
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
                    <th className="px-4 py-3 text-left font-medium">Weight (per unit)</th>
                    <th className="px-4 py-3 text-left font-medium">Total Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.componentName}</td>
                      <td className="px-4 py-3">{row.weight}</td>
                      <td className="px-4 py-3">{row.totalWeight?.toFixed(2)}</td>
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
              {!isOverrideMode && table.dualMotors && (
                <div className="px-4 py-2 text-sm text-gray-500 bg-muted/30 italic">
                  *This configuration uses dual motors. Load is distributed between two motors for safety and redundancy.
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
