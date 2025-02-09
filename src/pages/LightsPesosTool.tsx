import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, ArrowLeft } from 'lucide-react';
import { exportToPDF } from '@/utils/pdfExport';
import { useJobSelection } from '@/hooks/useJobSelection';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const lightsComponentDatabase = [
  { id: 1, name: 'CAMEO OPS S5', weight: 26 },
  { id: 2, name: 'CLAY PAKY A-LEDA K20', weight: 23 },
  { id: 3, name: 'CLAY PAKY A-LEDA K25', weight: 30 },
  { id: 4, name: 'CLAY PAKY STORMY CC', weight: 8 },
  { id: 5, name: 'ELATION CHORUS LINE 16', weight: 22 },
  { id: 6, name: 'MARTIN MAC AURA', weight: 7 },
  { id: 7, name: 'MARTIN MAC VIPER', weight: 39 },
  { id: 8, name: 'ROBE BMFL BLADE', weight: 40 },
  { id: 9, name: 'ROBE BMFL SPOT', weight: 38 },
  { id: 10, name: 'ROBE BMFL WASHBEAM', weight: 41 },
  { id: 11, name: 'ROBE MEGAPOINTE', weight: 24 },
  { id: 12, name: 'ROBE POINTE', weight: 17 },
  { id: 13, name: 'TRITON BLUE 15R BEAM', weight: 21 },
  { id: 14, name: 'TRITON BLUE 15R SPOT', weight: 24 },
  { id: 15, name: 'TRITON BLUE WALLY 3715', weight: 17 },
  { id: 16, name: 'CAMEO AURO BAR 100', weight: 12 },
  { id: 17, name: 'ACL 250W (2 BARRAS)', weight: 34 },
  { id: 18, name: 'ACL 650W (2 BARRAS)', weight: 34 },
  { id: 19, name: 'BARRA PAR 64x6', weight: 28 },
  { id: 20, name: 'FRESNELL 2KW', weight: 9 },
  { id: 21, name: 'MOLEFAY BLINDER 4', weight: 7 },
  { id: 22, name: 'MOLEFAY BLINDER 8', weight: 9 },
  { id: 23, name: 'PAR 64', weight: 4 },
  { id: 24, name: 'ADMIRAL VINTAGE 53cm', weight: 7 },
  { id: 25, name: 'ADMIRAL VINTAGE 38cm', weight: 5 },
  { id: 26, name: 'FRESNELL 5KW', weight: 13 },
  { id: 27, name: 'MOLEFAY BLINDER 2', weight: 4 },
  { id: 28, name: 'RECORTE ETC 25º/50º', weight: 10 },
  { id: 29, name: 'RECORTE ETC 15º/30º', weight: 12 },
  { id: 30, name: 'RECORTE ETC 19º', weight: 8 },
  { id: 31, name: 'RECORTE ETC 10º', weight: 8 },
  { id: 32, name: 'RECORTE TB LED 25º/50º', weight: 15 },
  { id: 33, name: 'SUNSTRIP', weight: 7 },
  { id: 34, name: 'CAMEO ZENIT 120', weight: 10 },
  { id: 35, name: 'ELATION SIXBAR 1000', weight: 8 },
  { id: 36, name: 'MARTIN ATOMIC 3000', weight: 8 },
  { id: 37, name: 'SGM Q7', weight: 9 },
  { id: 38, name: 'ELATION SIXBAR 500', weight: 5 },
  { id: 39, name: 'MOTOR CM 250Kg', weight: 30 },
  { id: 40, name: 'MOTOR CM 500Kg', weight: 50 },
  { id: 41, name: 'MOTOR CM 1000Kg', weight: 70 },
  { id: 42, name: 'MOTOR CM 2000Kg', weight: 75 },
  { id: 43, name: 'MOTOR CHAINMASTER 1000KG', weight: 69 },
  { id: 44, name: 'MOTOR CHAINMASTER D8+ 750KG', weight: 69 },
  { id: 45, name: 'TRUSS 76x52 3M', weight: 50 },
  { id: 46, name: 'TRUSS 76x52 2M', weight: 32 },
  { id: 47, name: 'TRUSS 76x52 1M', weight: 24 },
  { id: 48, name: 'TRUSS 52x52 3M', weight: 40 },
  { id: 49, name: 'TRUSS 52x52 2M', weight: 35 },
  { id: 50, name: 'TRUSS 52x52 1M', weight: 27 },
  { id: 51, name: 'TRUSS PROLYTE 30x30 4M', weight: 25 },
  { id: 52, name: 'TRUSS PROLYTE 30x30 3M', weight: 19 },
  { id: 53, name: 'TRUSS PROLYTE 30x30 2M', weight: 13 },
  { id: 54, name: 'TRUSS PROLYTE 30x30 1M', weight: 7 },
  { id: 55, name: 'TRUSS PROLYTE 30x30 0,7M', weight: 6 },
  { id: 56, name: 'TRUSS PROLYTE 30x30 0,5M', weight: 4 },
  { id: 57, name: 'TRUSS PROLYTE 30x30 0,3M', weight: 3 },
  { id: 58, name: 'TRUSS PROLYTE 30x30 CUBO', weight: 12 },
  { id: 59, name: 'TRUSS PRT 2.44M', weight: 45 },
  { id: 60, name: 'TRUSS PRT 3,06M', weight: 43 },
  { id: 61, name: 'VARIOS', weight: 100 }
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
  id?: number;
  dualMotors?: boolean;
}

const LightsPesosTool: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: jobs } = useJobSelection();
  const department = 'lights';

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState<Table[]>([]);
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
      const component = lightsComponentDatabase.find((c) => c.id.toString() === value);
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
      const component = lightsComponentDatabase.find((c) => c.id.toString() === row.componentId);
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
      dualMotors: useDualMotors
    };

    setTables((prev) => [...prev, newTable]);
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
    if (!selectedJobId || !selectedJob) {
      toast({
        title: 'No se ha seleccionado ningún trabajo',
        description: 'Por favor, seleccione un trabajo antes de exportar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const pdfBlob = await exportToPDF(
        selectedJob.title,
        tables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        selectedJob.title,
        undefined
      );

      const fileName = `Informe de Peso de Luces - ${selectedJob.title}.pdf`;
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

  return (
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/lights')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">Calculadora de Peso de Luces</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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
                          {lightsComponentDatabase.map((component) => (
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

export default LightsPesosTool;
