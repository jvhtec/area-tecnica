import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ArrowLeft } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTourOverrideMode } from '@/hooks/useTourOverrideMode';
import { TourOverrideModeHeader } from '@/components/tours/TourOverrideModeHeader';
import { Badge } from '@/components/ui/badge';

const soundComponentDatabase = [
  { id: 1, name: ' K1 ', power: 2900 },
  { id: 2, name: ' K2 ', power: 2250 },
  { id: 3, name: ' K3 ', power: 3000 },
  { id: 4, name: ' KARA II ', power: 1000 },
  { id: 5, name: ' KIVA ', power: 1400 },
  { id: 6, name: ' KS28 ', power: 2200 },
  { id: 7, name: ' K1-SB ', power: 3200 },
  { id: 8, name: ' BUMPER K1 ', power: 20 },
  { id: 9, name: ' BUMPER K2 ', power: 20 },
  { id: 10, name: ' BUMPER K3 ', power: 20 },
  { id: 11, name: ' BUMPER KARA ', power: 20 },
  { id: 12, name: ' BUMPER KIVA ', power: 20 },
  { id: 13, name: ' BUMPER KS28 ', power: 20 },
  { id: 14, name: ' KARADOWNK1 ', power: 20 },
  { id: 15, name: ' KARADOWNK2 ', power: 20 },
  { id: 16, name: ' MOTOR 2T ', power: 1100 },
  { id: 17, name: ' MOTOR 1T ', power: 1100 },
  { id: 18, name: ' MOTOR 750Kg ', power: 1100 },
  { id: 19, name: ' MOTOR 500Kg ', power: 1100 },
  { id: 20, name: ' POLIPASTO 1T ', power: 1100 },
  { id: 21, name: ' TFS900H ', power: 300 },
  { id: 22, name: ' TFA600 ', power: 300 },
  { id: 23, name: ' TFS550H ', power: 300 },
  { id: 24, name: ' TFS550L ', power: 300 },
  { id: 25, name: ' BUMPER TFS900 ', power: 0 },
  { id: 26, name: ' TFS900>TFA600 ', power: 0 },
  { id: 27, name: ' TFS900>TFS550 ', power: 0 },
  { id: 28, name: ' BUMPER TFS550 ', power: 0 },
  { id: 29, name: ' CABLEADO L ', power: 0 },
  { id: 30, name: ' CABLEADO H ', power: 0 },
];

interface TableRow {
  quantity: string;
  componentId: string;
  power: string;
  componentName?: string;
  totalPower?: number;
}

interface Table {
  name: string;
  rows: TableRow[];
  totalPower?: number;
  id?: number | string;
  pduType?: string;
  isDefault?: boolean;
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  
  // Tour override mode detection
  const tourId = searchParams.get('tourId');
  const tourDateId = searchParams.get('tourDateId');
  
