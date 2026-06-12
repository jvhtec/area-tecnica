import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Timesheet } from "@/types/timesheet";

export const TimesheetRejectDialog: React.FC<{
  timesheet: Timesheet | null;
  rejectionNotes: string;
  resetHours: boolean;
  sendEmail: boolean;
  onRejectionNotesChange: (next: string) => void;
  onResetHoursChange: (next: boolean) => void;
  onSendEmailChange: (next: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ timesheet, rejectionNotes, resetHours, sendEmail, onRejectionNotesChange, onResetHoursChange, onSendEmailChange, onClose, onConfirm }) => (
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
      <div className="space-y-3 pt-2">
        <div className="flex items-start gap-2">
          <Checkbox
            id="reject-reset-hours"
            checked={resetHours}
            onCheckedChange={(checked) => onResetHoursChange(checked === true)}
          />
          <Label htmlFor="reject-reset-hours" className="text-sm font-normal leading-snug cursor-pointer">
            Poner las horas a cero (el técnico deberá rellenar el parte desde el principio)
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="reject-send-email"
            checked={sendEmail}
            onCheckedChange={(checked) => onSendEmailChange(checked === true)}
          />
          <Label htmlFor="reject-send-email" className="text-sm font-normal leading-snug cursor-pointer">
            Enviar email al técnico indicando que el parte fue rechazado por no coincidir con nuestros datos registrados
          </Label>
        </div>
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
