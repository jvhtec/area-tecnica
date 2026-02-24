
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { FileText, ArrowLeft, Check, ChevronsUpDown, Trash2 } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection, JobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { useTourOverrideMode } from '@/hooks/useTourOverrideMode';
import { TourOverrideModeHeader } from '@/components/tours/TourOverrideModeHeader';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type FixtureType = 'incandescent' | 'discharge' | 'led' | 'led-pro';

const FIXTURE_PF: Record<FixtureType, { label: string; pf: number }> = {
  incandescent: { label: 'Incandescent / filament', pf: 1.0 },
  discharge: { label: 'Discharge (generic)', pf: 0.9 },
  led: { label: 'LED (generic)', pf: 0.9 },
  'led-pro': { label: 'LED (pro / specified)', pf: 0.95 },
};

const DEFAULT_FIXTURE_TYPE: FixtureType = 'led';

type LightComponent = {
  id: number;
  name: string;
  watts: number;
  fixtureType: FixtureType;
};

const lightComponentDatabase: LightComponent[] = [
  { id: 1, name: 'CAMEO OPUS S5', watts: 650, fixtureType: 'led' },
  { id: 2, name: 'CLAY PAKY A-LEDA K20', watts: 650, fixtureType: 'led' },
  { id: 3, name: 'CLAY PAKY A-LEDA K25', watts: 1100, fixtureType: 'led' },
  { id: 4, name: 'CLAY PAKY STORMY CC', watts: 800, fixtureType: 'discharge' },
  { id: 5, name: 'ELATION CHORUS LINE 16', watts: 750, fixtureType: 'led' },
  { id: 6, name: 'MARTIN MAC AURA', watts: 260, fixtureType: 'led' },
  { id: 7, name: 'MARTIN MAC VIPER', watts: 1200, fixtureType: 'discharge' },
  { id: 8, name: 'ROBE BMFL BLADE', watts: 2000, fixtureType: 'discharge' },
  { id: 9, name: 'ROBE BMFL SPOT', watts: 2000, fixtureType: 'discharge' },
  { id: 10, name: 'ROBE BMFL WASHBEAM', watts: 2000, fixtureType: 'discharge' },
  { id: 11, name: 'ROBE MEGAPOINTE', watts: 670, fixtureType: 'discharge' },
  { id: 12, name: 'ROBE POINTE', watts: 470, fixtureType: 'discharge' },
  { id: 13, name: 'TRITON BLUE 15R BEAM', watts: 500, fixtureType: 'discharge' },
  { id: 14, name: 'TRITON BLUE 15R SPOT', watts: 500, fixtureType: 'discharge' },
  { id: 15, name: 'TRITON BLUE WALLY 3715', watts: 650, fixtureType: 'discharge' },
  { id: 16, name: 'CAMEO AURO BAR 100', watts: 140, fixtureType: 'led' },
  { id: 17, name: 'ACL 250W (2 BARRAS)', watts: 2000, fixtureType: 'incandescent' },
  { id: 18, name: 'ACL 650W (2 BARRAS)', watts: 5200, fixtureType: 'incandescent' },
  { id: 19, name: 'BARRA PAR 64x6', watts: 6000, fixtureType: 'incandescent' },
  { id: 20, name: 'FRESNELL 2KW', watts: 2000, fixtureType: 'incandescent' },
  { id: 21, name: 'MOLEFAY BLINDER 4', watts: 2600, fixtureType: 'incandescent' },
  { id: 22, name: 'MOLEFAY BLINDER 8', watts: 5200, fixtureType: 'incandescent' },
  { id: 23, name: 'PAR 64', watts: 1000, fixtureType: 'incandescent' },
  { id: 24, name: 'ADMIRAL VINTAGE 53cm', watts: 60, fixtureType: 'incandescent' },
  { id: 25, name: 'ADMIRAL VINTAGE 38cm', watts: 60, fixtureType: 'incandescent' },
  { id: 26, name: 'FRESNELL 5KW', watts: 5000, fixtureType: 'incandescent' },
  { id: 27, name: 'MOLEFAY BLINDER 2', watts: 1300, fixtureType: 'incandescent' },
  { id: 28, name: 'RECORTE ETC 25º/50º', watts: 750, fixtureType: 'incandescent' },
  { id: 29, name: 'RECORTE ETC 15º/30º', watts: 750, fixtureType: 'incandescent' },
  { id: 30, name: 'RECORTE ETC 19º', watts: 750, fixtureType: 'incandescent' },
  { id: 31, name: 'RECORTE ETC 10º', watts: 750, fixtureType: 'incandescent' },
  { id: 32, name: 'RECORTE TB LED 25º/50º', watts: 300, fixtureType: 'led' },
  { id: 33, name: 'SUNSTRIP', watts: 500, fixtureType: 'incandescent' },
  { id: 34, name: 'CAMEO ZENIT 120', watts: 120, fixtureType: 'led' },
  { id: 35, name: 'ELATION SIXBAR 1000', watts: 150, fixtureType: 'led' },
  { id: 36, name: 'MARTIN ATOMIC 3000', watts: 3000, fixtureType: 'discharge' },
  { id: 37, name: 'SGM Q7', watts: 500, fixtureType: 'led' },
  { id: 38, name: 'ELATION SIXBAR 500', watts: 80, fixtureType: 'led' },
  { id: 39, name: 'SMOKE FACTORY TOUR HAZERII', watts: 1500, fixtureType: 'discharge' },
  { id: 40, name: 'ROBE 500 FT-PRO', watts: 1200, fixtureType: 'discharge' },
  { id: 41, name: 'SAHARA TURBO DRYER', watts: 1500, fixtureType: 'discharge' },
  { id: 42, name: 'ROBE SPIIDER', watts: 660, fixtureType: 'led' },
  { id: 43, name: 'GLP JDC1', watts: 1200, fixtureType: 'led' },
  { id: 44, name: 'CAMEO W3', watts: 325, fixtureType: 'led' },
  { id: 45, name: 'CHAUVET COLOR STRIKE M', watts: 750, fixtureType: 'led' },
  { id: 46, name: 'GLP X4 BAR 20', watts: 500, fixtureType: 'led' },
  { id: 47, name: 'ROBERT JULIAT ARAMIS', watts: 2500, fixtureType: 'discharge' },
  { id: 48, name: 'ROBERT JULIAT MERLIN', watts: 2500, fixtureType: 'discharge' },
  { id: 49, name: 'ROBERT JULIAT CYRANO', watts: 2500, fixtureType: 'discharge' },
  { id: 50, name: 'ROBERT JULIAT LANCELOT', watts: 4000, fixtureType: 'discharge' },
  { id: 51, name: 'ROBERT JULIAT KORRIGAN', watts: 1200, fixtureType: 'discharge' },
  { id: 52, name: 'PIXEL LINE IP', watts: 420, fixtureType: 'led' },
  { id: 53, name: 'COLORADO PXL BAR ', watts: 768, fixtureType: 'led' },
  { id: 54, name: 'AROLLA AQUA S-LT', watts: 600, fixtureType: 'led' },
  { id: 55, name: 'AROLLA AQUA HP', watts: 1900, fixtureType: 'led' },
  { id: 56, name: 'HY B-EYE K15 AQUA', watts: 680, fixtureType: 'led' },
  { id: 57, name: 'CLUSTER B2 FC', watts: 600, fixtureType: 'led' },
  { id: 58, name: 'ACME TORNADO', watts: 935, fixtureType: 'led' },
  { id: 59, name: 'CLAY PAKY A-LEDA K15', watts: 760, fixtureType: 'led' },
  { id: 60, name: 'AROLLA AQUA LT', watts: 1400, fixtureType: 'led' },
  { id: 61, name: 'CUARZO', watts: 400, fixtureType: 'incandescent' }

];

