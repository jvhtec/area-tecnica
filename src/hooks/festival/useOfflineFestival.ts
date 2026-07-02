import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  countPendingChanges,
  deleteFestivalSnapshot,
  discardPendingChanges,
  downloadFestivalSnapshot,
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
    setIsDownloading(true);
    try {
      const snapshot = await downloadFestivalSnapshot(jobId);
      toast.success("Datos offline descargados", {
        description: `${snapshot.data.artists.length} artistas disponibles sin conexión.`,
      });
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
        } else if (result.conflicts.length > 0) {
          const names = result.conflicts
            .map((conflict) => conflict.label)
            .filter(Boolean)
            .slice(0, 3)
            .join(", ");
          toast.warning("Sincronización con conflictos", {
            description: `${result.applied} aplicados, ${result.conflicts.length} en conflicto${
              names ? ` (${names})` : ""
            }. Usa "Forzar sincronización" para sobrescribir o descarta los cambios.`,
            duration: 8000,
          });
        } else {
          toast.error("Error de sincronización", {
            description: `${result.failed.length} cambio${result.failed.length === 1 ? "" : "s"} no se pudieron enviar: ${result.failed[0]?.message ?? ""}`,
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
    const discarded = await discardPendingChanges(jobId);
    setLastSyncResult(null);
    if (isBrowserOnline()) {
      // Re-download so the local copy no longer shows the discarded edits.
      try {
        await downloadFestivalSnapshot(jobId);
      } catch (error) {
        console.warn("No se pudo refrescar la copia offline tras descartar cambios:", error);
      }
    }
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
