import type { ClipboardEventHandler, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageOff, ImagePlus, Loader2 } from "lucide-react";
import type { Artist } from "@/components/festival/artistTableTypes";

interface StagePlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: Artist | null;
  stagePlotUrls: Record<string, string>;
  inputRef: RefObject<HTMLInputElement>;
  isClipboardReading: boolean;
  uploadingArtistId: string | null;
  deletingArtistId: string | null;
  onPaste: ClipboardEventHandler<HTMLDivElement>;
  onReadClipboard: () => void;
  onDelete: (artist: Artist) => void;
}

/** Capture, replace or remove the stage plot image of one artist. */
export const StagePlotDialog = ({
  open,
  onOpenChange,
  artist,
  stagePlotUrls,
  inputRef,
  isClipboardReading,
  uploadingArtistId,
  deletingArtistId,
  onPaste,
  onReadClipboard,
  onDelete,
}: StagePlotDialogProps) => {
  const plotUrl = artist ? stagePlotUrls[artist.id] : undefined;
  const isUploading = uploadingArtistId === artist?.id;
  const isDeleting = deletingArtistId === artist?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stage Plot {artist ? `- ${artist.name}` : ""}</DialogTitle>
          <DialogDescription>
            Pega una captura con `Ctrl+V` / `Cmd+V`, o carga una imagen desde archivo/cámara.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {artist && plotUrl ? (
            <div className="overflow-hidden rounded border">
              <img
                src={plotUrl}
                alt={`Stage plot de ${artist.name}`}
                className="max-h-64 w-full object-contain bg-muted/30"
              />
            </div>
          ) : (
            <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
              Este artista todavía no tiene stage plot.
            </div>
          )}

          <div className="rounded-lg border border-dashed p-4 text-sm" tabIndex={0} onPaste={onPaste}>
            Pega aquí la imagen del portapapeles.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={onReadClipboard}
              disabled={!artist || isClipboardReading || isUploading}
            >
              {isClipboardReading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4 mr-2" />
              )}
              Pegar desde portapapeles
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={!artist || isUploading}
            >
              Seleccionar archivo
            </Button>
            {artist?.stage_plot_file_path && (
              <Button type="button" variant="destructive" onClick={() => onDelete(artist)} disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ImageOff className="h-4 w-4 mr-2" />
                )}
                Eliminar stage plot
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