const SQRT3 = Math.sqrt(3);

const PDU_TYPES_THREE = [
  'CEE32A 3P+N+G',
  'CEE63A 3P+N+G',
  'CEE125A 3P+N+G',
  'Powerlock 400A 3P+N+G',
];

const PDU_TYPES_SINGLE = ['Schuko 16A', 'CEE32A 1P+N+G', 'CEE63A 1P+N+G'];

interface TableRow {
  quantity: string;
  componentId: string;
  watts: string;
  fixtureType?: FixtureType;
  pf?: string;
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
  includesHoist?: boolean;
  id?: number | string;
  isDefault?: boolean;
}

const LightsConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();

  // Tour override mode detection
  const tourId = searchParams.get('tourId');
  const tourDateId = searchParams.get('tourDateId');
  const mode = searchParams.get('mode');

  const {
    isOverrideMode,
    overrideData,
    isLoading: overrideLoading,
    saveOverride
  } = useTourOverrideMode(tourId || undefined, tourDateId || undefined, 'lights');

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [includesHoist, setIncludesHoist] = useState(false);
  const [selectedPduType, setSelectedPduType] = useState<string>('default');
  const [customPduType, setCustomPduType] = useState<string>('');
  const [phaseMode, setPhaseMode] = useState<'single' | 'three'>('three');
  const [voltage, setVoltage] = useState<number>(400);
  const [componentSearches, setComponentSearches] = useState<Record<number, string>>({});
  const [componentDropdowns, setComponentDropdowns] = useState<Record<number, boolean>>({});

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{
      quantity: '',
      componentId: '',
      watts: '',
      fixtureType: DEFAULT_FIXTURE_TYPE,
      pf: FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf.toFixed(2),
    }],
  });

  const [defaultTables, setDefaultTables] = useState<Table[]>([]);
  const pduOptions = phaseMode === 'single' ? PDU_TYPES_SINGLE : PDU_TYPES_THREE;

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

  useEffect(() => {
    setVoltage(phaseMode === 'single' ? 230 : 400);
  }, [phaseMode]);

  useEffect(() => {
    if (
      selectedPduType &&
      selectedPduType !== 'default' &&
      selectedPduType !== 'Custom' &&
      !pduOptions.includes(selectedPduType)
    ) {
      setSelectedPduType('default');
    }
  }, [pduOptions, selectedPduType]);

  const addRow = () => {
    setCurrentTable((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          quantity: '',
          componentId: '',
          watts: '',
          fixtureType: DEFAULT_FIXTURE_TYPE,
          pf: FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf.toFixed(2),
        },
      ],
    }));
  };

  const removeRow = (index: number) => {
    setCurrentTable((prev) => {
      const filteredRows = prev.rows.filter((_, i) => i !== index);
      return {
        ...prev,
        rows: filteredRows.length > 0
          ? filteredRows
          : [{
            quantity: '',
            componentId: '',
            watts: '',
            fixtureType: DEFAULT_FIXTURE_TYPE,
            pf: FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf.toFixed(2),
          }],
      };
    });
  };

  const updateInput = (index: number, field: keyof TableRow, value: string) => {
    const newRows = [...currentTable.rows];
    if (field === 'componentId') {
      const component = lightComponentDatabase.find((c) => c.id.toString() === value);
      const fixtureType = component?.fixtureType || DEFAULT_FIXTURE_TYPE;
      const recommendedPf = FIXTURE_PF[fixtureType]?.pf ?? FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf;
      newRows[index] = {
        ...newRows[index],
        [field]: value,
        watts: component ? component.watts.toString() : '',
        fixtureType,
        pf: recommendedPf.toFixed(2),
      };
    } else if (field === 'fixtureType') {
      const fixtureType = value as FixtureType;
      const recommendedPf = FIXTURE_PF[fixtureType]?.pf ?? FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf;
      newRows[index] = {
        ...newRows[index],
        fixtureType,
        pf: recommendedPf.toFixed(2),
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

  const updateComponentSearch = (index: number, value: string) => {
    setComponentSearches((prev) => ({ ...prev, [index]: value }));
  };

  const updateComponentDropdown = (index: number, open: boolean) => {
    setComponentDropdowns((prev) => ({ ...prev, [index]: open }));
    if (!open) {
      setComponentSearches((prev) => ({ ...prev, [index]: '' }));
    }
  };

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    const job = jobs?.find((j) => j.id === jobId) || null;
    setSelectedJob(job);
  };

  const getRecommendedPf = (fixtureType?: FixtureType) =>
    FIXTURE_PF[fixtureType || DEFAULT_FIXTURE_TYPE]?.pf ?? FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf;

  const parseRowPf = (row: TableRow, component?: LightComponent) => {
    const rawPf = Number(row.pf);
    if (Number.isFinite(rawPf) && rawPf > 0) return Math.min(Math.max(rawPf, 0.1), 1);
    return getRecommendedPf(row.fixtureType || component?.fixtureType);
  };

  const calculateLineCurrent = (totalWatts: number, totalVa: number) => {
    const adjustedWatts = totalWatts * (1 + safetyMargin / 100);
    const adjustedVa = totalVa * (1 + safetyMargin / 100);
    const currentLine =
      phaseMode === 'single'
        ? adjustedVa / voltage
        : adjustedVa / (SQRT3 * voltage);
    return { adjustedWatts, currentLine, adjustedVa };
  };

  const planningLimit = (amps: number) => amps * 0.8;

  const recommendPDU = (currentLine: number) => {
    if (phaseMode === 'single') {
      if (currentLine <= planningLimit(16)) return PDU_TYPES_SINGLE[0];
      if (currentLine <= planningLimit(32)) return PDU_TYPES_SINGLE[1];
      return PDU_TYPES_SINGLE[2];
    }
    if (currentLine <= planningLimit(32)) return PDU_TYPES_THREE[0];
    if (currentLine <= planningLimit(63)) return PDU_TYPES_THREE[1];
    if (currentLine <= planningLimit(125)) return PDU_TYPES_THREE[2];
    return PDU_TYPES_THREE[3];
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
          rows: table.rows
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

    // Original job-based save logic
    if (!selectedJobId) return;

    try {
      const { error } = await supabase
        .from('power_requirement_tables')
        .insert({
          job_id: selectedJobId,
          department: 'lights',
          table_name: table.name,
          total_watts: table.totalWatts || 0,
          current_per_phase: table.currentPerPhase || 0,
          pdu_type: table.customPduType || table.pduType || '',
          includes_hoist: table.includesHoist || false,
          custom_pdu_type: table.customPduType,
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "La tabla de requerimientos de potencia se ha guardado exitosamente",
      });
    } catch (error: any) {
      console.error('Error saving power requirement table:', error);
      toast({
        title: "Error",
        description: "Error al guardar la tabla de requerimientos de potencia",
        variant: "destructive",
      });
    }
  };

  const generateTable = () => {
    if (!tableName) {
      toast({
        title: 'Falta el nombre de la tabla',
        description: 'Por favor ingrese un nombre para la tabla',
        variant: 'destructive',
      });
      return;
    }

    const calculatedRows = currentTable.rows.map((row) => {
      const component = lightComponentDatabase.find((c) => c.id.toString() === row.componentId);
      const fixtureType = row.fixtureType || component?.fixtureType || DEFAULT_FIXTURE_TYPE;
      const pfValue = parseRowPf(row, component);
      const totalWatts =
        parseFloat(row.quantity) && parseFloat(row.watts)
          ? parseFloat(row.quantity) * parseFloat(row.watts)
          : 0;
      return {
        ...row,
        componentName: component?.name || '',
        fixtureType,
        pf: pfValue.toFixed(2),
        totalWatts,
      };
    });

    const totalWatts = calculatedRows.reduce((sum, row) => sum + (row.totalWatts || 0), 0);
    const totalVa = calculatedRows.reduce((sum, row) => {
      const pfValue = Number(row.pf) || getRecommendedPf(row.fixtureType);
      if (!pfValue) return sum;
      return sum + (row.totalWatts || 0) / pfValue;
    }, 0);
    const { currentLine, adjustedWatts } = calculateLineCurrent(totalWatts, totalVa);
    const pduSuggestion = recommendPDU(currentLine);
    const pduOverride =
      selectedPduType && selectedPduType !== 'default'
        ? selectedPduType === 'Custom'
          ? customPduType
          : selectedPduType
        : undefined;

    const newTable: Table = {
      name: tableName,
      rows: calculatedRows,
      totalWatts,
      adjustedWatts,
      currentPerPhase: currentLine,
      pduType: pduSuggestion,
      customPduType: pduOverride,
      includesHoist,
      id: Date.now(),
    };

    setTables((prev) => [...prev, newTable]);

    if (selectedJobId) {
      savePowerRequirementTable(newTable);
    }

    resetCurrentTable();
  };

  const resetCurrentTable = () => {
    setCurrentTable({
      name: '',
      rows: [{
        quantity: '',
        componentId: '',
        watts: '',
        fixtureType: DEFAULT_FIXTURE_TYPE,
        pf: FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf.toFixed(2),
      }],
    });
    setTableName('');
  };

  const removeTable = (tableId: number | string) => {
    // Only allow removal of regular tables (numeric IDs), not default tables
    if (typeof tableId === 'number') {
      setTables((prev) => prev.filter((table) => table.id !== tableId));
    }
  };

  const updateTableSettings = (tableId: number | string, updates: Partial<Table>) => {
    // Only allow updates to regular tables (numeric IDs), not default tables
    if (typeof tableId === 'number') {
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
    }
  };

  const handleExportPDF = async () => {
    const jobToUse = isOverrideMode && overrideData
      ? { id: 'override', title: `${overrideData.tourName} - ${overrideData.locationName}` }
      : selectedJob;

    if (!jobToUse) {
      toast({
        title: isOverrideMode ? 'No tour data' : 'No hay trabajo seleccionado',
        description: isOverrideMode ? 'Tour data not loaded' : 'Por favor seleccione un trabajo antes de exportar.',
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
        allTables.map((table) => ({ ...table, toolType: 'consumos', phaseMode })),
        'power',
        jobToUse.title,
        ('start_time' in jobToUse ? jobToUse.start_time : null) || new Date().toISOString(),
        undefined,
        undefined,
        safetyMargin,
        logoUrl
      );

      const fileName = `Informe de Potencia - ${jobToUse.title}.pdf`;

      // Auto-complete lights Consumos tasks only after successful upload
      // This automation is department-specific: only lights department tasks are affected
      let completedTasksCount = 0;
      if (!isOverrideMode && selectedJobId) {
        try {
          const { uploadJobPdfWithCleanup } = await import('@/utils/jobDocumentsUpload');
          await uploadJobPdfWithCleanup(
            selectedJobId,
            pdfBlob,
            fileName,
            'calculators/lights-consumos'
          );

          // Auto-complete Consumos tasks for lights department only
          const { autoCompleteConsumosTasks } = await import('@/utils/taskAutoCompletion');
          const result = await autoCompleteConsumosTasks(selectedJobId, 'lights');
          completedTasksCount = result.completedCount;

          if (result.completedCount > 0) {
            console.log(`Auto-completed ${result.completedCount} lights Consumos task(s)`);
          }
        } catch (err) {
          // If auto-completion fails, log but don't fail the upload
          if (err instanceof Error && err.message.includes('uploadJobPdfWithCleanup')) {
            throw err; // Re-throw upload errors
          }
          console.warn('Task auto-completion failed:', err);
        }
      }

      toast({
        title: 'Éxito',
        description: completedTasksCount > 0
          ? `PDF subido exitosamente. ${completedTasksCount} tarea(s) de Consumos auto-completadas.`
          : 'El PDF se ha generado y subido exitosamente.',
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
        description: 'Error al generar o subir el PDF.',
        variant: 'destructive',
      });
    }
  };

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
          <Button variant="ghost" size="icon" onClick={() => navigate('/lights')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">
            {isOverrideMode ? 'Override Mode - ' : ''}Calculadora de Potencia
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
              department="lights"
            />
          )}

          {/* Show defaults section when in override mode */}
          {isOverrideMode && defaultTables.length > 0 && (
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="font-semibold mb-3 text-green-800">Tour Defaults (Read-Only)</h3>
              {defaultTables.map((table) => (
                <div key={table.id} className="border rounded-lg overflow-x-auto mt-4 bg-white">
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
                        <span className="font-medium">{phaseMode === 'three' ? 'Current per Phase:' : 'Current:'}</span> {table.currentPerPhase?.toFixed(2)} A
                      </div>
                      <div>
                        <span className="font-medium">PDU Type:</span> {table.customPduType || table.pduType}
                      </div>
                      {table.includesHoist && (
                        <div className="col-span-2 text-gray-600 italic">
                          Includes hoist power requirement
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="safetyMargin">Margen de Seguridad</Label>
            <Select
              value={safetyMargin.toString()}
              onValueChange={(value) => setSafetyMargin(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar Margen de Seguridad" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supply</Label>
              <Select value={phaseMode} onValueChange={(value) => setPhaseMode(value as 'single' | 'three')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar suministro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Monofásico (230 V)</SelectItem>
                  <SelectItem value="three">Trifásico (400 V LL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Voltaje</Label>
              <Input
                type="number"
                value={voltage}
                onChange={(e) => setVoltage(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">230 V (1φ) o 400 V LL (3φ) por defecto en ES</p>
            </div>
          </div>

          <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">Power factor recomendado por tipo de fixture</p>
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-muted-foreground">
              <li>{FIXTURE_PF.incandescent.label}: {FIXTURE_PF.incandescent.pf.toFixed(2)}</li>
              <li>{FIXTURE_PF.discharge.label}: {FIXTURE_PF.discharge.pf.toFixed(2)}</li>
              <li>{FIXTURE_PF.led.label}: {FIXTURE_PF.led.pf.toFixed(2)}</li>
              <li>{FIXTURE_PF['led-pro'].label}: {FIXTURE_PF['led-pro'].pf.toFixed(2)}</li>
            </ul>
            <p className="mt-2 text-muted-foreground">Puedes ajustar el PF por ítem si el fabricante especifica un valor distinto.</p>
          </div>

          {!isOverrideMode && (
            <div className="space-y-2">
              <Label htmlFor="jobSelect">Seleccionar Trabajo</Label>
              <Select value={selectedJobId} onValueChange={handleJobSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un trabajo" />
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
            <Label htmlFor="tableName">Nombre de la Tabla</Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Ingrese el nombre de la tabla"
            />
          </div>

          <div className="space-y-2">
            <Label>Anulación del Tipo de PDU</Label>
            <Select value={selectedPduType} onValueChange={setSelectedPduType}>
              <SelectTrigger>
                <SelectValue placeholder="Usar el tipo de PDU recomendado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Usar el tipo de PDU recomendado</SelectItem>
                {pduOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
                <SelectItem value="Custom">Tipo de PDU personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedPduType === 'Custom' && (
            <div className="space-y-2">
              <Label>Tipo de PDU Personalizado</Label>
              <Input
                value={customPduType}
                onChange={(e) => setCustomPduType(e.target.value)}
                placeholder="Ingrese un tipo de PDU personalizado"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="hoistPower"
              checked={includesHoist}
              onCheckedChange={(checked) => setIncludesHoist(checked as boolean)}
            />
            <Label htmlFor="hoistPower">Requiere Potencia Adicional para Polipasto (CEE32A 3P+N+G)</Label>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                  <th className="px-4 py-3 text-left font-medium">Componente</th>
                  <th className="px-4 py-3 text-left font-medium">Vatios (por unidad)</th>
                  <th className="px-4 py-3 text-left font-medium">PF (tipo recomendado)</th>
                  <th className="w-12 px-4 py-3 text-left font-medium">&nbsp;</th>
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
                      <Popover
                        open={componentDropdowns[index] ?? false}
                        onOpenChange={(open) => updateComponentDropdown(index, open)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={componentDropdowns[index] ?? false}
                            className="w-full justify-between font-normal"
                          >
                            <span className={cn('truncate', !row.componentId && 'text-muted-foreground')}>
                              {row.componentId
                                ? lightComponentDatabase.find((component) => component.id.toString() === row.componentId)
                                  ?.name
                                : 'Seleccione componente'}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Buscar componente..."
                              value={componentSearches[index] ?? ''}
                              onValueChange={(value) => updateComponentSearch(index, value)}
                            />
                            <CommandList className="max-h-[240px]">
                              <CommandEmpty>No se encontraron componentes.</CommandEmpty>
                              <CommandGroup>
                                {lightComponentDatabase
                                  .filter((component) =>
                                    component.name.toLowerCase().includes((componentSearches[index] ?? '').toLowerCase())
                                  )
                                  .map((component) => (
                                    <CommandItem
                                      key={component.id}
                                      onSelect={() => {
                                        updateInput(index, 'componentId', component.id.toString());
                                        updateComponentDropdown(index, false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          row.componentId === component.id.toString()
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      <span>{component.name}</span>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="p-4">
                      <Input
                        type="number"
                        value={row.watts}
                        readOnly
                        className="w-full bg-muted"
                      />
                    </td>
                    <td className="p-4">
                      <div className="space-y-2">
                        <Select
                          value={row.fixtureType || DEFAULT_FIXTURE_TYPE}
                          onValueChange={(value) => updateInput(index, 'fixtureType', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Tipo de fixture" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(FIXTURE_PF).map(([key, data]) => (
                              <SelectItem key={key} value={key}>
                                {data.label} ({data.pf.toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.1"
                          max="1"
                          value={row.pf || ''}
                          onChange={(e) => updateInput(index, 'pf', e.target.value)}
                          placeholder="PF"
                        />
                      </div>
                    </td>
                    <td className="p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(index)}
                        className="text-destructive hover:text-destructive"
                        aria-label="Eliminar fila"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={addRow}>Agregar Fila</Button>
            <Button onClick={generateTable} variant="secondary">
              Generar Tabla
            </Button>
            <Button onClick={resetCurrentTable} variant="destructive">
              Reiniciar
            </Button>
            {tables.length > 0 && (
              <Button onClick={handleExportPDF} variant="outline" className="ml-auto gap-2">
                <FileText className="w-4 h-4" />
                Exportar y Subir PDF
              </Button>
            )}
          </div>

          {tables.map((table) => (
            <div key={table.id} className="border rounded-lg overflow-x-auto mt-6">
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
                    Eliminar Tabla
                  </Button>
                )}
              </div>

              {typeof table.id === 'number' && (
                <div className="p-4 bg-muted/50 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`hoist-${table.id}`}
                        checked={table.includesHoist}
                        onCheckedChange={(checked) =>
                          updateTableSettings(table.id as number, { includesHoist: !!checked })
                        }
                      />
                      <Label htmlFor={`hoist-${table.id}`}>Incluir Potencia para Polipasto (CEE32A 3P+N+G)</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label>Anulación de Tipo de PDU:</Label>
                      <Select
                        value={
                          table.customPduType
                            ? pduOptions.includes(table.customPduType)
                              ? table.customPduType
                              : 'Custom'
                            : 'default'
                        }
                        onValueChange={(value) => {
                          if (value === 'default') {
                            updateTableSettings(table.id as number, { customPduType: undefined });
                          } else if (value === 'Custom') {
                            updateTableSettings(table.id as number, { customPduType: '' });
                          } else {
                            updateTableSettings(table.id as number, { customPduType: value });
                          }
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Usar PDU sugerido" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Usar PDU sugerido</SelectItem>
                          {pduOptions.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                          <SelectItem value="Custom">Tipo de PDU personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {table.customPduType !== undefined && !pduOptions.includes(table.customPduType || '') && (
                      <Input
                        placeholder="Ingrese un tipo de PDU personalizado"
                        value={table.customPduType || ''}
                        onChange={(e) =>
                          updateTableSettings(table.id as number, { customPduType: e.target.value })
                        }
                        className="w-[220px]"
                      />
                    )}
                  </div>
                </div>
              )}

              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                    <th className="px-4 py-3 text-left font-medium">Componente</th>
                    <th className="px-4 py-3 text-left font-medium">Vatios (por unidad)</th>
                    <th className="px-4 py-3 text-left font-medium">PF</th>
                    <th className="px-4 py-3 text-left font-medium">Vatios Totales</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.componentName}</td>
                      <td className="px-4 py-3">{row.watts}</td>
                      <td className="px-4 py-3">
                        {Number.isFinite(Number(row.pf))
                          ? Number(row.pf).toFixed(2)
                          : getRecommendedPf(row.fixtureType).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">{row.totalWatts?.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      Vatios Totales:
                    </td>
                    <td className="px-4 py-3">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                  {safetyMargin > 0 && (
                    <tr className="border-t bg-muted/50 font-medium">
                      <td colSpan={4} className="px-4 py-3 text-right">
                        Vatios Ajustados ({safetyMargin}% margen de seguridad):
                      </td>
                      <td className="px-4 py-3">{table.adjustedWatts?.toFixed(2)} W</td>
                    </tr>
                  )}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      {phaseMode === 'three' ? 'Corriente por Fase:' : 'Corriente:'}
                    </td>
                    <td className="px-4 py-3">{table.currentPerPhase?.toFixed(2)} A</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-right">
                      PDU Sugerido:
                    </td>
                    <td className="px-4 py-3">{table.pduType}</td>
                  </tr>
                  {table.customPduType && (
                    <tr className="border-t bg-muted/50 font-medium text-primary">
                      <td colSpan={4} className="px-4 py-3 text-right">
                        Anulación de PDU Seleccionada:
                      </td>
                      <td className="px-4 py-3">{table.customPduType}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {table.includesHoist && (
                <div className="px-4 py-2 text-sm text-gray-500 bg-muted/30 italic">
                  Se requiere potencia adicional para polipasto: CEE32A 3P+N+G
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LightsConsumosTool;
