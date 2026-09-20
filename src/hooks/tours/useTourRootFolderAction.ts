import { useQueryClient } from "@tanstack/react-query";
import { useState, type MouseEvent } from "react";

import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { createTourRootFolders } from "@/utils/tourFolders";

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
      toast({
        title: isSync ? "Estructura Flex sincronizada" : "Carpetas creadas",
        description: isSync
          ? "La estructura raíz de la gira se ha reconciliado y completado."
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
