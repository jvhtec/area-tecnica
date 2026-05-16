import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { WarehouseWhatsappState } from "@/components/jobs/cards/job-card-actions/useWarehouseWhatsapp";

type WarehouseWhatsappDialogProps = {
  state: WarehouseWhatsappState;
};

export const WarehouseWhatsappDialog = ({ state }: WarehouseWhatsappDialogProps) => {
  if (!state.waAlmacenOpen) return null;

  return (
    <Dialog open={state.waAlmacenOpen} onOpenChange={state.setWaAlmacenOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar a Almacén sonido</DialogTitle>
          <DialogDescription>Este mensaje se enviará al grupo de WhatsApp "Almacén sonido" desde tu endpoint WAHA.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="wa-almacen-message">Mensaje</Label>
          <Textarea
            id="wa-almacen-message"
            value={state.waMessage}
            onChange={(e) => state.setWaMessage(e.target.value)}
            placeholder="Escribe tu mensaje…"
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => state.setWaAlmacenOpen(false)} disabled={state.isSendingWa}>Cancelar</Button>
          <Button onClick={state.handleWarehouseSend} disabled={state.isSendingWa}>
            {state.isSendingWa ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
