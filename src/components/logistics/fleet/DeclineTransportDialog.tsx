import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTransportTime, type MyTransportAssignment } from "@/features/logistics/fleet/fleetModel";

// Mirrors transport_driver_assignments_decline_reason_check.
const DECLINE_REASON_MAX_LENGTH = 500;

type DeclineTransportDialogProps = {
  assignment: MyTransportAssignment | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDecline: (reason: string) => Promise<void> | void;
};

/**
 * Asks the driver why they cannot do a transport before recording the refusal.
 * The reason is optional (a driver on the road should not be blocked by a form)
 * but it reaches logistics with the "rechazado" push and in the matrix.
 */
export function DeclineTransportDialog({ assignment, busy, onOpenChange, onDecline }: DeclineTransportDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (assignment) setReason("");
  }, [assignment]);

  const title = assignment?.title?.trim() || assignment?.job_title?.trim() || "Transporte";

  return (
    <Dialog open={Boolean(assignment)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿No puedes hacer este transporte?</DialogTitle>
          <DialogDescription>
            {assignment
              ? `${title} · ${formatTransportTime(assignment.starts_at, assignment.timezone)}–${formatTransportTime(assignment.ends_at, assignment.timezone)}. Logística buscará a otra persona.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          id="decline-transport-form"
          className="space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void onDecline(reason.trim());
          }}
        >
          <Label htmlFor="decline-transport-reason">Motivo (opcional)</Label>
          <Textarea
            id="decline-transport-reason"
            value={reason}
            maxLength={DECLINE_REASON_MAX_LENGTH}
            rows={3}
            placeholder="Estoy de baja, tengo otro servicio, no llego a tiempo…"
            onChange={(event) => setReason(event.target.value)}
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="decline-transport-form" variant="destructive" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            No puedo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
