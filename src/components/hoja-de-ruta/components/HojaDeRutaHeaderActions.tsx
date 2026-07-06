import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Eye, Loader2, MoreHorizontal, Save } from "lucide-react";
import type { HojaDeRutaPrintPreviewTarget } from "../HojaDeRutaPrintDialog";

type HojaDeRutaHeaderActionsProps = {
  isMobile: boolean;
  selectedJobId?: string | null;
  isInitialized: boolean;
  isSaving: boolean;
  isGenerating: boolean;
  isPreviewing: boolean;
  previewingTarget: HojaDeRutaPrintPreviewTarget;
  onSave: () => void;
  onPreviewPDF: () => void;
  onExport: () => void;
};

// Mobile keeps Guardar in a sticky bottom bar (thumb-reachable) — the header only
// needs a compact overflow menu for the secondary actions. Desktop keeps all three
// buttons inline. A Popover (not DropdownMenu) is used for the overflow menu because
// the shared DropdownMenuContent forces `position: fixed`, which breaks Radix's
// Popper alignment inside a fullscreen mobile dialog.
export const HojaDeRutaHeaderActions = ({
  isMobile,
  selectedJobId,
  isInitialized,
  isSaving,
  isGenerating,
  isPreviewing,
  previewingTarget,
  onSave,
  onPreviewPDF,
  onExport,
}: HojaDeRutaHeaderActionsProps) => {
  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Más acciones" className="h-11 w-11 shrink-0">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <PopoverClose asChild>
            <button
              type="button"
              onClick={onPreviewPDF}
              disabled={!selectedJobId || !isInitialized || isSaving || isGenerating || isPreviewing}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <Eye className="w-4 h-4 mr-2" />
              Vista previa
            </button>
          </PopoverClose>
          <PopoverClose asChild>
            <button
              type="button"
              onClick={onExport}
              disabled={!selectedJobId}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <Button
        onClick={onSave}
        disabled={!selectedJobId || !isInitialized || isSaving}
        variant="outline"
        size="sm"
        aria-label="Guardar hoja de ruta"
        className="h-11 min-w-[44px] border-2 border-green-500 text-green-600 hover:bg-green-50"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Guardar</span>
          </>
        )}
      </Button>

      <Button
        onClick={onPreviewPDF}
        disabled={!selectedJobId || !isInitialized || isSaving || isGenerating || isPreviewing}
        variant="outline"
        size="sm"
        aria-label="Vista previa PDF"
        className="h-11 min-w-[44px] border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
      >
        {isPreviewing && previewingTarget === "full" ? (
          <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
        ) : (
          <Eye className="w-4 h-4 sm:mr-2" />
        )}
        <span className="hidden sm:inline">Vista previa</span>
      </Button>

      <Button
        onClick={onExport}
        disabled={!selectedJobId}
        aria-label="Exportar"
        className="h-11 min-w-[44px] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
      >
        <Download className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
    </>
  );
};

export default HojaDeRutaHeaderActions;
