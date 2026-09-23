import { useQueryClient } from "@tanstack/react-query";
import { useState, type MouseEvent } from "react";

import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { createTourRootFolders } from "@/utils/tourFolders";

/** Node counts returned by the server provisioning engine for one run. */
type TourProvisioningOutcome = {
  created?: number;
  adopted?: number;
  skipped?: number;
};

/**
 * Reads the engine outcome out of the Edge function envelope
 * (`{ success, status, data: { created, adopted, skipped } }`).
 * A run that found nothing to do — a completed scope, or a legacy tour whose
 * adopted roots keep their canonical children suppressed — returns no envelope
 * data at all, so an absent outcome must read as "nothing created".
 */
const provisioningOutcome = (data: unknown): TourProvisioningOutcome | null => {
  if (!data || typeof data !== "object") return null;
  const outcome = (data as { data?: unknown }).data;
  if (!outcome || typeof outcome !== "object") return null;
  return outcome as TourProvisioningOutcome;
};

type TourRootFolderState = {
  id: string;
  flex_folders_created?: boolean | null;
  flex_main_folder_id?: string | null;
  flex_estructura_folder_id?: string | null;
};

export const useTourRootFolderAction = (tour: TourRootFolderState) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingTourRootFolders, setIsCreatingTourRootFolders] = useState(false);
  const hasTourRootFolders = Boolean(tour.flex_folders_created && tour.flex_main_folder_id);
  const needsEstructuraRoot = hasTourRootFolders && !tour.flex_estructura_folder_id;

  const handleCreateTourRootFolders = async (event: MouseEvent) => {
    event.stopPropagation();
    if (isCreatingTourRootFolders) return;

    const isSync = hasTourRootFolders;
    setIsCreatingTourRootFolders(true);
    try {
      const result = isSync
        ? await createTourRootFolders(tour.id, { reconcile: true })
        : await createTourRootFolders(tour.id);
      if (!result.success) {
        throw new Error(result.error || (isSync
          ? "No se pudo sincronizar la estructura Flex de la gira"
          : "No se pudieron crear las carpetas raíz de la gira"));
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tour.id) });
      const created = provisioningOutcome(result.data)?.created ?? 0;
      toast({
        title: isSync ? "Estructura Flex sincronizada" : "Carpetas creadas",
        description: isSync
          ? (created > 0
            ? `Se han añadido ${created} ${created === 1 ? "carpeta nueva" : "carpetas nuevas"} a la estructura de la gira.`
            : "La estructura de la gira ya estaba al día. No se ha añadido ninguna carpeta nueva.")
          : "Las carpetas raíz de la gira se han creado correctamente.",
      });
    } catch (error) {
      toast({
        title: isSync
          ? "Error al sincronizar la estructura Flex"
          : "Error al crear las carpetas raíz de la gira",
        description: error instanceof Error ? error.message : "No se pudieron crear las carpetas de la gira.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingTourRootFolders(false);
    }
  };

  return {
    handleCreateTourRootFolders,
    hasTourRootFolders,
    isCreatingTourRootFolders,
    needsEstructuraRoot,
  };
};
