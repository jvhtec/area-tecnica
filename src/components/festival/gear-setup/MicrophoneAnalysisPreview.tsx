
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WiredMic } from "./WiredMicConfig";
import { Info, CheckCircle } from "lucide-react";

interface MicrophoneAnalysisPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peakRequirements: WiredMic[];
  analysisDetails: {
    totalArtists: number;
    microphoneModels: string[];
    peakCalculationMethod: string;
    stageNumber: number;
  };
  onConfirm: () => void;
  isLoading?: boolean;
}

export const MicrophoneAnalysisPreview = ({
  open,
  onOpenChange,
  peakRequirements,
  analysisDetails,
  onConfirm,
  isLoading = false
}: MicrophoneAnalysisPreviewProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Requisitos de Micrófonos Stage {analysisDetails.stageNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Análisis completado para {analysisDetails.totalArtists} artistas en Stage {analysisDetails.stageNumber} usando micrófonos del festival.
              Requisitos máximos calculados considerando horarios de shows y restricciones de uso exclusivo.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{analysisDetails.stageNumber}</div>
              <div className="text-sm text-blue-600">Número de Stage</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{analysisDetails.totalArtists}</div>
              <div className="text-sm text-green-600">Artistas Analizados</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{peakRequirements.length}</div>
              <div className="text-sm text-purple-600">Modelos de Mic Requeridos</div>
            </div>
          </div>

          {peakRequirements.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold mb-3">Requisitos Máximos de Micrófonos para Stage {analysisDetails.stageNumber}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo de Micrófono</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peakRequirements.map((mic, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{mic.model}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{mic.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {mic.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron requisitos de micrófonos para Stage {analysisDetails.stageNumber}.
              Asegúrese de que los artistas en este stage tengan micrófonos cableados configurados con kit de festival seleccionado.
            </div>
          )}

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-800">
              <strong>Nota:</strong> Estos requisitos son específicos para Stage {analysisDetails.stageNumber} y se fusionarán con su kit de micrófonos existente.
              Las cantidades para modelos existentes se actualizarán al valor más alto.
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading || peakRequirements.length === 0}
            >
              {isLoading ? "Cargando..." : "Cargar Requisitos"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
