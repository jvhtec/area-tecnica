import { format } from "date-fns";
import {
  AlertTriangle,
  CloudDownload,
  CloudOff,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  Undo2,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOfflineFestival } from "@/hooks/festival/useOfflineFestival";

interface FestivalOfflineControlsProps {
  jobId?: string;
  /** Whether the current user can push offline edits back to the server */
  canEdit: boolean;
  className?: string;
}

/**
 * Offline dataset controls for a festival: download/refresh the local copy
 * (any role) and manually sync queued edits back to the server (edit roles).
 */
export const FestivalOfflineControls = ({ jobId, canEdit, className }: FestivalOfflineControlsProps) => {
  const {
    isOnline,
    hasSnapshot,
    snapshotMeta,
    pendingCount,
    hasConflicts,
    isDownloading,
    isSyncing,
    download,
    sync,
    removeOfflineCopy,
    discardChanges,
  } = useOfflineFestival(jobId);

  if (!jobId) return null;

  const busy = isDownloading || isSyncing;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`relative flex items-center gap-2 hover:bg-accent/50 transition-all ${className ?? ""}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isOnline ? (
            <HardDrive className="h-4 w-4" />
          ) : (
            <CloudOff className="h-4 w-4 text-amber-500" />
          )}
          <span className="hidden sm:inline">Offline</span>
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 min-w-5 px-1 flex items-center justify-center text-[10px]"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="space-y-1">
          <div>Modo offline</div>
          {hasSnapshot && snapshotMeta ? (
            <div className="text-xs font-normal text-muted-foreground">
              Descargado el {format(new Date(snapshotMeta.downloadedAt), "dd/MM/yyyy HH:mm")} ·{" "}
              {snapshotMeta.artistCount} artistas
            </div>
          ) : (
            <div className="text-xs font-normal text-muted-foreground">
              Sin copia offline de este festival
            </div>
          )}
          {!isOnline && (
            <div className="text-xs font-normal text-amber-600 flex items-center gap-1">
              <CloudOff className="h-3 w-3" /> Sin conexión
            </div>
          )}
          {pendingCount > 0 && (
            <div className="text-xs font-normal text-muted-foreground">
              {pendingCount} cambio{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"} de
              sincronizar
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!isOnline || busy} onSelect={() => download()}>
          <CloudDownload className="h-4 w-4 mr-2" />
          {hasSnapshot ? "Actualizar copia offline" : "Descargar para uso offline"}
        </DropdownMenuItem>

        {canEdit && (
          <DropdownMenuItem disabled={!isOnline || busy || pendingCount === 0} onSelect={() => sync()}>
            <UploadCloud className="h-4 w-4 mr-2" />
            Sincronizar cambios
          </DropdownMenuItem>
        )}

        {canEdit && hasConflicts && (
          <DropdownMenuItem
            disabled={!isOnline || busy || pendingCount === 0}
            onSelect={() => sync({ force: true })}
            className="text-amber-600 focus:text-amber-600"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Forzar sincronización
          </DropdownMenuItem>
        )}

        {hasSnapshot && (
          <>
            <DropdownMenuSeparator />
            {pendingCount > 0 && (
              <DropdownMenuItem disabled={busy} onSelect={() => discardChanges()}>
                <Undo2 className="h-4 w-4 mr-2" />
                Descartar cambios pendientes
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={busy}
              onSelect={() => removeOfflineCopy()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar copia offline
            </DropdownMenuItem>
          </>
        )}

        {hasSnapshot && isOnline && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Actualiza la copia antes de trabajar sin conexión
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
