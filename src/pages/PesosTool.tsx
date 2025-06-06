
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowLeft } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { useTourDefaultSets } from '@/hooks/useTourDefaultSets';
import { supabase } from '@/lib/supabase';

const soundComponentDatabase = [
  { id: 1, name: 'L-ACOUSTICS K1', weight: 110 },
  { id: 2, name: 'L-ACOUSTICS K2', weight: 75 },
  { id: 3, name: 'L-ACOUSTICS K3', weight: 33 },
  { id: 4, name: 'L-ACOUSTICS KARA II', weight: 28 },
  { id: 5, name: 'L-ACOUSTICS KS28', weight: 135 },
  { id: 6, name: 'L-ACOUSTICS SB28', weight: 115 },
  { id: 7, name: 'L-ACOUSTICS X4i', weight: 14 },
  { id: 8, name: 'L-ACOUSTICS X8', weight: 11 },
  { id: 9, name: 'L-ACOUSTICS X12', weight: 21 },
  { id: 10, name: 'L-ACOUSTICS X15 HiQ', weight: 30 },
  { id: 11, name: 'MEYER SOUND UPA-1P', weight: 20 },
  { id: 12, name: 'MEYER SOUND UPM-1P', weight: 30 },
  { id: 13, name: 'MEYER SOUND 750-LFC', weight: 165 },
  { id: 14, name: 'NEXO GEO M6', weight: 25 },
  { id: 15, name: 'NEXO GEO M10', weight: 40 },
  { id: 16, name: 'NEXO GEO S12', weight: 85 },
  { id: 17, name: 'NEXO STM M28', weight: 45 },
  { id: 18, name: 'NEXO STM B112', weight: 75 },
  { id: 19, name: 'D&B Y7P', weight: 18 },
  { id: 20, name: 'D&B Y10P', weight: 28 },
  { id: 21, name: 'D&B Y12', weight: 38 },
  { id: 22, name: 'D&B GSL12', weight: 115 },
  { id: 23, name: 'D&B GSL8', weight: 85 },
  { id: 24, name: 'D&B B22-SUB', weight: 140 },
  { id: 25, name: 'JBL VTX V25', weight: 85 },
  { id: 26, name: 'JBL VTX V20', weight: 65 },
  { id: 27, name: 'JBL VTX S28', weight: 135 },
  { id: 28, name: 'ADAMSON E15', weight: 95 },
  { id: 29, name: 'ADAMSON S10', weight: 55 },
  { id: 30, name: 'ADAMSON T21', weight: 175 },
  { id: 31, name: 'MOTOR CM 250Kg', weight: 30 },
  { id: 32, name: 'MOTOR CM 500Kg', weight: 50 },
  { id: 33, name: 'MOTOR CM 1000Kg', weight: 70 },
  { id: 34, name: 'MOTOR CM 2000Kg', weight: 75 },
  { id: 35, name: 'MOTOR CHAINMASTER 1000KG', weight: 69 },
  { id: 36, name: 'MOTOR CHAINMASTER D8+ 750KG', weight: 69 },
  { id: 37, name: 'TRUSS 76x52 3M', weight: 50 },
  { id: 38, name: 'TRUSS 76x52 2M', weight: 32 },
  { id: 39, name: 'TRUSS 76x52 1M', weight: 24 },
  { id: 40, name: 'TRUSS 52x52 3M', weight: 40 },
  { id: 41, name: 'TRUSS 52x52 2M', weight: 35 },
  { id: 42, name: 'TRUSS 52x52 1M', weight: 27 },
  { id: 43, name: 'VARIOS', weight: 100 }
];

// Global counter for generating SX numbers
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
  id?: number | string;
  dualMotors?: boolean;
  mirroredCluster?: boolean;
  riggingPoints?: string;
  cablePick?: boolean;
  isDefault?: boolean;
  clusterId?: string;
}

const PesosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  
  // Tour defaults mode detection
  const tourId = searchParams.get('tourId');
  const mode = searchParams.get('mode');
  const isTourDefaults = mode === 'tour-defaults';

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
  const [dualMotors, setDualMotors] = useState(false);
  const [mirroredCluster, setMirroredCluster] = useState(false);
  const [cablePick, setCablePick] = useState(false);
  const [tourName, setTourName] = useState<string>('');

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', weight: '' }],
  });

  // Helper to generate a SX suffix for sound department
  const getSuffix = () => {
    if (dualMotors) {
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

  // Helper function to get or create the set ID for sound department
  const getOrCreateSoundSetId = (): string | null => {
    if (!tourId) return null;
    
    // Check if a sound set already exists
    const existingSoundSet = defaultSets.find(set => set.department === 'sound');
    return existingSoundSet?.id || null;
  };

  const createSoundSetId = async (): Promise<string> => {
    if (!tourId) throw new Error('No tour ID');
    
    const newSet = await createSet({
      tour_id: tourId,
      name: `${tourName} Sound Defaults`,
      department: 'sound',
      description: 'Sound department weight defaults'
    });
    
    return newSet.id;
  };

  // Save as tour defaults using the new system
  const saveTourDefault = async (table: Table) => {
    if (!tourId) return;

    try {
      // Get existing set ID or create new one
      let setId = getOrCreateSoundSetId();
      
      if (!setId) {
        setId = await createSoundSetId();
      }

      // Create the table with detailed data and metadata
      await createTourDefaultTable({
        set_id: setId,
        table_name: table.name,
        table_data: {
          rows: table.rows,
          dualMotors: table.dualMotors,
          mirroredCluster: table.mirroredCluster,
          riggingPoints: table.riggingPoints,
          cablePick: table.cablePick
        },
        table_type: 'weight',
        total_value: table.totalWeight || 0,
        metadata: {
          dualMotors: table.dualMotors,
          mirroredCluster: table.mirroredCluster,
          riggingPoints: table.riggingPoints,
          cablePick: table.cablePick
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

    // For grouping, assign a new clusterId for this generation
    const newClusterId = Date.now().toString();

    if (mirroredCluster) {
      // For mirrored clusters, generate two tables sharing the same clusterId
      const leftSuffix = getSuffix();
      const rightSuffix = getSuffix();

      const leftTable: Table = {
        name: `${tableName} L (${leftSuffix})`,
        riggingPoints: leftSuffix,
        rows: calculatedRows,
        totalWeight,
        id: Date.now(),
        dualMotors,
        mirroredCluster: true,
        cablePick,
        clusterId: newClusterId,
      };

      const rightTable: Table = {
        name: `${tableName} R (${rightSuffix})`,
        riggingPoints: rightSuffix,
        rows: calculatedRows,
        totalWeight,
        id: Date.now() + 1,
        dualMotors,
        mirroredCluster: true,
        cablePick,
        clusterId: newClusterId,
      };

      setTables((prev) => [...prev, leftTable, rightTable]);
      
      // Save both tables if in tour defaults mode
      if (isTourDefaults) {
        await saveTourDefault(leftTable);
        await saveTourDefault(rightTable);
      }
    } else {
      // Single table: assign the newClusterId to it and generate suffix
      const suffix = getSuffix();
      const newTable: Table = {
        name: `${tableName} (${suffix})`,
        riggingPoints: suffix,
        rows: calculatedRows,
        totalWeight,
        id: Date.now(),
        dualMotors,
        mirroredCluster: false,
        cablePick,
        clusterId: newClusterId,
      };

      setTables((prev) => [...prev, newTable]);
      
      // Save if in tour defaults mode
      if (isTourDefaults) {
        await saveTourDefault(newTable);
      }
    }

    resetCurrentTable();
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [{ quantity: '', componentId: '', weight: '' }],
    });
    setTableName('');
    setDualMotors(false);
    setMirroredCluster(false);
    setCablePick(false);
  };

  const removeTable = (tableId: number) => {
    setTables((prev) => prev.filter((table) => table.id !== tableId));
  };

  const handleExportPDF = async () => {
    if (!selectedJobId && !isTourDefaults) {
      toast({
        title: 'No job selected',
        description: 'Please select a job before exporting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Generate summary rows for weight reports
      const summaryRows = tables.map((table) => ({
        clusterName: table.name,
        riggingPoints: table.riggingPoints || 'N/A',
        clusterWeight: table.totalWeight || 0
      }));

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

      const jobTitle = isTourDefaults ? `${tourName} Sound Weight Defaults` : selectedJob?.title || 'Weight Report';
      
      const pdfBlob = await exportToPDF(
        jobTitle,
        tables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        jobTitle,
        'sound',
        summaryRows,
        undefined,
        0,
        logoUrl
      );

      const fileName = `Sound Weight Report - ${jobTitle}.pdf`;
      
      if (!isTourDefaults && selectedJobId) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        const filePath = `sound/${selectedJobId}/${crypto.randomUUID()}.pdf`;

        const { error: uploadError } = await supabase.storage.from('task_documents').upload(filePath, file);
        if (uploadError) throw uploadError;

        toast({
          title: 'Success',
          description: 'PDF has been generated and uploaded successfully.',
        });
      } else {
        toast({
          title: 'Success',
          description: 'PDF has been generated successfully.',
        });
      }

      // Provide download to user
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

  return (
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sound')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl font-bold">Sound Weight Calculator</CardTitle>
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
              Creating weight defaults for tour: <span className="font-medium">{tourName}</span>
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

          {!isTourDefaults && (
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
              {isTourDefaults ? 'Default Name' : 'Table Name'}
            </Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={isTourDefaults ? "Enter default name" : "Enter table name"}
            />
          </div>

          {/* Advanced Options */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dualMotors"
                checked={dualMotors}
                onCheckedChange={(checked) => setDualMotors(checked as boolean)}
              />
              <Label htmlFor="dualMotors">Dual motors for safety</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="mirroredCluster"
                checked={mirroredCluster}
                onCheckedChange={(checked) => setMirroredCluster(checked as boolean)}
              />
              <Label htmlFor="mirroredCluster">Mirrored cluster</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="cablePick"
                checked={cablePick}
                onCheckedChange={(checked) => setCablePick(checked as boolean)}
              />
              <Label htmlFor="cablePick">Cable pick</Label>
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
              {isTourDefaults ? 'Save Tour Default' : 'Generate Table'}
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {tables.length > 0 && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
            )}
          </div>

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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeTable(table.id as number)}
                >
                  Remove Table
                </Button>
              </div>
              
              {/* Advanced Options Display */}
              {(table.dualMotors || table.mirroredCluster || table.cablePick || table.riggingPoints) && (
                <div className="p-4 bg-muted/50 space-y-2">
                  <h4 className="font-medium text-sm">Configuration:</h4>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {table.dualMotors && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Dual Motors
                      </span>
                    )}
                    {table.mirroredCluster && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        Mirrored Cluster
                      </span>
                    )}
                    {table.cablePick && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        Cable Pick
                      </span>
                    )}
                    {table.riggingPoints && (
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        Rigging Points: {table.riggingPoints}
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PesosTool;
