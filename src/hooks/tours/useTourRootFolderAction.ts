import { useQueryClient } from "@tanstack/react-query";
import { useState, type MouseEvent } from "react";

import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { createTourRootFolders, createTourRootFoldersManual } from "@/utils/tourFolders";

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

    if (hasTourRootFolders && !needsEstructuraRoot) {
      toast({
        title: "Las carpetas raíz ya existen",
        description: "Las carpetas raíz de esta gira ya están creadas.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingTourRootFolders(true);
    try {
      const result = needsEstructuraRoot
        ? await createTourRootFolders(tour.id)
        : await createTourRootFoldersManual(tour.id);
      if (!result.success) {
        throw new Error(result.error || (needsEstructuraRoot
          ? "No se pudo crear la carpeta Estructura de la gira"
          : "No se pudieron crear las carpetas raíz de la gira"));
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") });
      await queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tour.id) });
      toast({
        title: needsEstructuraRoot ? "Carpeta Estructura creada" : "Carpetas creadas",
        description: needsEstructuraRoot
          ? "La carpeta raíz Estructura de la gira ya está disponible."
          : "Las carpetas raíz de la gira se han creado correctamente.",
      });
    } catch (error) {
      toast({
        title: needsEstructuraRoot
          ? "Error al crear la carpeta Estructura"
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
