import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HojaStatus } from "@/features/hoja-de-ruta/model/HojaDocument";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

type NextStatus = Exclude<HojaStatus, "draft">;

const NEXT_STATUS: Record<HojaStatus, { label: string; next: NextStatus } | null> = {
  draft: { label: "Enviar a revisión", next: "review" },
  review: { label: "Aprobar", next: "approved" },
  approved: { label: "Finalizar", next: "final" },
  final: null,
};

type HojaStatusControlsProps = {
  status: HojaStatus;
  disabled: boolean;
  isChangingStatus: boolean;
  onTransition: (next: NextStatus) => void;
  onReopen: (reason: string) => Promise<boolean>;
  className?: string;
};

/**
 * Workflow actions: advance draft → review → approved → final, and (admin or
 * management only) reopen an approved or final Hoja with a logged reason.
 * Approval must come from someone other than the person who requested review;
 * the server enforces it and its message is shown if it happens.
 */
export const HojaStatusControls = ({
  status,
  disabled,
  isChangingStatus,
  onTransition,
  onReopen,
  className,
}: HojaStatusControlsProps) => {
  const { userRole } = useOptimizedAuth();
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);

  const nextAction = NEXT_STATUS[status];
  const canReopen =
    (status === "approved" || status === "final")
    && (userRole === "admin" || userRole === "management");
  const trimmedReason = reason.trim();

  const submitReopen = async () => {
    if (!trimmedReason) return;
    setIsReopening(true);
    try {
      const reopened = await onReopen(trimmedReason);
      if (reopened) {
        setReopenOpen(false);
        setReason("");
      }
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className={className}>
      {nextAction && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={disabled || isChangingStatus}
          onClick={() => onTransition(nextAction.next)}
        >
          {isChangingStatus ? "Actualizando…" : nextAction.label}
        </Button>
      )}
      {canReopen && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={disabled || isChangingStatus}
          onClick={() => setReopenOpen(true)}
        >
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
          Reabrir
        </Button>
      )}

      <Dialog
        open={reopenOpen}
        onOpenChange={(open) => {
          if (!isReopening) setReopenOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir Hoja de Ruta</DialogTitle>
            <DialogDescription>
              La Hoja de Ruta vuelve a borrador y tendrá que revisarse y aprobarse de nuevo.
              El motivo queda registrado en la actividad del trabajo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hoja-reopen-reason">Motivo</Label>
            <Textarea
              id="hoja-reopen-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Por ejemplo: cambio de conductor o de horario"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isReopening}
              onClick={() => setReopenOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!trimmedReason || isReopening}
              onClick={() => { void submitReopen(); }}
            >
              {isReopening ? "Reabriendo…" : "Reabrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HojaStatusControls;
