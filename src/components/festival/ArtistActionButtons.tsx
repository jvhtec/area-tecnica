import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, ImageOff, ImagePlus, Link, Loader2, MoreVertical, Pencil, Printer, Receipt, Trash2 } from "lucide-react";
import type { ArtistGearComparison } from "@/utils/gearComparisonService";

type ArtistActionArtist = {
  id: string;
  name: string;
  date: string;
  show_start: string;
  show_end: string;
  isaftermidnight?: boolean;
  stage_plot_file_path?: string | null;
};

interface ArtistActionButtonsProps<TArtist extends ArtistActionArtist> {
  artist: TArtist;
  gearComparison?: ArtistGearComparison;
  printingArtistId: string | null;
  uploadingStagePlotArtistId: string | null;
  deletingStagePlotArtistId: string | null;
  deletingArtistId: string | null;
  canDelete: boolean;
  canCreateExtras: boolean;
  isCreatingExtrasFor: (id: string) => boolean;
  onGenerateLink: (artist: TArtist) => void;
  onManageFiles: (artist: TArtist) => void;
  onPrintArtist: (artist: TArtist) => void;
  onOpenStagePlotCapture: (artist: TArtist) => void;
  onDeleteStagePlot: (artist: TArtist) => void;
  onEditArtist: (artist: TArtist) => void;
  onDeleteArtist: (artist: TArtist) => void;
  onCreateFlexExtras: (artistId: string, artistName: string, artistDate: string, showStart: string, showEnd: string, isAfterMidnight: boolean) => void;
}

export function ArtistActionButtons<TArtist extends ArtistActionArtist>({
  artist,
  gearComparison,
  printingArtistId,
  uploadingStagePlotArtistId,
  deletingStagePlotArtistId,
  deletingArtistId,
  canDelete,
  canCreateExtras,
  isCreatingExtrasFor,
  onGenerateLink,
  onManageFiles,
  onPrintArtist,
  onOpenStagePlotCapture,
  onDeleteStagePlot,
  onEditArtist,
  onDeleteArtist,
  onCreateFlexExtras,
}: ArtistActionButtonsProps<TArtist>) {
  const handleCreateExtras = () => {
    if (!canCreateExtras || !artist.date) return;
    onCreateFlexExtras(artist.id, artist.name, artist.date, artist.show_start, artist.show_end, artist.isaftermidnight || false);
  };

  const isBusy =
    printingArtistId === artist.id ||
    uploadingStagePlotArtistId === artist.id ||
    deletingStagePlotArtistId === artist.id ||
    deletingArtistId === artist.id ||
    isCreatingExtrasFor(artist.id);

  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditArtist(artist)} title="Editar artista">
        <Pencil className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Más acciones">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onGenerateLink(artist)}>
            <Link className="h-4 w-4 mr-2" />
            Generar enlace de formulario
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onManageFiles(artist)}>
            <FileText className="h-4 w-4 mr-2" />
            Gestionar archivos/riders
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPrintArtist(artist)} disabled={printingArtistId === artist.id}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir PDF del artista
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onOpenStagePlotCapture(artist)} disabled={uploadingStagePlotArtistId === artist.id}>
            <ImagePlus className="h-4 w-4 mr-2" />
            Pegar/cargar stage plot
          </DropdownMenuItem>
          {artist.stage_plot_file_path && (
            <DropdownMenuItem onClick={() => onDeleteStagePlot(artist)} disabled={deletingStagePlotArtistId === artist.id}>
              <ImageOff className="h-4 w-4 mr-2" />
              Eliminar stage plot
            </DropdownMenuItem>
          )}
          {canCreateExtras && gearComparison?.mismatches.some((m) => m.severity === "error") && (
            <DropdownMenuItem
              onClick={handleCreateExtras}
              disabled={isCreatingExtrasFor(artist.id) || !artist.date}
              className="text-amber-600 focus:text-amber-700"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Crear presupuesto extras en Flex
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteArtist(artist)}
                disabled={deletingArtistId === artist.id}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar artista
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
