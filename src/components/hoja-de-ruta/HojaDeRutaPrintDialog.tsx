import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, Printer } from "lucide-react";

interface HojaDeRutaPrintDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  onGeneratePDF: () => void;
  onGenerateXLS: () => void;
  isGenerating?: boolean;
}

export const HojaDeRutaPrintDialog: React.FC<HojaDeRutaPrintDialogProps> = ({
  showDialog,
  setShowDialog,
  onGeneratePDF,
  onGenerateXLS,
  isGenerating = false,
}) => {
  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
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
