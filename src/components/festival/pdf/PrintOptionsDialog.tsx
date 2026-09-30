import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  PRINT_SECTIONS,
  defaultPrintOptions,
  printFilename,
  setAllStages,
  toggleStage,
  type PrintOptions,
} from "@/features/festival-print/model";
import { usePrintOptionDownloads } from "@/features/festival-print/hooks/usePrintOptionDownloads";
import type { FestivalPdfProgress } from "@/utils/pdf/festivalPdfGenerator";
import { MissingRiderEmailForm } from "./MissingRiderEmailForm";
import { PrintSectionRow } from "./PrintSectionRow";

interface PrintOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: PrintOptions, filename: string) => void;
  maxStages: number;
  jobTitle: string;
  jobId?: string;
  closeOnConfirm?: boolean;
  isGenerating?: boolean;
  progress?: FestivalPdfProgress | null;
}

export const PrintOptionsDialog = ({
  open,
  onOpenChange,
  onConfirm,
  maxStages,
  jobTitle,
  jobId,
  closeOnConfirm = true,
  isGenerating = false,
  progress = null,
}: PrintOptionsDialogProps) => {
  const [options, setOptions] = useState<PrintOptions>(() => defaultPrintOptions(maxStages));
  const downloads = usePrintOptionDownloads({ jobId, jobTitle, options });

  const filename = printFilename(options, jobTitle, maxStages);
  const perStage = options.generateIndividualStagePDFs;
  const progressValue =
    progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : undefined;

  const handleConfirm = () => {
    onConfirm(options, filename);
    if (closeOnConfirm) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isGenerating && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] sm:max-h-[90vh] w-[95vw] sm:w-auto overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Seleccionar Documentos para Imprimir</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="individual-stage-pdfs"
                checked={perStage}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, generateIndividualStagePDFs: checked === true }))
                }
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
              />
              <Label
                htmlFor="individual-stage-pdfs"
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
              >
                Generar PDFs Individuales por Stage
              </Label>
            </div>
            <p className="text-sm text-muted-foreground pl-6 dark:text-gray-300">
              {perStage
                ? "Crea documentos PDF separados para cada stage conteniendo los tipos de documentos seleccionados. Se descarga como un archivo ZIP con PDFs individuales para cada stage."
                : "Crear un único PDF combinado con los tipos de documentos y stages seleccionados. Usa las selecciones de stage abajo para elegir qué stages incluir para cada tipo de documento."}
            </p>
          </div>

          {maxStages > 1 && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3 dark:text-gray-200">Controles Globales de Stage</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions((prev) => setAllStages(prev, maxStages, true))}
                  className="w-full sm:w-auto"
                >
                  Seleccionar Todos los Stages
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions((prev) => setAllStages(prev, maxStages, false))}
                  className="w-full sm:w-auto"
                >
                  Deseleccionar Todos los Stages
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 dark:text-gray-400">
                {perStage
                  ? "Estos controles aplican a todas las secciones. Se generarán PDFs individuales para stages que tengan contenido en cada tipo de documento seleccionado."
                  : "Estos controles aplican a todas las secciones que tienen selecciones de stage."}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {PRINT_SECTIONS.map((section) => (
              <PrintSectionRow
                key={section.id}
                section={section}
                options={options}
                maxStages={maxStages}
                canDownload={Boolean(jobId)}
                onIncludeChange={(checked) => setOptions((prev) => ({ ...prev, [section.include]: checked }))}
                onStageChange={(stageNumber, checked) => {
                  const stages = section.stages;
                  if (stages) setOptions((prev) => toggleStage(prev, stages, stageNumber, checked));
                }}
                onDownload={() => {
                  if (section.download) void downloads.download(section.download);
                }}
              >
                {section.download === "missingRiderReport" && jobId && (
                  <MissingRiderEmailForm
                    recipients={downloads.recipientEmails}
                    onRecipientsChange={downloads.setRecipientEmails}
                    isSending={downloads.isSending}
                    onSend={() => void downloads.sendMissingRiders()}
                  />
                )}
              </PrintSectionRow>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="bg-muted/50 p-3 rounded-md dark:bg-muted/20">
              <h4 className="text-xs sm:text-sm font-medium mb-1 dark:text-gray-200">Nombre de archivo generado:</h4>
              <p className="text-xs sm:text-sm text-muted-foreground font-mono dark:text-gray-300 break-all">
                {filename}
              </p>
            </div>
          </div>

          {isGenerating && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/40 dark:bg-muted/20">
              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                <span className="font-medium text-foreground">{progress?.label || "Preparando documentacion"}</span>
                {progress && typeof progressValue === "number" && (
                  <span className="shrink-0 text-muted-foreground">
                    {progress.completed}/{progress.total}
                  </span>
                )}
              </div>
              <Progress value={progressValue ?? 8} className="h-2" />
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isGenerating} className="w-full sm:w-auto">
            {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <span className="hidden sm:inline">
              {isGenerating ? "Generando..." : `Generar ${perStage ? "PDFs Individuales por Stage" : "PDF"}`}
            </span>
            <span className="sm:hidden">{isGenerating ? "Generando..." : "Generar"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
