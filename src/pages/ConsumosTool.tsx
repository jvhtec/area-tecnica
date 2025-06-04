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
import { supabase } from '@/lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { useTourOverrideMode } from '@/hooks/useTourOverrideMode';
import { TourOverrideModeHeader } from '@/components/tours/TourOverrideModeHeader';
import { Badge } from '@/components/ui/badge';

const componentDatabase = [
  { id: 1, name: 'MacBook Pro 16"', watts: 100 },
  { id: 2, name: 'iMac 27"', watts: 250 },
  { id: 3, name: 'Pro Tools Workstation', watts: 400 },
  { id: 4, name: 'SSL Duality Console', watts: 1200 },
  { id: 5, name: 'Outboard Gear Rack', watts: 300 },
  { id: 6, name: 'Genelec 8351B Monitors (pair)', watts: 150 },
  { id: 7, name: 'Subwoofer', watts: 200 },
  { id: 8, name: 'Microphone Preamp', watts: 50 },
  { id: 9, name: 'Headphone Amplifier', watts: 30 },
  { id: 10, name: 'Audio Interface', watts: 60 },
  { id: 11, name: 'Network Switch', watts: 20 },
  { id: 12, name: 'Lighting Console', watts: 150 },
  { id: 13, name: 'Moving Head Fixture', watts: 300 },
  { id: 14, name: 'LED Par', watts: 100 },
  { id: 15, name: 'Strobe Light', watts: 500 },
  { id: 16, name: 'Dimmer Rack', watts: 200 },
  { id: 17, name: 'Video Projector', watts: 350 },
  { id: 18, name: 'LED Screen Panel', watts: 120 },
  { id: 19, name: 'Video Switcher', watts: 80 },
  { id: 20, name: 'Media Server', watts: 200 },
  { id: 21, name: 'Camera', watts: 50 },
  { id: 22, name: 'Monitor', watts: 75 },
  { id: 23, name: 'Laptop', watts: 60 },
  { id: 24, name: 'Mixer', watts: 200 },
  { id: 25, name: 'Amplifier', watts: 500 },
  { id: 26, name: 'Speaker', watts: 300 },
  { id: 27, name: 'Effects Processor', watts: 100 },
  { id: 28, name: 'Keyboard', watts: 50 },
  { id: 29, name: 'Synthesizer', watts: 80 },
  { id: 30, name: 'Drum Machine', watts: 40 },
  { id: 31, name: 'Sampler', watts: 60 },
  { id: 32, name: 'DJ Mixer', watts: 100 },
  { id: 33, name: 'Turntable', watts: 30 },
  { id: 34, name: 'CD Player', watts: 20 },
  { id: 35, name: 'Lighting Desk', watts: 200 },
  { id: 36, name: 'Smoke Machine', watts: 800 },
  { id: 37, name: 'Hazer', watts: 400 },
  { id: 38, name: 'Fan', watts: 100 },
  { id: 39, name: 'Power Amplifier', watts: 700 },
  { id: 40, name: 'Signal Processor', watts: 50 },
  { id: 41, name: 'Crossover', watts: 30 },
  { id: 42, name: 'Equalizer', watts: 40 },
  { id: 43, name: 'Compressor', watts: 60 },
  { id: 44, name: 'Limiter', watts: 50 },
  { id: 45, name: 'Noise Gate', watts: 30 },
  { id: 46, name: 'Reverb Unit', watts: 80 },
  { id: 47, name: 'Delay Unit', watts: 70 },
  { id: 48, name: 'Chorus Unit', watts: 60 },
  { id: 49, name: 'Flanger Unit', watts: 50 },
  { id: 50, name: 'Phaser Unit', watts: 40 },
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
  adjustedWatts?: number;
  currentPerPhase?: number;
  pduType?: string;
  customPduType?: string;
  id?: number | string;
  includesHoist?: boolean;
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
      const component = componentDatabase.find((c) => c.id.toString() === value);
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

  const calculatePhaseCurrents = (totalWatts: number) => {
    const adjustedWatts = totalWatts * (1 + safetyMargin / 100);
    const wattsPerPhase = adjustedWatts / PHASES;
    const currentPerPhase = wattsPerPhase / (VOLTAGE_3PHASE * POWER_FACTOR);
    return { wattsPerPhase, currentPerPhase, adjustedWatts };
  };

  const recommendPDU = (current: number) => {
    if (current < 32) return PDU_TYPES[0];
    if (current > 63) return PDU_TYPES[2];
    return PDU_TYPES[2];
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

    // Check if we're in tour defaults mode
    const tourId = searchParams.get('tourId');
    const mode = searchParams.get('mode');
    const department = searchParams.get('department') || 'sound';

    if (tourId && mode === 'defaults') {
      // Save as tour default with new structure
      try {
        const { error } = await supabase
          .from('tour_default_tables')
          .insert({
            set_id: 'default-set', // We'll need to create a proper set management system
            table_name: table.name,
            table_data: {
              rows: table.rows,
              safetyMargin: safetyMargin
            },
            table_type: 'power',
            total_value: table.totalWatts || 0,
            metadata: {
              safetyMargin: safetyMargin,
              current_per_phase: table.currentPerPhase,
              pdu_type: table.customPduType || table.pduType,
              custom_pdu_type: table.customPduType,
              includes_hoist: table.includesHoist,
              department: department
            }
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Power default saved successfully",
        });
      } catch (error: any) {
        console.error('Error saving power default:', error);
        toast({
          title: "Error",
          description: "Failed to save power default",
          variant: "destructive"
        });
      }
      return;
    }

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
      const component = componentDatabase.find((c) => c.id.toString() === row.componentId);
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
        'sound',
        undefined,
        undefined,
        safetyMargin,
        logoUrl
      );

      const fileName = `Power Report - ${jobToUse.title}.pdf`;
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

  const [defaultTables, setDefaultTables] = useState<Table[]>([]);

  // Load defaults when in override mode
  useEffect(() => {
    if (isOverrideMode && overrideData) {
      const powerDefaults = overrideData.defaults
        .filter(table => table.table_type === 'power')
        .map(table => ({
          name: `${table.table_name} (Default)`,
          rows: table.table_data.rows || [],
          totalWatts: table.total_value,
          currentPerPhase: table.metadata?.currentPerPhase,
          pduType: table.metadata?.pduType,
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
            {isOverrideMode ? 'Override Mode - ' : ''}Power Calculator
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
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Watts:</span> {table.totalWatts?.toFixed(2)} W
                      </div>
                      <div>
                        <span className="font-medium">Current per Phase:</span> {table.currentPerPhase?.toFixed(2)} A
                      </div>
                      <div>
                        <span className="font-medium">PDU Type:</span> {table.pduType}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                          {componentDatabase.map((component) => (
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

          {/* Updated tables section to show safety margin adjusted watts */}
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
