import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

type MobileSaveBarProps = {
  onSave: () => void;
  disabled: boolean;
  isSaving: boolean;
};

// Sticky, thumb-reachable Guardar bar for mobile — keeps the primary action
// accessible without competing with the header's title/overflow menu for space.
export const MobileSaveBar = ({ onSave, disabled, isSaving }: MobileSaveBarProps) => (
  <div className="fixed inset-x-0 bottom-0 z-50 shrink-0 border-t bg-background/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
    <Button
      onClick={onSave}
      disabled={disabled}
      variant="outline"
      className="w-full h-11 border-2 border-green-500 text-green-600 hover:bg-green-50"
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
