import React, { useState } from 'react';
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

const lightComponentDatabase = [
  { id: 1, name: 'CAMEO OPUS S5', watts: 650 },
  { id: 2, name: 'CLAY PAKY A-LEDA K20', watts: 650 },
  { id: 3, name: 'CLAY PAKY A-LEDA K25', watts: 1100 },
  { id: 4, name: 'CLAY PAKY STORMY CC', watts: 800 },
  { id: 5, name: 'ELATION CHORUS LINE 16', watts: 750 },
  { id: 6, name: 'MARTIN MAC AURA', watts: 260 },
  { id: 7, name: 'MARTIN MAC VIPER', watts: 1200 },
  { id: 8, name: 'ROBE BMFL BLADE', watts: 2000 },
  { id: 9, name: 'ROBE BMFL SPOT', watts: 2000 },
  { id: 10, name: 'ROBE BMFL WASHBEAM', watts: 2000 },
  { id: 11, name: 'ROBE MEGAPOINTE', watts: 670 },
  { id: 12, name: 'ROBE POINTE', watts: 470 },
  { id: 13, name: 'TRITON BLUE 15R BEAM', watts: 500 },
  { id: 14, name: 'TRITON BLUE 15R SPOT', watts: 500 },
  { id: 15, name: 'TRITON BLUE WALLY 3715', watts: 650 },
  { id: 16, name: 'CAMEO AURO BAR 100', watts: 140 },
  { id: 17, name: 'ACL 250W (2 BARRAS)', watts: 2000 },
  { id: 18, name: 'ACL 650W (2 BARRAS)', watts: 5200 },
  { id: 19, name: 'BARRA PAR 64x6', watts: 6000 },
  { id: 20, name: 'FRESNELL 2KW', watts: 2000 },
  { id: 21, name: 'MOLEFAY BLINDER 4', watts: 2600 },
  { id: 22, name: 'MOLEFAY BLINDER 8', watts: 5200 },
  { id: 23, name: 'PAR 64', watts: 1000 },
  { id: 24, name: 'ADMIRAL VINTAGE 53cm', watts: 60 },
  { id: 25, name: 'ADMIRAL VINTAGE 38cm', watts: 60 },
  { id: 26, name: 'FRESNELL 5KW', watts: 5000 },
  { id: 27, name: 'MOLEFAY BLINDER 2', watts: 1300 },
  { id: 28, name: 'RECORTE ETC 25º/50º', watts: 750 },
  { id: 29, name: 'RECORTE ETC 15º/30º', watts: 750 },
  { id: 30, name: 'RECORTE ETC 19º', watts: 750 },
  { id: 31, name: 'RECORTE ETC 10º', watts: 750 },
  { id: 32, name: 'RECORTE TB LED 25º/50º', watts: 300 },
  { id: 33, name: 'SUNSTRIP', watts: 500 },
  { id: 34, name: 'CAMEO ZENIT 120', watts: 120 },
  { id: 35, name: 'ELATION SIXBAR 1000', watts: 150 },
  { id: 36, name: 'MARTIN ATOMIC 3000', watts: 3000 },
  { id: 37, name: 'SGM Q7', watts: 500 },
  { id: 38, name: 'ELATION SIXBAR 500', watts: 80 },
  { id: 39, name: 'SMOKE FACTORY TOUR HAZERII', watts: 1500 },
  { id: 40, name: 'ROBE 500 FT-PRO', watts: 1200 },
  { id: 41, name: 'SAHARA TURBO DRYER', watts: 1500 },
  { id: 42, name: 'ROBE SPIIDER', watts: 660 },
  { id: 43, name: 'GLP JDC1', watts: 1200 },
  { id: 44, name: 'CAMEO W3', watts: 325 },
  { id: 45, name: 'CHAUVET COLOR STRIKE M', watts: 750 },
  { id: 46, name: 'GLP X4 BAR 20', watts: 500 },
  { id: 47, name: 'ROBERT JULIAT ARAMIS', watts: 2500 },
  { id: 48, name: 'ROBERT JULIAT MERLIN', watts: 2500 },
  { id: 49, name: 'ROBERT JULIAT CYRANO', watts: 2500 },
  { id: 50, name: 'ROBERT JULIAT LANCELOT', watts: 4000 },
  { id: 51, name: 'ROBERT JULIAT KORRIGAN', watts: 1200 }
];

