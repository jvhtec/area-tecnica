import { Button } from "@/components/ui/button";
import { FileText, ImageOff, ImagePlus, Link, Loader2, Pencil, Printer, Receipt, Trash2 } from "lucide-react";
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

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Button variant="ghost" size="icon" onClick={() => onGenerateLink(artist)} title="Generate form link">
        <Link className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onManageFiles(artist)} title="Manage files/riders">
        <FileText className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onPrintArtist(artist)} disabled={printingArtistId === artist.id} title="Print artist details">
        {printingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onOpenStagePlotCapture(artist)} disabled={uploadingStagePlotArtistId === artist.id} title="Capture/upload stage plot">
        {uploadingStagePlotArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      </Button>
      {artist.stage_plot_file_path && (
        <Button variant="ghost" size="icon" onClick={() => onDeleteStagePlot(artist)} disabled={deletingStagePlotArtistId === artist.id} title="Delete stage plot">
          {deletingStagePlotArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageOff className="h-4 w-4" />}
        </Button>
      )}
      {canCreateExtras && gearComparison?.mismatches.some((m) => m.severity === "error") && (
        <Button variant="ghost" size="icon" onClick={handleCreateExtras} disabled={isCreatingExtrasFor(artist.id) || !artist.date} title="Crear presupuesto extras en Flex" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
          {isCreatingExtrasFor(artist.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={() => onEditArtist(artist)} title="Edit artist">
        <Pencil className="h-4 w-4" />
      </Button>
      {canDelete && (
        <Button variant="ghost" size="icon" onClick={() => onDeleteArtist(artist)} disabled={deletingArtistId === artist.id} title="Delete artist">
          {deletingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
