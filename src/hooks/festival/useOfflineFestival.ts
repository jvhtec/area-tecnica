import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  countPendingChanges,
  deleteFestivalSnapshot,
  discardPendingChanges,
  downloadFestivalSnapshotWithFiles,
  getFestivalSnapshot,
  isBrowserOnline,
  subscribeOfflineFestivalChanged,
  syncFestivalPendingChanges,
  type OfflineSyncResult,
} from "@/lib/offline";

export interface OfflineSnapshotMeta {
  downloadedAt: string;
  jobTitle: string;
  artistCount: number;
}

/**
 * State + actions for the offline copy of a festival: download/refresh the
 * dataset, track queued offline edits and push them manually to the server.
 */
export const useOfflineFestival = (jobId?: string) => {
  const [isOnline, setIsOnline] = useState(isBrowserOnline());
  const [snapshotMeta, setSnapshotMeta] = useState<OfflineSnapshotMeta | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<OfflineSyncResult | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) {
      setSnapshotMeta(null);
      setPendingCount(0);
      return;
    }
    const [snapshot, count] = await Promise.all([getFestivalSnapshot(jobId), countPendingChanges(jobId)]);
    setSnapshotMeta(
      snapshot
        ? {
            downloadedAt: snapshot.downloadedAt,
            jobTitle: snapshot.jobTitle,
            artistCount: snapshot.data.artists.length,
          }
        : null,
    );
    setPendingCount(count);
  }, [jobId]);

  useEffect(() => {
    refresh().catch((error) => console.error("Error leyendo estado offline del festival:", error));

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = jobId
      ? subscribeOfflineFestivalChanged(jobId, () => {
          refresh().catch((error) => console.error("Error refrescando estado offline:", error));
        })
      : () => {};

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, [jobId, refresh]);

  const download = useCallback(async () => {
    if (!jobId) return;
    if (!isBrowserOnline()) {
      toast.error("Sin conexión", { description: "Conéctate a internet para descargar los datos del festival." });
      return;
    }
    // A refresh overwrites the local snapshot with server data, which would
    // hide queued edits while they remain pending sync.
    if ((await countPendingChanges(jobId)) > 0) {
      toast.error("Cambios pendientes", {
        description: "Sincroniza o descarta los cambios pendientes antes de actualizar la copia offline.",
      });
      return;
    }
    setIsDownloading(true);
    try {
      const { snapshot, files } = await downloadFestivalSnapshotWithFiles(jobId);
      const fileSummary =
        files.total > 0
          ? ` y ${files.downloaded} de ${files.total} archivos (riders, planos, documentos)`
          : "";
      if (files.failed > 0) {
        toast.warning("Datos offline descargados con avisos", {
          description: `${snapshot.data.artists.length} artistas${fileSummary}. ${files.failed} archivo${files.failed === 1 ? "" : "s"} no se pudieron descargar.`,
          duration: 8000,
        });
      } else {
        toast.success("Datos offline descargados", {
          description: `${snapshot.data.artists.length} artistas${fileSummary} disponibles sin conexión.`,
        });
      }
    } catch (error) {
      console.error("Error descargando datos offline:", error);
      toast.error("Error", { description: "No se pudieron descargar los datos para uso offline." });
    } finally {
      setIsDownloading(false);
    }
  }, [jobId]);

  const sync = useCallback(
    async (options?: { force?: boolean }) => {
      if (!jobId) return null;
      if (!isBrowserOnline()) {
        toast.error("Sin conexión", { description: "Conéctate a internet para sincronizar los cambios." });
        return null;
      }
      setIsSyncing(true);
      try {
        const result = await syncFestivalPendingChanges(jobId, { force: options?.force });
        setLastSyncResult(result);

        if (result.conflicts.length === 0 && result.failed.length === 0) {
          toast.success("Sincronización completada", {
            description:
              result.applied > 0
                ? `${result.applied} cambio${result.applied === 1 ? "" : "s"} enviado${result.applied === 1 ? "" : "s"} al servidor.`
                : "No había cambios pendientes.",
          });
        } else {
          // Report conflicts and failures together so neither gets hidden
          const parts = [`${result.applied} aplicados`];
          if (result.conflicts.length > 0) {
            const names = result.conflicts
              .map((conflict) => conflict.label)
              .filter(Boolean)
              .slice(0, 3)
              .join(", ");
            parts.push(`${result.conflicts.length} en conflicto${names ? ` (${names})` : ""}`);
          }
          if (result.failed.length > 0) {
            parts.push(
              `${result.failed.length} con error${result.failed[0]?.message ? ` (${result.failed[0].message})` : ""}`,
            );
          }
          const hint =
            result.conflicts.length > 0
              ? ' Usa "Forzar sincronización" para sobrescribir o descarta los cambios.'
              : "";
          const showToast = result.failed.length > 0 ? toast.error : toast.warning;
          showToast("Sincronización incompleta", {
            description: `${parts.join(", ")}.${hint}`,
            duration: 8000,
          });
        }
        return result;
      } catch (error) {
        console.error("Error sincronizando cambios offline:", error);
        toast.error("Error", { description: "No se pudieron sincronizar los cambios offline." });
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [jobId],
  );

  const removeOfflineCopy = useCallback(async () => {
    if (!jobId) return;
    await deleteFestivalSnapshot(jobId);
    setLastSyncResult(null);
    toast.success("Copia offline eliminada");
  }, [jobId]);

  const discardChanges = useCallback(async () => {
    if (!jobId) return;
    if (!isBrowserOnline()) {
      toast.error("Sin conexión", {
        description: "Conéctate a internet para descartar los cambios y restaurar la copia offline.",
      });
      return;
    }
    // Restore the snapshot from the server BEFORE dropping the queue: if the
    // download fails the queue stays intact, so the local copy never shows
    // edits that can no longer be synchronized or discarded cleanly.
    try {
      const { files } = await downloadFestivalSnapshotWithFiles(jobId);
      if (files.failed > 0) {
        toast.warning("Copia restaurada con avisos", {
          description: `${files.failed} archivo${files.failed === 1 ? "" : "s"} no se pudieron restaurar.`,
          duration: 8000,
        });
      }
    } catch (error) {
      console.error("No se pudo restaurar la copia offline antes de descartar cambios:", error);
      toast.error("Error", {
        description: "No se pudo restaurar la copia offline. Los cambios pendientes se mantienen.",
      });
      return;
    }
    const discarded = await discardPendingChanges(jobId);
    setLastSyncResult(null);
    toast.success("Cambios descartados", {
      description: `${discarded} cambio${discarded === 1 ? "" : "s"} pendiente${discarded === 1 ? "" : "s"} eliminado${discarded === 1 ? "" : "s"}.`,
    });
  }, [jobId]);

  return {
    isOnline,
    hasSnapshot: snapshotMeta !== null,
    snapshotMeta,
    pendingCount,
    hasConflicts: (lastSyncResult?.conflicts.length ?? 0) > 0,
    lastSyncResult,
    isDownloading,
    isSyncing,
    download,
    sync,
    removeOfflineCopy,
    discardChanges,
  };
};
