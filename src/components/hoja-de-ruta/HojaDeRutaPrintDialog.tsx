import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, Loader2, Table, Printer } from "lucide-react";
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
  onGenerateDriverCertificatePDF: () => void;
  onGenerateSectionPDF: (sectionId: HojaDeRutaPdfSectionId) => void;
  onPreviewPDF: () => void;
  onPreviewDriverCertificatePDF: () => void;
  onPreviewSectionPDF: (sectionId: HojaDeRutaPdfSectionId) => void;
  onGenerateXLS: () => void;
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
  onGenerateDriverCertificatePDF,
  onGenerateSectionPDF,
  onPreviewPDF,
  onPreviewDriverCertificatePDF,
  onPreviewSectionPDF,
  onGenerateXLS,
  sections,
  isGenerating = false,
  generatingSectionId = null,
  isPreviewing = false,
  previewingTarget = null,
}) => {
  const isBusy = isGenerating || isPreviewing;

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
                  Documento Completo PDF
                </Button>
                {renderPreviewButton("Vista previa documento completo PDF", "full", onPreviewPDF)}
              </div>
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
