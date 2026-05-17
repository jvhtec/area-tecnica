import { useCallback, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import {
  archiveDocumentsToFlex,
  backfillFlexDocTecnica,
  createLocalFolders,
  deleteFestivalJob,
} from "../commands";
import type { FestivalArchiveMode, FestivalArchiveResult, FestivalBackfillResult, FestivalJob } from "../types";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

export const useFestivalAdminActions = ({
  fetchDocuments,
  job,
  jobId,
  navigate,
  toast,
}: {
  fetchDocuments: () => Promise<void>;
  job: FestivalJob | null;
  jobId?: string;
  navigate: NavigateFunction;
  toast: ToastFn;
}) => {
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<FestivalArchiveResult | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveMode, setArchiveMode] = useState<FestivalArchiveMode>("by-prefix");
  const [archiveIncludeTemplates, setArchiveIncludeTemplates] = useState(false);
  const [archiveDryRun, setArchiveDryRun] = useState(false);

  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<FestivalBackfillResult | null>(null);
  const [bfSound, setBfSound] = useState(true);
  const [bfLights, setBfLights] = useState(true);
  const [bfVideo, setBfVideo] = useState(true);
  const [bfProduction, setBfProduction] = useState(true);
  const [uuidSound, setUuidSound] = useState("");
  const [uuidLights, setUuidLights] = useState("");
  const [uuidVideo, setUuidVideo] = useState("");
  const [uuidProduction, setUuidProduction] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateLocalFolders = useCallback(async () => {
    if (!job) return;

    setIsCreatingLocalFolders(true);
    try {
      const data = await createLocalFolders(job.id);
      toast({
        title: "Éxito",
        description: data?.message || "Carpetas locales creadas exitosamente",
      });
    } catch (error: any) {
      console.error("Error creating local folders:", error);
      toast({
        title: "Error",
        description: error.message || "Error al crear carpetas locales",
        variant: "destructive",
      });
    } finally {
      setIsCreatingLocalFolders(false);
    }
  }, [job, toast]);

  const handleArchiveToFlex = useCallback(async () => {
    setIsArchiving(true);
    setArchiveError(null);
    setArchiveResult(null);
    try {
      const data = await archiveDocumentsToFlex({
        dryRun: archiveDryRun,
        includeTemplates: archiveIncludeTemplates,
        jobId,
        mode: archiveMode,
      });

      setArchiveResult(data);
      toast({
        title: archiveDryRun ? "Prueba completada" : "Archivo completado",
        description: `${data?.uploaded ?? 0} subidos, ${data?.failed ?? 0} fallidos`,
      });

      if (!archiveDryRun && (data?.uploaded ?? 0) > 0) {
        fetchDocuments();
      }
    } catch (error: any) {
      console.error("Archive error", error);
      setArchiveError(error?.message || "Failed to archive");
      toast({
        title: "Error al archivar",
        description: error?.message || "Error al archivar",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  }, [archiveDryRun, archiveIncludeTemplates, archiveMode, fetchDocuments, jobId, toast]);

  const handleBackfill = useCallback(async () => {
    setIsBackfilling(true);
    setBackfillMessage(null);
    setBackfillResult(null);
    try {
      const departments: string[] = [];
      if (bfSound) departments.push("sound");
      if (bfLights) departments.push("lights");
      if (bfVideo) departments.push("video");
      if (bfProduction) departments.push("production");

      const manual: Array<{ dept: string; element_id: string }> = [];
      if (uuidSound.trim()) manual.push({ dept: "sound", element_id: uuidSound.trim() });
      if (uuidLights.trim()) manual.push({ dept: "lights", element_id: uuidLights.trim() });
      if (uuidVideo.trim()) manual.push({ dept: "video", element_id: uuidVideo.trim() });
      if (uuidProduction.trim()) manual.push({ dept: "production", element_id: uuidProduction.trim() });

      const data = await backfillFlexDocTecnica({ departments, jobId, manual });
      setBackfillResult(data);
      setBackfillMessage(`Inserted ${data?.inserted ?? 0}, already ${data?.already ?? 0}`);
      toast({
        title: "Relleno completado",
        description: `Insertados ${data?.inserted ?? 0}, ya existían ${data?.already ?? 0}`,
      });
    } catch (error: any) {
      console.error("Backfill error", error);
      setBackfillMessage(error?.message || "Backfill failed");
      toast({
        title: "Error al rellenar",
        description: error?.message || "Error al rellenar",
        variant: "destructive",
      });
    } finally {
      setIsBackfilling(false);
    }
  }, [bfLights, bfProduction, bfSound, bfVideo, jobId, toast, uuidLights, uuidProduction, uuidSound, uuidVideo]);

  const handleDeleteJob = useCallback(async () => {
    if (!jobId) return;

    setIsDeleting(true);
    try {
      await deleteFestivalJob(jobId);
      toast({
        title: "Éxito",
        description: "Trabajo eliminado exitosamente",
      });
      navigate("/project-management");
    } catch (error: any) {
      console.error("Error deleting job:", error);
      toast({
        title: "Error",
        description: error.message || "Error al eliminar trabajo",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }, [jobId, navigate, toast]);

  return {
    archiveDryRun,
    archiveError,
    archiveIncludeTemplates,
    archiveMode,
    archiveResult,
    backfillMessage,
    backfillResult,
    bfLights,
    bfProduction,
    bfSound,
    bfVideo,
    handleArchiveToFlex,
    handleBackfill,
    handleCreateLocalFolders,
    handleDeleteJob,
    isArchiveDialogOpen,
    isArchiving,
    isBackfillDialogOpen,
    isBackfilling,
    isCreatingLocalFolders,
    isDeleteDialogOpen,
    isDeleting,
    setArchiveDryRun,
    setArchiveIncludeTemplates,
    setArchiveMode,
    setBfLights,
    setBfProduction,
    setBfSound,
    setBfVideo,
    setIsArchiveDialogOpen,
    setIsBackfillDialogOpen,
    setIsDeleteDialogOpen,
    setUuidLights,
    setUuidProduction,
    setUuidSound,
    setUuidVideo,
    uuidLights,
    uuidProduction,
    uuidSound,
    uuidVideo,
  };
};
