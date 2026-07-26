import { useState, useRef, useEffect, useCallback } from "react";
import { MobileArtistCard, type MobileArtistRiderFile, type MobileConfigCategory } from "./MobileArtistCard";
import { MobileArtistConfigEditor, ReadOnlyArtistCategoryContent } from "./MobileArtistConfigEditor";
import type { ArtistGearComparison } from "@/utils/gearComparisonService";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Artist } from "@/components/festival/artistTableTypes";

const CATEGORY_TITLES: Record<MobileConfigCategory, string> = {
  consoles: "Consolas",
  wireless: "Wireless / IEM",
  microphones: "Micrófonos",
  monitors: "Monitores y Extras",
  infrastructure: "Infraestructura",
  notes: "Notas",
  rider: "Riders",
};

interface MobileArtistListProps {
  artists: Artist[];
  stageNames: Record<number, string>;
  stagePlotUrls: Record<string, string>;
  gearComparisons: Record<string, ArtistGearComparison>;
  jobId: string;
  selectedDate: string;
  /** True while the search box is matching artists across every festival date, not just `selectedDate`. */
  crossDateSearch?: boolean;
  onEditArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => void;
  onGenerateLink: (artist: Artist) => void;
  onManageFiles: (artist: Artist) => void;
  onPrintArtist: (artist: Artist) => void;
  onOpenStagePlotCapture: (artist: Artist) => void;
  onDeleteStagePlot: (artist: Artist) => void;
  onArtistsChanged: () => void;
  onCreateFlexExtras: (artistId: string, artistName: string, artistDate: string, showStart: string, showEnd: string, isAfterMidnight: boolean) => void;
  printingArtistId: string | null;
  deletingArtistId: string | null;
  uploadingStagePlotArtistId: string | null;
  deletingStagePlotArtistId: string | null;
  isCreatingExtrasFor: (id: string) => boolean;
  mode?: 'edit' | 'readonly';
  riderFilesByArtistId?: Record<string, MobileArtistRiderFile[]>;
  onDownloadRiderFile?: (file: MobileArtistRiderFile) => void;
  canDelete: boolean;
  canCreateExtras: boolean;
}

export const MobileArtistList = ({
  artists,
  stageNames,
  stagePlotUrls,
  gearComparisons,
  jobId,
  selectedDate,
  crossDateSearch = false,
  onEditArtist,
  onDeleteArtist,
  onGenerateLink,
  onManageFiles,
  onPrintArtist,
  onOpenStagePlotCapture,
  onDeleteStagePlot,
  onArtistsChanged,
  onCreateFlexExtras,
  printingArtistId,
  deletingArtistId,
  uploadingStagePlotArtistId,
  deletingStagePlotArtistId,
  isCreatingExtrasFor,
  mode = 'edit',
  riderFilesByArtistId = {},
  onDownloadRiderFile,
  canDelete,
  canCreateExtras,
}: MobileArtistListProps) => {
  const [editingCategory, setEditingCategory] = useState<{
    artistId: string;
    category: MobileConfigCategory;
  } | null>(null);
  const [readonlyDetail, setReadonlyDetail] = useState<{
    artist: Artist;
    category: MobileConfigCategory;
  } | null>(null);

  // Track which artist to scroll to after returning from editor
  const [scrollToArtistId, setScrollToArtistId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to the artist card after returning from editor
  useEffect(() => {
    if (scrollToArtistId && !editingCategory) {
      const el = cardRefs.current[scrollToArtistId];
      if (el) {
        // Small delay to ensure DOM is rendered
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      setScrollToArtistId(null);
    }
  }, [scrollToArtistId, editingCategory]);

  const setCardRef = useCallback((artistId: string, el: HTMLDivElement | null) => {
    cardRefs.current[artistId] = el;
  }, []);

  const handleEditCategory = (artistId: string, category: MobileConfigCategory) => {
    if (mode === 'readonly') {
      const selectedArtist = artists.find((artist) => artist.id === artistId);
      if (!selectedArtist) return;
      setReadonlyDetail({ artist: selectedArtist, category });
      return;
    }
    setEditingCategory({ artistId, category });
  };

  const handleEditorBack = () => {
    const artistId = editingCategory?.artistId || null;
    setScrollToArtistId(artistId);
    setEditingCategory(null);
  };

  const handleEditorSaved = () => {
    onArtistsChanged();
  };

  // Full-screen editor overlay
  if (mode === 'edit' && editingCategory) {
    const editingArtist = artists.find(a => a.id === editingCategory.artistId);
    if (editingArtist) {
      return (
        <MobileArtistConfigEditor
          artist={editingArtist}
          category={editingCategory.category}
          jobId={jobId}
          selectedDate={selectedDate}
          onBack={handleEditorBack}
          onSaved={handleEditorSaved}
        />
      );
    }
  }

  // Hub view: list of artist cards
  return (
    <div className="space-y-4">
      {artists.map(artist => (
        <div key={artist.id} ref={(el) => setCardRef(artist.id, el)}>
          <MobileArtistCard
            artist={artist}
            stageName={stageNames[artist.stage] || `Stage ${artist.stage}`}
            stagePlotUrl={stagePlotUrls[artist.id]}
            gearComparison={gearComparisons[artist.id]}
            showDateBadge={crossDateSearch}
            mode={mode}
            onEditCategory={handleEditCategory}
            onEditArtist={onEditArtist}
            onGenerateLink={onGenerateLink}
            onManageFiles={onManageFiles}
            onPrintArtist={onPrintArtist}
            onDeleteArtist={onDeleteArtist}
            onOpenStagePlotCapture={onOpenStagePlotCapture}
            onDeleteStagePlot={onDeleteStagePlot}
            onCreateFlexExtras={onCreateFlexExtras}
            onOutdatedRiderDismissed={onArtistsChanged}
            printingArtistId={printingArtistId}
            deletingArtistId={deletingArtistId}
            uploadingStagePlotArtistId={uploadingStagePlotArtistId}
            deletingStagePlotArtistId={deletingStagePlotArtistId}
            isCreatingExtrasFor={isCreatingExtrasFor}
            riderFiles={riderFilesByArtistId[artist.id] || []}
            canDelete={canDelete}
            canCreateExtras={canCreateExtras}
          />
        </div>
      ))}

      {mode === 'readonly' && readonlyDetail && (
        <Sheet
          open={Boolean(readonlyDetail)}
          onOpenChange={(open) => {
            if (!open) setReadonlyDetail(null);
          }}
        >
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-left">
                  {readonlyDetail.artist.name} · {CATEGORY_TITLES[readonlyDetail.category]}
                </SheetTitle>
              </SheetHeader>
            <ReadOnlyArtistCategoryContent
              artist={readonlyDetail.artist}
              category={readonlyDetail.category}
              riderFiles={riderFilesByArtistId[readonlyDetail.artist.id] || []}
              onDownloadRiderFile={onDownloadRiderFile}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
