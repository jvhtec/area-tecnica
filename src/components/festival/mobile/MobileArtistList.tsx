import { useState, useRef, useEffect, useCallback } from "react";
import { MobileArtistCard, type MobileArtistRiderFile, type MobileConfigCategory } from "./MobileArtistCard";
import { MobileArtistConfigEditor, ReadOnlyArtistCategoryContent } from "./MobileArtistConfigEditor";
import type { ArtistGearComparison } from "@/utils/gearComparisonService";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const CATEGORY_TITLES: Record<MobileConfigCategory, string> = {
  consoles: "Consolas",
  wireless: "Wireless / IEM",
  microphones: "Micrófonos",
  monitors: "Monitores y Extras",
  infrastructure: "Infraestructura",
  notes: "Notas",
  rider: "Riders",
};

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_from_foh?: boolean;
  foh_waves_outboard?: string;
  mon_waves_outboard?: string;
  wireless_systems: any[];
  wireless_provided_by?: 'festival' | 'band' | 'mixed';
  iem_systems: any[];
  iem_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  extras_wired?: string;
  notes?: string;
  rider_missing?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  isaftermidnight?: boolean;
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }>;
  job_id?: string;
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
  infrastructure_provided_by?: 'festival' | 'band' | 'mixed';
  artist_submitted?: boolean;
  stage_plot_file_path?: string | null;
  stage_plot_file_name?: string | null;
  stage_plot_file_type?: string | null;
  stage_plot_uploaded_at?: string | null;
}

interface MobileArtistListProps {
  artists: Artist[];
  stageNames: Record<number, string>;
  stagePlotUrls: Record<string, string>;
  gearComparisons: Record<string, ArtistGearComparison>;
  jobId: string;
  selectedDate: string;
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
  creatingExtrasForArtistId: string | null;
  mode?: 'edit' | 'readonly';
  riderFilesByArtistId?: Record<string, MobileArtistRiderFile[]>;
  onDownloadRiderFile?: (file: MobileArtistRiderFile) => void;
}

export const MobileArtistList = ({
  artists,
  stageNames,
  stagePlotUrls,
  gearComparisons,
  jobId,
  selectedDate,
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
  creatingExtrasForArtistId,
  mode = 'edit',
  riderFilesByArtistId = {},
  onDownloadRiderFile,
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
            printingArtistId={printingArtistId}
            deletingArtistId={deletingArtistId}
            uploadingStagePlotArtistId={uploadingStagePlotArtistId}
            deletingStagePlotArtistId={deletingStagePlotArtistId}
            creatingExtrasForArtistId={creatingExtrasForArtistId}
            riderFiles={riderFilesByArtistId[artist.id] || []}
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
