import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Timesheet } from "@/types/timesheet";

export const TimesheetRejectDialog: React.FC<{
  timesheet: Timesheet | null;
  rejectionNotes: string;
  onRejectionNotesChange: (next: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ timesheet, rejectionNotes, onRejectionNotesChange, onClose, onConfirm }) => (
  <AlertDialog
    open={!!timesheet}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Rechazar parte de trabajo</AlertDialogTitle>
        <AlertDialogDescription>
          Proporcione una nota breve para que el técnico sepa qué debe corregirse antes de volver a enviar.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-2">
        <Label htmlFor="rejection-notes" className="text-sm font-medium">
          Notas de rechazo
        </Label>
        <Textarea
          id="rejection-notes"
          placeholder="Por favor ajuste la hora de finalización..."
          value={rejectionNotes}
          onChange={(event) => onRejectionNotesChange(event.target.value)}
          minLength={0}
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} disabled={!timesheet}>
          Rechazar parte
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

