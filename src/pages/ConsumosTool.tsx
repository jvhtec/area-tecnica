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

const soundComponentDatabase = [
  { id: 1, name: ' K1 ', watts: 700 },
  { id: 2, name: ' K2 ', watts: 700 },
  { id: 3, name: ' K3 ', watts: 700 },
  { id: 4, name: ' KARA II ', watts: 700 },
  { id: 5, name: ' KIVA ', watts: 700 },
  { id: 6, name: ' KS28 ', watts: 700 },
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
  id?: number;
  includesHoist?: boolean;
  isDefault?: boolean;
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [defaultTables, setDefaultTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [selectedPduType, setSelectedPduType] = useState<string>('default');
  const [customPduType, setCustomPduType] = useState('');
  const [includesHoist, setIncludesHoist] = useState(false);

  // Override mode state
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [tourInfo, setTourInfo] = useState<{
    tourName: string;
    tourDate: string;
    locationName: string;
  } | null>(null);

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

  const calculatePhaseCurrents = (totalWatts: number) => {
    const adjustedWatts = totalWatts * (1 + safetyMargin / 100);
    const wattsPerPhase = adjustedWatts / PHASES;
    const currentPerPhase = wattsPerPhase / (VOLTAGE_3PHASE * POWER_FACTOR);
    return { wattsPerPhase, currentPerPhase };
  };

  const recommendPDU = (current: number) => {
    if (current < 32) return PDU_TYPES[0];
    if (current > 63) return PDU_TYPES[2];
    return PDU_TYPES[2];
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

      // Get default power tables for sound department
      const { data: defaultTablesData, error: tablesError } = await supabase
        .from('tour_default_tables')
        .select(`
          *,
          tour_default_sets!inner(tour_id, department)
        `)
        .eq('tour_default_sets.tour_id', tourDateData.tour_id)
        .eq('tour_default_sets.department', 'sound')
        .eq('table_type', 'power');

      if (tablesError) throw tablesError;

      const convertedDefaults = defaultTablesData.map((table, index) => ({
        name: `${table.table_name} (Default)`,
        rows: table.table_data.rows || [],
        totalWatts: table.total_value,
        currentPerPhase: table.metadata?.currentPerPhase || 0,
        pduType: table.metadata?.pduType || 'CEE32A 3P+N+G',
        id: -(index + 1), // Use negative numbers for defaults
        isDefault: true
      }));

      setDefaultTables(convertedDefaults);
    } catch (error) {
      console.error('Error loading default tables:', error);
    }
  };

  const savePowerRequirementTable = async (table: Table) => {
    if (isOverrideMode && selectedJob?.tour_date_id) {
      // Save as override for tour date
      try {
        const { error } = await supabase
          .from('tour_date_power_overrides')
          .insert({
            tour_date_id: selectedJob.tour_date_id,
            table_name: table.name,
            total_watts: table.totalWatts || 0,
            current_per_phase: table.currentPerPhase || 0,
            pdu_type: table.customPduType || table.pduType || '',
            custom_pdu_type: table.customPduType,
            includes_hoist: table.includesHoist || false,
            department: 'sound',
            override_data: {
              rows: table.rows
            }
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Override saved for tour date",
        });
      } catch (error: any) {
        console.error('Error saving override:', error);
        toast({
          title: "Error",
          description: "Failed to save override",
          variant: "destructive"
        });
      }
      return;
    }

    // Regular job mode - save to power_requirement_tables
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
    const { currentPerPhase } = calculatePhaseCurrents(totalWatts);
    const pduSuggestion = recommendPDU(currentPerPhase);

    const newTable = {
      name: tableName,
      rows: calculatedRows,
      totalWatts,
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

    try {
      // Combine defaults and current tables for export in override mode
      const allTables = isOverrideMode 
        ? [...defaultTables, ...tables]
        : tables;

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

      const pdfBlob = await exportToPDF(
        selectedJob.title,
        allTables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        selectedJob.title,
        'sound',
        undefined,
        undefined,
        undefined,
        logoUrl
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
          <CardTitle className="text-2xl font-bold">
            {isOverrideMode ? 'Override Mode - ' : ''}Power Calculator
          </CardTitle>
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

          {/* Updated tables section to show override badges */}
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
