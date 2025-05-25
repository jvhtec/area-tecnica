
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, ArrowLeft } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

const soundComponentDatabase = [
  { id: 1, name: 'Meyer Sound LINA', watts: 480 },
  { id: 2, name: 'Meyer Sound 900-LFC', watts: 1200 },
  { id: 3, name: 'Meyer Sound LEOPARD', watts: 600 },
  { id: 4, name: 'Meyer Sound 1100-LFC', watts: 1600 },
  { id: 5, name: 'Meyer Sound ULTRA-X40', watts: 240 },
  { id: 6, name: 'Meyer Sound ULTRA-X42', watts: 240 },
  { id: 7, name: 'Meyer Sound ULTRA-X20', watts: 240 },
  { id: 8, name: 'Meyer Sound USW-1P', watts: 600 },
  { id: 9, name: 'Meyer Sound UPJ-1P', watts: 480 },
  { id: 10, name: 'Meyer Sound UPA-1P', watts: 480 },
  { id: 11, name: 'd&b audiotechnik V8', watts: 600 },
  { id: 12, name: 'd&b audiotechnik V12', watts: 600 },
  { id: 13, name: 'd&b audiotechnik V-SUB', watts: 800 },
  { id: 14, name: 'd&b audiotechnik J8', watts: 800 },
  { id: 15, name: 'd&b audiotechnik J12', watts: 800 },
  { id: 16, name: 'd&b audiotechnik J-SUB', watts: 1200 },
  { id: 17, name: 'd&b audiotechnik Q1', watts: 500 },
  { id: 18, name: 'd&b audiotechnik Q7', watts: 500 },
  { id: 19, name: 'd&b audiotechnik Q-SUB', watts: 800 },
  { id: 20, name: 'L-Acoustics KARA', watts: 480 },
  { id: 21, name: 'L-Acoustics SB18', watts: 800 },
  { id: 22, name: 'L-Acoustics K2', watts: 600 },
  { id: 23, name: 'L-Acoustics KS28', watts: 1200 },
  { id: 24, name: 'L-Acoustics ARCS II', watts: 400 },
  { id: 25, name: 'L-Acoustics SB28', watts: 1100 },
  { id: 26, name: 'NEXO STM M46', watts: 400 },
  { id: 27, name: 'NEXO STM B112', watts: 1200 },
  { id: 28, name: 'NEXO STM S118', watts: 1200 },
  { id: 29, name: 'DAS AUDIO AERO-50', watts: 600 },
  { id: 30, name: 'DAS AUDIO LX-218A', watts: 1200 },
  { id: 31, name: 'MARTIN AUDIO MLA', watts: 650 },
  { id: 32, name: 'MARTIN AUDIO MLX', watts: 1600 },
  { id: 33, name: 'EAW KF740', watts: 750 },
  { id: 34, name: 'EAW SB2001', watts: 2000 },
  { id: 35, name: 'Adamson S10', watts: 550 },
  { id: 36, name: 'Adamson E119', watts: 1800 },
  { id: 37, name: 'Powersoft X4', watts: 160 },
  { id: 38, name: 'Powersoft X8', watts: 200 },
  { id: 39, name: 'Lab Gruppen PLM 20k44', watts: 200 },
  { id: 40, name: 'Lab Gruppen PLM 12k44', watts: 180 },
  { id: 41, name: 'Crown I-Tech 12000HD', watts: 190 },
  { id: 42, name: 'Crown I-Tech 4x3500HD', watts: 210 },
  { id: 43, name: 'Digico SD12', watts: 200 },
  { id: 44, name: 'Digico SD5', watts: 300 },
  { id: 45, name: 'Yamaha CL5', watts: 150 },
  { id: 46, name: 'Yamaha QL5', watts: 130 },
  { id: 47, name: 'Midas M32', watts: 180 },
  { id: 48, name: 'Behringer X32', watts: 150 },
  { id: 49, name: 'Shure ULXD4Q', watts: 50 },
  { id: 50, name: 'Sennheiser EM 2050', watts: 40 },
  { id: 51, name: 'DBX DriveRack PA2', watts: 30 },
  { id: 52, name: 'Lake LM 44', watts: 40 },
  { id: 53, name: 'Lexicon PCM92', watts: 60 },
  { id: 54, name: 'TC Electronic Reverb 4000', watts: 50 },
  { id: 55, name: 'Drawmer DL441', watts: 20 },
  { id: 56, name: 'BSS DPR-901', watts: 15 },
  { id: 57, name: 'Klark Teknik DN370', watts: 25 },
  { id: 58, name: 'Avalon VT-737SP', watts: 75 },
  { id: 59, name: 'Neve 1073', watts: 80 },
  { id: 60, name: 'API 2500', watts: 40 },
  { id: 61, name: 'Manley Voxbox', watts: 90 },
  { id: 62, name: 'Millennia Media HV-3D', watts: 60 },
  { id: 63, name: 'Grace Design m101', watts: 30 },
  { id: 64, name: 'Focusrite ISA One', watts: 25 },
  { id: 65, name: 'Rupert Neve Designs Portico 5012', watts: 50 },
  { id: 66, name: 'Chandler Limited TG2', watts: 70 },
  { id: 67, name: 'Universal Audio LA-2A', watts: 45 },
  { id: 68, name: 'Teletronix LA-2A', watts: 50 },
  { id: 69, name: 'Empirical Labs Distressor', watts: 35 },
  { id: 70, name: 'SSL G-Master Buss Compressor', watts: 60 },
  { id: 71, name: 'Tube-Tech CL 1B', watts: 85 },
  { id: 72, name: 'Summit Audio TLA-100A', watts: 40 },
  { id: 73, name: 'ADR Compex F760X-RS', watts: 55 },
  { id: 74, name: 'Fairchild 670', watts: 120 },
  { id: 75, name: 'UREI 1176', watts: 30 },
  { id: 76, name: 'dbx 160', watts: 20 }
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
}

