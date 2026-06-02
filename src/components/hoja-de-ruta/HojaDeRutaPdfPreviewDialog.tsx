import React from "react";
import { Download, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type HojaDeRutaPdfPreview = {
  url: string;
  filename: string;
  title: string;
};

type HojaDeRutaPdfPreviewDialogProps = {
  open: boolean;
  preview: HojaDeRutaPdfPreview | null;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
  onOpenInNewTab: () => void;
};

export const HojaDeRutaPdfPreviewDialog: React.FC<HojaDeRutaPdfPreviewDialogProps> = ({
  open,
  preview,
  onOpenChange,
  onDownload,
  onOpenInNewTab,
}) => {
  const iframeSrc = preview ? `${preview.url}#toolbar=1&navpanes=0` : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,900px)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base md:text-lg">
                {preview?.title ?? "Vista previa PDF"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Vista previa del PDF generado sin subirlo a documentos.
              </DialogDescription>
              {preview && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {preview.filename}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenInNewTab}
                disabled={!preview}
                aria-label="Abrir PDF en una pestaña"
              >
                <ExternalLink className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Abrir</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onDownload}
                disabled={!preview}
                aria-label="Descargar PDF"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Descargar</span>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted">
          {iframeSrc && (
            <iframe
              src={iframeSrc}
              title={preview?.title ?? "Vista previa PDF"}
              className="h-full w-full border-0 bg-background"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