  const { 
    isOverrideMode, 
    overrideData, 
    isLoading: overrideLoading,
    saveOverride 
  } = useTourOverrideMode(tourId || undefined, tourDateId || undefined, 'sound');

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [defaultTables, setDefaultTables] = useState<Table[]>([]);
  const [pduType, setPduType] = useState('cee32');

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', power: '' }],
  });

  const addRow = () => {
    setCurrentTable((prev) => ({
      ...prev,
      rows: [...prev.rows, { quantity: '', componentId: '', power: '' }],
    }));
  };

  const updateInput = (index: number, field: keyof TableRow, value: string) => {
    const newRows = [...currentTable.rows];
    if (field === 'componentId') {
      const component = soundComponentDatabase.find((c) => c.id.toString() === value);
      newRows[index] = {
        ...newRows[index],
        [field]: value,
        power: component ? component.power.toString() : '',
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

  const savePowerTable = async (table: Table) => {
    if (isOverrideMode && overrideData) {
      // Save as override for tour date
      const overrideSuccess = await saveOverride('power', {
        table_name: table.name,
        total_watts: table.totalPower || 0,
        current_per_phase: (table.totalPower || 0) / 400 * 1.732,
        pdu_type: table.pduType || pduType,
        includes_hoist: false,
        override_data: {
          rows: table.rows
        }
      });

      if (overrideSuccess) {
        toast({
          title: "Success",
          description: "Power override saved for tour date",
        });
      }
      return;
    }

    // For regular job mode, we don't have a power table to save to, so just show success
    if (selectedJobId) {
      toast({
        title: "Success",
        description: "Power table created successfully",
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
      const totalPower =
        parseFloat(row.quantity) && parseFloat(row.power)
          ? parseFloat(row.quantity) * parseFloat(row.power)
          : 0;
      return {
        ...row,
        componentName: component?.name || '',
        totalPower,
      };
    });

    const totalPower = calculatedRows.reduce((sum, row) => sum + (row.totalPower || 0), 0);

    const newTable: Table = {
      name: tableName,
      rows: calculatedRows,
      totalPower,
      pduType,
      id: Date.now(),
    };

    setTables((prev) => [...prev, newTable]);
    
    // Save to override or job context
    savePowerTable(newTable);
    
    resetCurrentTable();
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [{ quantity: '', componentId: '', power: '' }],
    });
    setTableName('');
  };

  const removeTable = (tableId: number | string) => {
    // Only allow removal of regular tables (numeric IDs), not default tables
    if (typeof tableId === 'number') {
      setTables((prev) => prev.filter((table) => table.id !== tableId));
    }
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

      let logoUrl: string | undefined = undefined;
      try {
        if (isOverrideMode && tourId) {
          const { fetchTourLogo } = await import('@/utils/pdf/logoUtils');
          logoUrl = await fetchTourLogo(tourId);
        }
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const pdfBlob = await exportToPDF(
        jobToUse.title,
        allTables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        jobToUse.title,
        new Date().toISOString(),
        undefined,
        undefined,
        0,
        logoUrl
      );

      const fileName = `Sound Power Report - ${jobToUse.title}.pdf`;
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'PDF has been generated successfully.',
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate the PDF.',
        variant: 'destructive',
      });
    }
  };

  // Load defaults when in override mode
  useEffect(() => {
    if (isOverrideMode && overrideData) {
      const powerDefaults = overrideData.defaults
        .filter(table => table.table_type === 'power')
        .map(table => ({
          name: `${table.table_name} (Default)`,
          rows: table.table_data.rows || [],
          totalPower: table.total_value,
          pduType: table.pdu_type,
          id: `default-${table.id}`,
          isDefault: true
        }));
      
      setDefaultTables(powerDefaults);
    }
  }, [isOverrideMode, overrideData]);

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
          <Button variant="ghost" size="icon" onClick={() => navigate('/sound')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">
            {isOverrideMode ? 'Override Mode - ' : ''}Sound Power Calculator
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {isOverrideMode && overrideData && (
            <TourOverrideModeHeader
              tourName={overrideData.tourName}
              tourDate={overrideData.tourDate}
              locationName={overrideData.locationName}
              defaultsCount={defaultTables.length}
              overridesCount={tables.length}
              department="sound"
            />
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
                      <span className="font-medium">Total Power:</span> {table.totalPower?.toFixed(2)} W
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">PDU Type:</span> {table.pduType}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="pduType">PDU Type</Label>
            <Select value={pduType} onValueChange={(value) => setPduType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select PDU type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cee32">CEE 32A</SelectItem>
                <SelectItem value="cee63">CEE 63A</SelectItem>
                <SelectItem value="cee125">CEE 125A</SelectItem>
                <SelectItem value="schuko">Schuko</SelectItem>
                <SelectItem value="wieland">Wieland</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium">Component</th>
                  <th className="px-4 py-3 text-left font-medium">Power (per unit)</th>
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
                      <Input type="number" value={row.power} readOnly className="w-full bg-muted" />
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
              
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Quantity</th>
                    <th className="px-4 py-3 text-left font-medium">Component</th>
                    <th className="px-4 py-3 text-left font-medium">Power (per unit)</th>
                    <th className="px-4 py-3 text-left font-medium">Total Power</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.componentName}</td>
                      <td className="px-4 py-3">{row.power}</td>
                      <td className="px-4 py-3">{row.totalPower?.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Total Power:
                    </td>
                    <td className="px-4 py-3">{table.totalPower?.toFixed(2)} W</td>
                  </tr>
                </tbody>
              </table>
              <div className="px-4 py-2 text-sm text-gray-500 bg-muted/30">
                PDU Type: {table.pduType} | Current per phase: {((table.totalPower || 0) / 400 * 1.732).toFixed(2)} A
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConsumosTool;
