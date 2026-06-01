import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Table, Printer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HojaDeRutaPdfSectionId } from "@/utils/hoja-de-ruta/pdf";

export interface HojaDeRutaPrintSection {
  id: HojaDeRutaPdfSectionId;
  label: string;
  icon: LucideIcon;
}

interface HojaDeRutaPrintDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  onGeneratePDF: () => void;
  onGenerateDriverCertificatePDF: () => void;
  onGenerateSectionPDF: (sectionId: HojaDeRutaPdfSectionId) => void;
  onGenerateXLS: () => void;
  sections: HojaDeRutaPrintSection[];
  isGenerating?: boolean;
  generatingSectionId?: HojaDeRutaPdfSectionId | null;
}

export const HojaDeRutaPrintDialog: React.FC<HojaDeRutaPrintDialogProps> = ({
  showDialog,
  setShowDialog,
  onGeneratePDF,
  onGenerateDriverCertificatePDF,
  onGenerateSectionPDF,
  onGenerateXLS,
  sections,
  isGenerating = false,
  generatingSectionId = null,
}) => {
  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar Hoja de Ruta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Imprimir a PDF</h3>
            <Button onClick={() => { void onGeneratePDF(); }} disabled={isGenerating}>
              <Printer className="h-4 w-4 mr-2" />
              Documento Completo PDF
            </Button>
            <Button onClick={() => { void onGenerateDriverCertificatePDF(); }} disabled={isGenerating} variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Hoja de Transportes PDF
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Imprimir sección a PDF</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isSectionGenerating = generatingSectionId === section.id;

                return (
                  <Button
                    key={section.id}
                    onClick={() => { void onGenerateSectionPDF(section.id); }}
                    disabled={isGenerating}
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
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Exportar a Excel</h3>
            <Button onClick={() => { void onGenerateXLS(); }} disabled={isGenerating}>
              <Table className="h-4 w-4 mr-2" />
              Hoja de Ruta Excel (Una pestaña por sección)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