interface SummaryRow {
  quantity: string;
  componentName: string;
  watts: string;
  totalWatts: number;
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [selectedPduType, setSelectedPduType] = useState<string>('default');
  const [customPduType, setCustomPduType] = useState('');
  const [includesHoist, setIncludesHoist] = useState(false);

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
  });

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

  const PDU_TYPES = ['CEE32A 3P+N+G', 'CEE63A 3P+N+G', 'CEE400A 3P+N+G'];

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
          pdu_type: selectedPduType === 'default' ? table.pduType : selectedPduType,
          custom_pdu_type: customPduType,
          includes_hoist: includesHoist
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
      pduType: selectedPduType === 'default' ? pduSuggestion : selectedPduType,
      customPduType: customPduType,
      includesHoist,
      id: Date.now(),
    };

    setTables((prev) => [...prev, newTable]);

    // Save to database if job is selected
    if (selectedJobId) {
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
    setSelectedPduType('default');
    setCustomPduType('');
    setIncludesHoist(false);
  };

  const removeTable = (tableId: number | string) => {
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

    try {
      let logoUrl: string | undefined = undefined;
      try {
        const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
        logoUrl = await fetchJobLogo(selectedJobId);
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const pdfBlob = await exportToPDF(
        selectedJob.title,
        tables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        selectedJob.title,
        'sound',
        undefined,
        undefined,
        safetyMargin,
        logoUrl
      );

      const fileName = `Sound Power Report - ${selectedJob.title}.pdf`;
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

  return (
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sound')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">Power Calculator</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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
            <Label>PDU Type Override</Label>
            <Select value={selectedPduType} onValueChange={setSelectedPduType}>
              <SelectTrigger>
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
            {selectedPduType === 'custom' && (
              <Input
                placeholder="Enter custom PDU type"
                value={customPduType}
                onChange={(e) => setCustomPduType(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="hoistPower"
              checked={includesHoist}
              onCheckedChange={(checked) => setIncludesHoist(checked as boolean)}
            />
            <Label htmlFor="hoistPower">Requires additional hoist power (CEE32A 3P+N+G)</Label>
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
            <Button onClick={generateTable} variant="secondary">
              Generate Table
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reset
            </Button>
            {tables.length > 0 && (
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
