import { useCallback, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { getHojaDeRutaDialogClassName } from "@/components/hoja-de-ruta/hojaDeRutaDialogClassName";
import { ModernHojaDeRuta } from "@/components/hoja-de-ruta/ModernHojaDeRuta";
import { useHojaLeaveGuard } from "@/features/hoja-de-ruta/model/useHojaLeaveGuard";

type HojaDeRutaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
};

// Single shared embedded shell for the Hoja de Ruta editor dialog, used by
// both the Festival management view and the job-card "Project management"
// view. Owns one scroll region (the editor's own) and dirty-state
// confirmation for every dismissal path: Esc, overlay click, and the
// built-in close button all route through Radix's controlled
// `onOpenChange`, so guarding it here covers all three at once.
export const HojaDeRutaDialog = ({ open, onOpenChange, jobId }: HojaDeRutaDialogProps) => {
  const isMobile = useIsMobile();
  const [isDirty, setIsDirty] = useState(false);
  const confirmLeave = useHojaLeaveGuard(isDirty);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    void confirmLeave().then((confirmed) => {
      if (confirmed) {
        setIsDirty(false);
        onOpenChange(false);
      }
    });
  }, [confirmLeave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={getHojaDeRutaDialogClassName(isMobile)}>
        {jobId && <ModernHojaDeRuta jobId={jobId} embedded onDirtyChange={setIsDirty} />}
      </DialogContent>
    </Dialog>
  );
};

export default HojaDeRutaDialog;
