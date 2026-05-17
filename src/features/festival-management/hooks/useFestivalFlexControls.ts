import { useCallback, useMemo, useState } from "react";
import { isValid } from "date-fns";

import type { CreateFoldersOptions } from "@/utils/flex-folders";

import {
  broadcastFlexFoldersCreated,
  createFestivalFlexFolders,
  ensureNoExistingFlexFolders,
  openFestivalFlexElement,
} from "../commands";
import { getFestivalFlexStatus } from "../selectors";
import type { FestivalJob } from "../types";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

export const useFestivalFlexControls = ({
  fetchDocuments,
  fetchJobDetails,
  flexError,
  flexUuid,
  folderExists,
  isFlexLoading,
  job,
  jobId,
  refetchFlexUuid,
  toast,
}: {
  fetchDocuments: () => Promise<void>;
  fetchJobDetails: (options?: { silent?: boolean }) => Promise<void>;
  flexError: string | null;
  flexUuid: string | null;
  folderExists: boolean | null;
  isFlexLoading: boolean;
  job: FestivalJob | null;
  jobId?: string;
  refetchFlexUuid: () => Promise<void>;
  toast: ToastFn;
}) => {
  const [isFlexLogOpen, setIsFlexLogOpen] = useState(false);
  const [isCreatingFlexFolders, setIsCreatingFlexFolders] = useState(false);
  const [isFlexPickerOpen, setIsFlexPickerOpen] = useState(false);
  const [flexPickerOptions, setFlexPickerOptions] = useState<CreateFoldersOptions | undefined>(undefined);
  const [flexPickerMode, setFlexPickerMode] = useState<"create" | "add">("add");

  const flexStatus = useMemo(
    () => getFestivalFlexStatus({ flexError, folderExists, isFlexLoading }),
    [flexError, folderExists, isFlexLoading],
  );

  const handleOpenFlexLogs = useCallback(() => {
    setIsFlexLogOpen(true);
  }, []);

  const handleOpenFlexPicker = useCallback(() => {
    if (!job || isCreatingFlexFolders) {
      return;
    }

    setFlexPickerMode("add");
    setIsFlexPickerOpen(true);
  }, [isCreatingFlexFolders, job]);

  const handleCreateFlexFolders = useCallback(() => {
    if (!job || isCreatingFlexFolders) return;

    setFlexPickerMode("create");
    setIsFlexPickerOpen(true);
  }, [isCreatingFlexFolders, job]);

  const handleFlexPickerConfirm = useCallback(
    async (options?: CreateFoldersOptions) => {
      if (!job || !jobId) {
        return;
      }

      setFlexPickerOptions(options);
      setIsFlexPickerOpen(false);

      if (flexPickerMode === "create") {
        try {
          const hasNoExistingFolders = await ensureNoExistingFlexFolders(jobId);
          if (!hasNoExistingFolders) {
            toast({
              title: "Las carpetas ya existen",
              description: "Ya se han creado carpetas Flex para este trabajo.",
            });
            return;
          }
        } catch (error: any) {
          console.error("Error checking existing folders:", error);
          toast({
            title: "Error al verificar carpetas",
            description: error.message || "Por favor, inténtalo de nuevo en un momento.",
            variant: "destructive",
          });
          return;
        }
      }

      if (!job.start_time || !job.end_time) {
        toast({
          title: "Fechas del trabajo faltantes",
          description: `Actualiza las fechas del trabajo antes de ${flexPickerMode === "create" ? "crear" : "añadir"} carpetas Flex.`,
          variant: "destructive",
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);

      if (!isValid(startDate) || !isValid(endDate)) {
        toast({
          title: "Fechas del trabajo inválidas",
          description: "Por favor, verifica las fechas del trabajo antes de crear carpetas Flex.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsCreatingFlexFolders(true);

        const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");
        const formattedStartDate = startDate.toISOString().split(".")[0] + ".000Z";
        const formattedEndDate = endDate.toISOString().split(".")[0] + ".000Z";

        toast({
          title: flexPickerMode === "create" ? "Creando carpetas Flex…" : "Añadiendo carpetas Flex…",
          description:
            flexPickerMode === "create"
              ? "Esto puede tardar unos segundos."
              : "Las carpetas seleccionadas se crearán en Flex.",
        });

        await createFestivalFlexFolders({
          documentNumber,
          endDate: formattedEndDate,
          job,
          options,
          startDate: formattedStartDate,
        });

        void broadcastFlexFoldersCreated(jobId).catch((pushError) => {
          console.error("Error sending push notification:", pushError);
        });

        toast({
          title: flexPickerMode === "create" ? "Carpetas Flex listas" : "Carpetas Flex actualizadas",
          description:
            flexPickerMode === "create"
              ? "Las carpetas se han creado exitosamente."
              : "Las carpetas seleccionadas se han añadido exitosamente.",
        });

        await Promise.all([refetchFlexUuid(), fetchJobDetails({ silent: true }), fetchDocuments()]);
      } catch (error: any) {
        console.error("Error adding Flex folders:", error);
        toast({
          title: "Error al actualizar carpetas Flex",
          description: error.message || "Por favor, inténtalo de nuevo en un momento.",
          variant: "destructive",
        });
      } finally {
        setIsCreatingFlexFolders(false);
      }
    },
    [fetchDocuments, fetchJobDetails, flexPickerMode, job, jobId, refetchFlexUuid, toast],
  );

  const handleFlexClick = useCallback(async () => {
    if (isFlexLoading) {
      toast({ title: "Cargando", description: "Por favor espera mientras cargamos la carpeta Flex..." });
      return;
    }

    if (flexUuid) {
      await openFestivalFlexElement({
        elementId: flexUuid,
        onError: (error) => {
          toast({ title: "Error", description: error.message || "Error al abrir Flex", variant: "destructive" });
        },
        onWarning: (message) => {
          toast({ title: "Advertencia", description: message });
        },
      });
    } else if (flexError) {
      toast({ title: "Error", description: flexError, variant: "destructive" });
    } else {
      toast({ title: "Info", description: "Carpeta Flex no disponible para este festival" });
    }
  }, [flexError, flexUuid, isFlexLoading, toast]);

  return {
    flexPickerOptions,
    flexStatus,
    handleCreateFlexFolders,
    handleFlexClick,
    handleFlexPickerConfirm,
    handleOpenFlexLogs,
    handleOpenFlexPicker,
    isCreatingFlexFolders,
    isFlexLogOpen,
    isFlexPickerOpen,
    setIsFlexLogOpen,
    setIsFlexPickerOpen,
  };
};
