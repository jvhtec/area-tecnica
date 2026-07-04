
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WiredMic } from "./WiredMicConfig";
import { Info, CheckCircle, Minus, Plus, ShieldPlus } from "lucide-react";
import { applyMicrophoneSpares, suggestMicrophoneSpares } from "@/utils/microphoneSpares";

interface MicrophoneAnalysisPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peakRequirements: WiredMic[];
  analysisDetails: {
    totalArtists: number;
    totalDates: number;
    microphoneModels: string[];
    peakCalculationMethod: string;
    stageNumber: number;
  };
  onConfirm: (requirements: WiredMic[]) => void;
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
  const [includeSpares, setIncludeSpares] = useState(true);
  const [spares, setSpares] = useState<Record<string, number>>({});
  const wasOpenRef = useRef(false);

  // Seed the spare amounts from the suggestion policy only when the dialog
  // transitions to open, so a background/focus refetch that swaps
  // peakRequirements while the dialog is already open doesn't wipe the user's
  // manual spare edits. Re-opening always reseeds from the current analysis.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const suggestions = suggestMicrophoneSpares(peakRequirements);
      setSpares(Object.fromEntries(suggestions.map((s) => [s.model, s.spareQuantity])));
      setIncludeSpares(true);
    }
    wasOpenRef.current = open;
  }, [open, peakRequirements]);

  const setSpareFor = (model: string, next: number) => {
    setSpares((prev) => ({ ...prev, [model]: Math.max(0, next) }));
  };

  const totalSpares = useMemo(
    () => peakRequirements.reduce((sum, mic) => sum + (spares[mic.model] || 0), 0),
    [peakRequirements, spares],
  );

  const handleConfirm = () => {
    const finalRequirements = includeSpares
      ? applyMicrophoneSpares(peakRequirements, spares)
      : peakRequirements;
    onConfirm(finalRequirements);
  };

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
              Análisis completado para {analysisDetails.totalArtists} artistas en {analysisDetails.totalDates} fecha{analysisDetails.totalDates !== 1 ? "s" : ""} de Stage {analysisDetails.stageNumber} usando micrófonos de festival/mixto.
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
            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-amber-700">{analysisDetails.totalDates}</div>
              <div className="text-sm text-amber-600">Fechas Analizadas</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{peakRequirements.length}</div>
              <div className="text-sm text-purple-600">Modelos de Mic Requeridos</div>
            </div>
          </div>

          {peakRequirements.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
                <h3 className="text-lg font-semibold">Requisitos Máximos de Micrófonos para Stage {analysisDetails.stageNumber}</h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-spares"
                    checked={includeSpares}
                    onCheckedChange={(checked) => setIncludeSpares(!!checked)}
                  />
                  <Label htmlFor="include-spares" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                    <ShieldPlus className="h-4 w-4 text-emerald-600" />
                    Incluir repuestos sugeridos
                  </Label>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo de Micrófono</TableHead>
                    <TableHead className="text-center">Pico</TableHead>
                    <TableHead className="text-center">Repuestos</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peakRequirements.map((mic, index) => {
                    const spare = includeSpares ? (spares[mic.model] || 0) : 0;
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{mic.model}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{mic.quantity}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={!includeSpares || spare <= 0}
                              onClick={() => setSpareFor(mic.model, spare - 1)}
                              aria-label={`Reducir repuestos de ${mic.model}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold tabular-nums">
                              {spare}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={!includeSpares}
                              onClick={() => setSpareFor(mic.model, spare + 1)}
                              aria-label={`Aumentar repuestos de ${mic.model}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold tabular-nums">
                          {mic.quantity + spare}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {mic.notes}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {includeSpares && totalSpares > 0 && (
                <div className="mt-2 text-sm text-emerald-700 flex items-center gap-1">
                  <ShieldPlus className="h-4 w-4" />
                  Se añadirán {totalSpares} micrófono{totalSpares !== 1 ? "s" : ""} de repuesto al kit.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron requisitos de micrófonos para Stage {analysisDetails.stageNumber}.
              Asegúrese de que los artistas en este stage tengan micrófonos cableados configurados con kit festival o mixto.
            </div>
          )}

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-800">
              <strong>Nota:</strong> Estos requisitos son específicos para Stage {analysisDetails.stageNumber} y se fusionarán con su kit de micrófonos existente.
              Las cantidades para modelos existentes se actualizarán al valor más alto. Los repuestos sugeridos parten de ~10% del pico (mínimo 1 por modelo) y son ajustables antes de cargar.
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
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
