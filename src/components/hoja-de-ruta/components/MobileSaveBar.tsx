import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

type MobileSaveBarProps = {
  onSave: () => void;
  disabled: boolean;
  isSaving: boolean;
  // When true, this renders inside a Dialog's own flex column (see
  // HojaDeRutaDialog) instead of the standalone page: it must stick to the
  // bottom of that flex column rather than escape it with fixed, which would
  // otherwise float over the dialog's edges and its own chrome on mobile.
  embedded?: boolean;
};

// Sticky, thumb-reachable Guardar bar for mobile — keeps the primary action
// accessible without competing with the header's title/overflow menu for space.
export const MobileSaveBar = ({ onSave, disabled, isSaving, embedded = false }: MobileSaveBarProps) => (
  <div
    className={cn(
      "z-50 shrink-0 border-t bg-background/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      embedded ? "sticky bottom-0" : "fixed inset-x-0 bottom-0",
    )}
  >
    <Button
      onClick={onSave}
      disabled={disabled}
      variant="outline"
      className="w-full h-11 border-2 border-success text-success hover:bg-success/10"
    >
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Guardando...
        </>
      ) : (
        <>
          <Save className="w-4 h-4 mr-2" />
          Guardar
        </>
      )}
    </Button>
  </div>
);

export default MobileSaveBar;
