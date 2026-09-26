import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Eye, Loader2, Table, Printer, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HojaDeRutaPdfSectionId } from "@/utils/hoja-de-ruta/pdf";

export interface HojaDeRutaPrintSection {
  id: HojaDeRutaPdfSectionId;
  label: string;
  icon: LucideIcon;
}

export type HojaDeRutaPrintPreviewTarget = HojaDeRutaPdfSectionId | "full" | "driver-certificate" | null;

interface HojaDeRutaPrintDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  onGeneratePDF: () => void;
  onPublishPDF: () => void;
  canPublish: boolean;
  onGenerateDriverCertificatePDF: () => void;
  onGenerateSectionPDF: (sectionId: HojaDeRutaPdfSectionId) => void;
  onPreviewPDF: () => void;
  onPreviewDriverCertificatePDF: () => void;
  onPreviewSectionPDF: (sectionId: HojaDeRutaPdfSectionId) => void;
  onGenerateXLS: () => void;
  onGenerateAccreditationXLS: () => void;
  sections: HojaDeRutaPrintSection[];
  isGenerating?: boolean;
  generatingSectionId?: HojaDeRutaPdfSectionId | null;
  isPreviewing?: boolean;
  previewingTarget?: HojaDeRutaPrintPreviewTarget;
}

export const HojaDeRutaPrintDialog: React.FC<HojaDeRutaPrintDialogProps> = ({
  showDialog,
  setShowDialog,
  onGeneratePDF,
  onPublishPDF,
  canPublish,
  onGenerateDriverCertificatePDF,
  onGenerateSectionPDF,
  onPreviewPDF,
  onPreviewDriverCertificatePDF,
  onPreviewSectionPDF,
  onGenerateXLS,
  onGenerateAccreditationXLS,
  sections,
  isGenerating = false,
  generatingSectionId = null,
  isPreviewing = false,
  previewingTarget = null,
}) => {
  const confirm = useConfirm();
  const isBusy = isGenerating || isPreviewing;

  const handleAccreditationExport = async () => {
    const accepted = await confirm({
      title: "Exportar datos personales",
      description: "El archivo incluirá los DNI del personal. ¿Continuar?",
      confirmText: "Exportar",
      cancelText: "Cancelar",
      destructive: true,
    });
    if (accepted) onGenerateAccreditationXLS();
  };

  const renderPreviewButton = (
    label: string,
    target: Exclude<HojaDeRutaPrintPreviewTarget, null>,
    onClick: () => void
  ) => {
    const isTargetPreviewing = isPreviewing && previewingTarget === target;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-11 shrink-0"
            onClick={() => { void onClick(); }}
            disabled={isBusy}
            aria-label={label}
          >
            {isTargetPreviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar Hoja de Ruta</DialogTitle>
          <DialogDescription className="sr-only">
            Genera, previsualiza o exporta la hoja de ruta.
          </DialogDescription>
        </DialogHeader>
        <TooltipProvider>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-base">Imprimir a PDF</h3>
              <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                <Button onClick={() => { void onGeneratePDF(); }} disabled={isBusy}>
                  <Printer className="h-4 w-4 mr-2" />
                  Descargar documento completo PDF
                </Button>
                {renderPreviewButton("Vista previa documento completo PDF", "full", onPreviewPDF)}
              </div>
              <Button
                onClick={() => { void onPublishPDF(); }}
                disabled={isBusy || !canPublish}
                variant="default"
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {canPublish ? "Publicar para el equipo" : "Aprobar antes de publicar"}
              </Button>
              <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                <Button onClick={() => { void onGenerateDriverCertificatePDF(); }} disabled={isBusy} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Hoja de Transportes PDF
                </Button>
                {renderPreviewButton(
                  "Vista previa hoja de transportes PDF",
                  "driver-certificate",
                  onPreviewDriverCertificatePDF
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
              <h3 className="font-semibold text-base">Acreditaciones</h3>
              <p className="flex gap-2 text-sm text-warning-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Contiene datos personales (DNI). Solo para uso interno; no se publica al equipo.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => { void handleAccreditationExport(); }}
                disabled={isBusy}
              >
                <Table className="h-4 w-4 mr-2" />
                Exportar acreditaciones (XLS)
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-base">Imprimir sección a PDF</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isSectionGenerating = generatingSectionId === section.id;

                  return (
                    <div key={section.id} className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                      <Button
                        onClick={() => { void onGenerateSectionPDF(section.id); }}
                        disabled={isBusy}
                        variant="outline"
                        className="justify-start"
                      >
                        {isSectionGenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4 mr-2" />
                        )}
                        {section.label}
                      </Button>
                      {renderPreviewButton(
                        `Vista previa ${section.label}`,
                        section.id,
                        () => onPreviewSectionPDF(section.id)
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-base">Exportar a Excel</h3>
              <Button onClick={() => { void onGenerateXLS(); }} disabled={isBusy}>
                <Table className="h-4 w-4 mr-2" />
                Hoja de Ruta Excel (Una pestaña por sección)
              </Button>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
};
