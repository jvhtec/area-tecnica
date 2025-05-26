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
import { supabase } from '@/lib/supabase';

const soundComponentDatabase = [
  { id: 1, name: 'Subgraves', weight: 80 },
  { id: 2, name: 'Line Array', weight: 50 },
  { id: 3, name: 'Frontfill', weight: 25 },
  { id: 4, name: 'Outfill', weight: 40 },
  { id: 5, name: 'Drumfill', weight: 30 },
  { id: 6, name: 'Sidefill', weight: 35 },
  { id: 7, name: 'Monitores de piso', weight: 20 },
  { id: 8, name: 'Consola', weight: 15 },
  { id: 9, name: 'Retornos', weight: 10 },
  { id: 10, name: 'Microfonia', weight: 5 },
  { id: 11, name: 'Soportes', weight: 8 },
  { id: 12, name: 'Cables', weight: 12 },
  { id: 13, name: 'Procesadores', weight: 7 },
  { id: 14, name: 'Potencias', weight: 22 },
  { id: 15, name: 'Estructuras', weight: 60 },
  { id: 16, name: 'Otros', weight: 100 }
];

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
  isDefault?: boolean;
}

const PesosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  const department = 'sound';

  // Tour mode detection
  const tourId = searchParams.get('tourId');
  const tourDateId = searchParams.get('tourDateId');
  const mode = searchParams.get('mode');
  const isTourDefaultsMode = mode === 'tour-defaults';
  
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
  const [useDualMotors, setUseDualMotors] = useState(false);

  const [currentTable, setCurrentTable] = useState<Table>({
    name: '',
    rows: [{ quantity: '', componentId: '', weight: '' }],
  });

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

  const generateTable = () => {
    if (!tableName) {
      toast({
        title: 'Falta el nombre de la tabla',
        description: 'Por favor, ingrese un nombre para la tabla',
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

    const newTable: Table = {
      name: tableName,
      rows: calculatedRows,
      totalWeight,
      id: Date.now(),
      dualMotors: useDualMotors,
    };

    setTables((prev) => [...prev, newTable]);
    
    saveWeightTable(newTable);
    resetCurrentTable();
    setUseDualMotors(false);
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
    if (!selectedJobId && !isTourDefaultsMode) {
      toast({
        title: 'No se ha seleccionado ningún trabajo',
        description: 'Por favor, seleccione un trabajo antes de exportar.',
        variant: 'destructive',
      });
      return;
    }

    const jobTitle = selectedJob ? selectedJob.title : 'Tour Defaults';

    try {
      const pdfBlob = await exportToPDF(
        jobTitle,
        tables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        jobTitle,
        undefined
      );

      const fileName = `Informe de Peso de Sonido - ${jobTitle}.pdf`;
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Éxito',
        description: 'El PDF se ha generado exitosamente.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF.',
        variant: 'destructive',
      });
    }
  };

  const saveWeightTable = async (table: Table) => {
    if (isTourDefaultsMode && tourId) {
      // Save as tour default
      try {
        const { error } = await supabase
          .from('tour_weight_defaults')
          .insert({
            tour_id: tourId,
            department: 'sound',
            item_name: table.name,
            weight_kg: table.totalWeight || 0,
            quantity: 1,
            category: 'sound'
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Tour weight default saved successfully",
        });
      } catch (error: any) {
        console.error('Error saving tour weight default:', error);
        toast({
          title: "Error",
          description: "Failed to save tour weight default",
          variant: "destructive"
        });
      }
      return;
    }

    if (isOverrideMode && overrideData) {
      // Save as override for tour date
      const overrideSuccess = await saveOverride('weight', {
        item_name: table.name,
        weight_kg: table.totalWeight || 0,
        quantity: 1,
        category: 'sound',
        override_data: {
          rows: table.rows
        }
      });

      if (overrideSuccess) {
        toast({
          title: "Success",
          description: "Weight override saved for tour date",
        });
      }
      return;
    }

    // For regular job mode, we don't have a weight table to save to, so just show success
    if (selectedJobId) {
      toast({
        title: "Success",
        description: "Weight table created successfully",
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/sound')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">
            {isTourDefaultsMode ? 'Tour Defaults - ' : isOverrideMode ? 'Override Mode - ' : ''}
            Calculadora de Peso
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {isTourDefaultsMode && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold mb-2 text-blue-800">Tour Defaults Mode</h3>
              <p className="text-sm text-blue-700">
                You are creating weight defaults that will apply to all dates in this tour unless specifically overridden.
              </p>
            </div>
          )}

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
                      <span className="font-medium">Total Weight:</span> {table.totalWeight?.toFixed(2)} kg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isOverrideMode && !isTourDefaultsMode && (
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

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                  <th className="px-4 py-3 text-left font-medium">Componente</th>
                  <th className="px-4 py-3 text-left font-medium">Peso (por unidad)</th>
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
                Exportar PDF
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
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                    <th className="px-4 py-3 text-left font-medium">Componente</th>
                    <th className="px-4 py-3 text-left font-medium">Peso (por unidad)</th>
                    <th className="px-4 py-3 text-left font-medium">Peso Total</th>
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
                      Peso Total:
                    </td>
                    <td className="px-4 py-3">{table.totalWeight?.toFixed(2)}</td>
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
