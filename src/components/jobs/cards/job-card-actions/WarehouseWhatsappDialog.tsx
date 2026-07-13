import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import type { WarehouseWhatsappState } from "@/components/jobs/cards/job-card-actions/useWarehouseWhatsapp";

type WarehouseWhatsappDialogProps = {
  state: WarehouseWhatsappState;
};

export const WarehouseWhatsappDialog = ({ state }: WarehouseWhatsappDialogProps) => {
  if (!state.waAlmacenOpen) return null;

  return (
    <ResponsiveDialog open={state.waAlmacenOpen} onOpenChange={state.setWaAlmacenOpen}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Enviar a Almacén sonido</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Este mensaje se enviará al grupo de WhatsApp "Almacén sonido" desde tu endpoint WAHA.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
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
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => state.setWaAlmacenOpen(false)} disabled={state.isSendingWa}>Cancelar</Button>
          <Button onClick={state.handleWarehouseSend} disabled={state.isSendingWa}>
            {state.isSendingWa ? "Enviando…" : "Enviar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
