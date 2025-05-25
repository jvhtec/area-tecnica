
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ArrowLeft } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection, JobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

// Database for sound amplifiers components.
const amplifierDatabase = [
  { id: 1, name: 'LA12X', watts: 7000 },
  { id: 2, name: 'LA7.16', watts: 4000 },
  { id: 3, name: 'LA4X', watts: 3500 },
  { id: 4, name: 'LA2Xi', watts: 2100 },
  { id: 5, name: 'K1-SB AMP', watts: 2700 },
  { id: 6, name: 'TFS900H AMP', watts: 3200 },
  { id: 7, name: 'TFA600 AMP', watts: 1900 },
  { id: 8, name: 'TFS550H AMP', watts: 2400 },
  { id: 9, name: 'TFS550L AMP', watts: 2200 },
  { id: 10, name: 'AMPLIFICADOR GENERICO 2KW', watts: 2000 },
  { id: 11, name: 'AMPLIFICADOR GENERICO 1.5KW', watts: 1500 },
  { id: 12, name: 'AMPLIFICADOR GENERICO 1KW', watts: 1000 },
  { id: 13, name: 'AMPLIFICADOR GENERICO 500W', watts: 500 },
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
}

const ConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [selectedPduType, setSelectedPduType] = useState<string>('default');
  const [customPduType, setCustomPduType] = useState('');
  const [includesHoist, setIncludesHoist] = useState(false);

  // Job-based override mode detection
  const [isJobOverrideMode, setIsJobOverrideMode] = useState(false);
  const [jobTourInfo, setJobTourInfo] = useState<{ tourName: string; date: string; location: string } | null>(null);

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', watts: '' }],
  });

  // Detect job-based override mode
  useEffect(() => {
    if (selectedJob?.tour_date_id) {
      setIsJobOverrideMode(true);
      loadJobTourInfo();
    } else {
      setIsJobOverrideMode(false);
      setJobTourInfo(null);
    }
  }, [selectedJob]);

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

  const addRow = () => {
    setCurrentTable((prev) => ({
      ...prev,
      rows: [...prev.rows, { quantity: '', componentId: '', watts: '' }],
    }));
  };

  const updateInput = (index: number, field: keyof TableRow, value: string) => {
    const newRows = [...currentTable.rows];
    if (field === 'componentId' && value) {
      const component = amplifierDatabase.find((c) => c.id.toString() === value);
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
    return { wattsPerPhase, currentPerPhase };
  };

  const recommendPDU = (current: number) => {
    if (current < 32) return PDU_TYPES[0];
    if (current > 63) return PDU_TYPES[2];
    return PDU_TYPES[2];
  };

  const savePowerRequirementTable = async (table: Table) => {
    if (isJobOverrideMode && selectedJob?.tour_date_id) {
      try {
        // Check if override already exists for this table
        const { data: existingOverride } = await supabase
          .from('tour_date_power_overrides')
          .select('id')
          .eq('tour_date_id', selectedJob.tour_date_id)
          .eq('table_name', table.name)
          .eq('department', 'sound')
          .single();

        if (existingOverride) {
          console.log('Override already exists, skipping save');
          return;
        }

        await supabase.from('tour_date_power_overrides').insert({
          tour_date_id: selectedJob.tour_date_id,
          table_name: table.name,
          total_watts: table.totalWatts || 0,
          current_per_phase: table.currentPerPhase || 0,
          pdu_type: table.customPduType || table.pduType || '',
          custom_pdu_type: table.customPduType,
          includes_hoist: table.includesHoist || false,
          department: 'sound',
          override_data: {
            rows: table.rows,
            toolType: 'consumos'
          }
        });

        toast({
          title: 'Success',
          description: 'Override saved for tour date',
        });
      } catch (error: any) {
        console.error('Error saving override:', error);
        toast({
          title: 'Error',
          description: 'Failed to save override',
          variant: 'destructive',
        });
      }
      return;
    }

    // Regular job-based save
    if (!selectedJobId) return;
    
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
      const component = amplifierDatabase.find((c) => c.id.toString() === row.componentId);
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
      let tablesToExport = tables;

      // If in override mode, get defaults and overrides, then replace defaults with overrides
      if (isJobOverrideMode && selectedJob.tour_date_id) {
        try {
          // Get tour defaults
          const { data: tourData } = await supabase
            .from('tour_dates')
            .select('tour_id')
            .eq('id', selectedJob.tour_date_id)
            .single();

          let defaultTables: Table[] = [];
          if (tourData?.tour_id) {
            const { data: defaults } = await supabase
              .from('tour_power_defaults')
              .select('*')
              .eq('tour_id', tourData.tour_id)
              .eq('department', 'sound');

            if (defaults) {
              defaultTables = defaults.map(d => ({
                name: d.table_name,
                rows: [],
                totalWatts: d.total_watts,
                currentPerPhase: d.current_per_phase,
                pduType: d.pdu_type,
                customPduType: d.custom_pdu_type,
                includesHoist: d.includes_hoist,
                id: `default-${d.id}`
              }));
            }
          }

          // Get overrides for this date
          const { data: overrides } = await supabase
            .from('tour_date_power_overrides')
            .select('*')
            .eq('tour_date_id', selectedJob.tour_date_id)
            .eq('department', 'sound');

          const overrideTables: Table[] = (overrides || []).map(o => ({
            name: o.table_name,
            rows: o.override_data?.rows || [],
            totalWatts: o.total_watts,
            currentPerPhase: o.current_per_phase,
            pduType: o.pdu_type,
            customPduType: o.custom_pdu_type,
            includesHoist: o.includes_hoist,
            id: `override-${o.id}`
          }));

          // Create a map of override table names
          const overrideTableNames = new Set(overrideTables.map(t => t.name));

          // Filter out defaults that have been overridden
          const filteredDefaults = defaultTables.filter(d => !overrideTableNames.has(d.name));

          // Combine filtered defaults with overrides and current tables
          tablesToExport = [...filteredDefaults, ...overrideTables, ...tables];

        } catch (error) {
          console.error('Error loading defaults/overrides for PDF:', error);
          // Fall back to just current tables
          tablesToExport = tables;
        }
      }

      let logoUrl: string | undefined = undefined;
      try {
        if (isJobOverrideMode && selectedJob.tour_date_id) {
          // Get tour logo for override mode
          const { data: tourData } = await supabase
            .from('tour_dates')
            .select('tour_id')
            .eq('id', selectedJob.tour_date_id)
            .single();

          if (tourData?.tour_id) {
            const { fetchTourLogo } = await import('@/utils/pdf/logoUtils');
            logoUrl = await fetchTourLogo(tourData.tour_id);
          }
        } else {
          const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
          logoUrl = await fetchJobLogo(selectedJobId);
        }
        console.log("Logo URL for PDF:", logoUrl);
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const jobDateStr = new Date().toLocaleDateString('en-GB');
      const pdfBlob = await exportToPDF(
        selectedJob.title,
        tablesToExport.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        selectedJob.title,
        jobDateStr,
        undefined,
        undefined,
        safetyMargin,
        logoUrl
      );

      const fileName = `Power Report - ${selectedJob.title}.pdf`;
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
              Power Calculator
            </CardTitle>
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
          {/* Job-based override notification */}
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
                          {amplifierDatabase.map((component) => (
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
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{table.name}</h3>
                  {isJobOverrideMode && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">Override</Badge>
                  )}
                </div>
                <Button variant="destructive" size="sm" onClick={() => table.id && removeTable(table.id)}>
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
