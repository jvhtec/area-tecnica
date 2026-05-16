import React from "react";

import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";

export type WarehouseWhatsappState = ReturnType<typeof useWarehouseWhatsapp>;

export const useWarehouseWhatsapp = (job: any) => {
  const { toast } = useToast();
  const [waAlmacenOpen, setWaAlmacenOpen] = React.useState(false);
  const [waMessage, setWaMessage] = React.useState<string>("");
  const [isSendingWa, setIsSendingWa] = React.useState(false);

  const openWarehouseWhatsappDialog = React.useCallback(() => {
    const title = job?.title || "trabajo";
    setWaMessage(`He hecho cambios en el PS del ${title} por favor echad un vistazo`);
    setWaAlmacenOpen(true);
  }, [job?.title]);

  const handleWarehouseSend = React.useCallback(async () => {
    try {
      setIsSendingWa(true);
      const defaultMsg = `He hecho cambios en el PS del ${job?.title || "trabajo"} por favor echad un vistazo`;
      const trimmed = (waMessage || "").trim();
      const finalMsg = trimmed || defaultMsg;
      const isDefault = finalMsg.trim().toLowerCase() === defaultMsg.trim().toLowerCase();
      const { error } = await dataLayerClient.functions.invoke("send-warehouse-message", {
        body: { message: finalMsg, job_id: job?.id, highlight: isDefault },
      });
      if (error) {
        toast({ title: "Error al enviar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Enviado", description: "Mensaje enviado a Almacén sonido." });
        setWaAlmacenOpen(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSendingWa(false);
    }
  }, [job?.id, job?.title, toast, waMessage]);

  return {
    handleWarehouseSend,
    isSendingWa,
    openWarehouseWhatsappDialog,
    setWaAlmacenOpen,
    setWaMessage,
    waAlmacenOpen,
    waMessage,
  };
};
