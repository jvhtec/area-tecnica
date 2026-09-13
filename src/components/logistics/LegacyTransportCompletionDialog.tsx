import { useState } from "react";

import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeLegacyTransportRequest, type TransportRequestRecord } from "@/features/logistics/transportRequests";
import { useToast } from "@/hooks/use-toast";

interface Props {
  request: TransportRequestRecord;
  onClose: () => void;
  onCompleted: () => void;
}

export function LegacyTransportCompletionDialog({ request, onClose, onCompleted }: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = async () => {
    if (pending || !reason.trim()) return;
    setPending(true);
    setError(null);
    try {
      await completeLegacyTransportRequest(request.id, reason);
      toast({ title: "Solicitud antigua completada" });
      onCompleted();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo completar la solicitud antigua");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Completar solicitud antigua</AlertDialogTitle>
          <AlertDialogDescription>
            Cerrarás la solicitud de {request.job_title} sin exigir una planificación completa.
            Los eventos existentes se conservarán. Se registrarán tu usuario, la fecha y el motivo.
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="legacy-completion-reason">Motivo del cierre</Label>
          <Textarea
            id="legacy-completion-reason" value={reason} onChange={(event) => setReason(event.target.value)}
            maxLength={1000} required disabled={pending} rows={3}
            placeholder="Indica por qué este transporte antiguo ya está completado"
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
          <Button disabled={pending || !reason.trim()} onClick={() => void complete()}>
            {pending ? "Completando…" : "Confirmar cierre"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