const VOLTAGE_3PHASE = 400;
const POWER_FACTOR = 0.85;
const PHASES = 3;

const PDU_TYPES = ['CEE32A 3P+N+G', 'CEE63A 3P+N+G', 'Powerlock 400A 3P+N+G', 'Custom'];

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
  includesHoist?: boolean;
  id?: number;
}

const LightsConsumosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobSelection | null>(null);
  const [tableName, setTableName] = useState(''); // nombre sin formato ingresado por el usuario
  const [tables, setTables] = useState<Table[]>([]);
  const [safetyMargin, setSafetyMargin] = useState(0);
  const [includesHoist, setIncludesHoist] = useState(false);
  const [selectedPduType, setSelectedPduType] = useState<string>(''); // selección de anulación
  const [customPduType, setCustomPduType] = useState<string>(''); // si es personalizado

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
      const component = lightComponentDatabase.find((c) => c.id.toString() === value);
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
      pduType: selectedPduType === 'Custom' ? customPduType : pduSuggestion,
      customPduType: selectedPduType === 'Custom' ? customPduType : undefined,
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
        title: 'No hay trabajo seleccionado',
        description: 'Por favor seleccione un trabajo antes de exportar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const pdfBlob = await exportToPDF(
        selectedJob.title,
        tables.map((table) => ({ ...table, toolType: 'consumos' })),
        'power',
        selectedJob.title,
        undefined,
        undefined,
        undefined,
        safetyMargin
      );

      const fileName = `Informe de Potencia - ${selectedJob.title}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const filePath = `lights/${selectedJobId}/${crypto.randomUUID()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('task_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      toast({
        title: 'Éxito',
        description: 'El PDF se ha generado y subido exitosamente.',
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

  return (
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/lights')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">Calculadora de Potencia</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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
                {PDU_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
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

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                  <th className="px-4 py-3 text-left font-medium">Componente</th>
                  <th className="px-4 py-3 text-left font-medium">Vatios (por unidad)</th>
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
                          <SelectValue placeholder="Seleccione componente" />
                        </SelectTrigger>
                        <SelectContent>
                          {lightComponentDatabase.map((component) => (
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
            <div key={table.id} className="border rounded-lg overflow-hidden mt-6">
              <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <h3 className="font-semibold">{table.name}</h3>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => table.id && removeTable(table.id)}
                >
                  Eliminar Tabla
                </Button>
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
                    <Label htmlFor={`hoist-${table.id}`}>Incluir Potencia para Polipasto (CEE32A 3P+N+G)</Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label>Anulación de Tipo de PDU:</Label>
                    <Select
                      value={table.customPduType || 'default'}
                      onValueChange={(value) => 
                        table.id && updateTableSettings(table.id, { 
                          customPduType: value === 'default' ? undefined : value 
                        })
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Usar PDU sugerido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Usar PDU sugerido</SelectItem>
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
                    <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                    <th className="px-4 py-3 text-left font-medium">Componente</th>
                    <th className="px-4 py-3 text-left font-medium">Vatios (por unidad)</th>
                    <th className="px-4 py-3 text-left font-medium">Vatios Totales</th>
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
                      Vatios Totales:
                    </td>
                    <td className="px-4 py-3">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Corriente por Fase:
                    </td>
                    <td className="px-4 py-3">{table.currentPerPhase?.toFixed(2)} A</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-right">
                      PDU Sugerido:
                    </td>
                    <td className="px-4 py-3">{table.pduType}</td>
                  </tr>
                  {table.customPduType && (
                    <tr className="border-t bg-muted/50 font-medium text-primary">
                      <td colSpan={3} className="px-4 py-3 text-right">
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
