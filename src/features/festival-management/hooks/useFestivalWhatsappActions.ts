import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/react-query";
import { supabase } from "@/integrations/supabase/client";

import {
  clearWhatsappGroupRequest,
  createWhatsappGroup,
  sendWarehouseMessage,
} from "../commands";
import { normalizeFestivalWhatsappStage } from "../selectors";
import type { FestivalWhatsappDepartment } from "../types";

type ToastFn = (props: { description?: string; title: string; variant?: "default" | "destructive" }) => void;

export const useFestivalWhatsappActions = ({
  isManagementUser,
  jobId,
  jobTitle,
  maxStages,
  toast,
}: {
  isManagementUser: boolean;
  jobId?: string;
  jobTitle: string;
  maxStages: number;
  toast: ToastFn;
}) => {
  const [isWhatsappDialogOpen, setIsWhatsappDialogOpen] = useState(false);
  const [waDepartment, setWaDepartment] = useState<FestivalWhatsappDepartment>("sound");
  const [waStageNumber, setWaStageNumber] = useState(0);
  const [isAlmacenDialogOpen, setIsAlmacenDialogOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [isSendingWa, setIsSendingWa] = useState(false);

  const { data: waGroup, refetch: refetchWaGroup } = useQuery({
    queryKey: queryKeys.scope("job-whatsapp-group", jobId, waDepartment, waStageNumber),
    enabled: !!jobId && !!waDepartment && isManagementUser,
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from("job_whatsapp_groups")
        .select("id, wa_group_id")
        .eq("job_id", jobId)
        .eq("department", waDepartment)
        .eq("stage_number", waStageNumber)
        .maybeSingle();

      if (error) return null;
      return data;
    },
  });

  const { data: waRequest, refetch: refetchWaRequest } = useQuery({
    queryKey: queryKeys.scope("job-whatsapp-group-request", jobId, waDepartment, waStageNumber),
    enabled: !!jobId && !!waDepartment && isManagementUser,
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from("job_whatsapp_group_requests")
        .select("id, created_at")
        .eq("job_id", jobId)
        .eq("department", waDepartment)
        .eq("stage_number", waStageNumber)
        .maybeSingle();

      if (error) return null;
      return data;
    },
  });

  useEffect(() => {
    setWaStageNumber((currentStage) =>
      normalizeFestivalWhatsappStage({
        currentStage,
        department: waDepartment,
        maxStages,
      }),
    );
  }, [maxStages, waDepartment]);

  const refreshWhatsappState = useCallback(
    () => Promise.all([refetchWaGroup(), refetchWaRequest()]),
    [refetchWaGroup, refetchWaRequest],
  );

  const handleCreateWhatsappGroup = useCallback(async () => {
    try {
      setIsSendingWa(true);
      await createWhatsappGroup({ department: waDepartment, jobId, stageNumber: waStageNumber });
      toast({
        title: "Éxito",
        description: "Grupo de WhatsApp creado exitosamente",
      });
      setIsWhatsappDialogOpen(false);
      await refreshWhatsappState();
    } catch (error: any) {
      console.error("Error creating WhatsApp group:", error);
      toast({
        title: "Error",
        description: error.message || "Error al crear grupo de WhatsApp",
        variant: "destructive",
      });
      await refreshWhatsappState();
    } finally {
      setIsSendingWa(false);
    }
  }, [jobId, refreshWhatsappState, toast, waDepartment, waStageNumber]);

  const handleRetryWhatsappGroup = useCallback(async () => {
    if (!jobId) {
      toast({ title: "Error", description: "No se encontró el trabajo.", variant: "destructive" });
      return;
    }

    setIsSendingWa(true);
    try {
      const result = await clearWhatsappGroupRequest({
        department: waDepartment,
        jobId,
        stageNumber: waStageNumber,
      });

      if (!result.success) {
        toast({
          title: "Aviso",
          description: result.error || result.message,
          variant: result.can_retry ? "default" : "destructive",
        });
        await refreshWhatsappState();
        setIsSendingWa(false);
        return;
      }

      toast({
        title: "Solicitud limpiada",
        description: "Intentando crear el grupo de nuevo...",
      });

      await refreshWhatsappState();
      await handleCreateWhatsappGroup();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Error al reintentar: ${error.message}`,
        variant: "destructive",
      });
      await refreshWhatsappState();
      setIsSendingWa(false);
    }
  }, [handleCreateWhatsappGroup, jobId, refreshWhatsappState, toast, waDepartment, waStageNumber]);

  const handleSendToAlmacen = useCallback(async () => {
    try {
      setIsSendingWa(true);
      const defaultMsg = `He hecho cambios en el PS del ${jobTitle || "trabajo"} por favor echad un vistazo`;
      const trimmed = (waMessage || "").trim();
      const finalMsg = trimmed || defaultMsg;
      const isDefault = finalMsg.trim().toLowerCase() === defaultMsg.trim().toLowerCase();

      await sendWarehouseMessage({ highlight: isDefault, jobId, message: finalMsg });
      toast({ title: "Enviado", description: "Mensaje enviado a Almacén sonido." });
      setIsAlmacenDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || String(error), variant: "destructive" });
    } finally {
      setIsSendingWa(false);
    }
  }, [jobId, jobTitle, toast, waMessage]);

  return {
    handleCreateWhatsappGroup,
    handleRetryWhatsappGroup,
    handleSendToAlmacen,
    isAlmacenDialogOpen,
    isSendingWa,
    isWhatsappDialogOpen,
    refetchWaGroup,
    refetchWaRequest,
    setIsAlmacenDialogOpen,
    setIsWhatsappDialogOpen,
    setWaDepartment,
    setWaMessage,
    setWaStageNumber,
    waDepartment,
    waGroup,
    waMessage,
    waRequest,
    waStageNumber,
  };
};
