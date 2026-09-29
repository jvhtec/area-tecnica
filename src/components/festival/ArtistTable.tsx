import { useMemo, useState } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Loading } from "@/components/ui/loading";
import { ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArtistFormLinkDialog } from "./ArtistFormLinkDialog";
import { ArtistFormLinksDialog } from "./ArtistFormLinksDialog";
import { ArtistFileDialog } from "./ArtistFileDialog";
import { exportArtistPDF } from "@/utils/artistPdfExport";
import { sortArtistsChronologically, sortArtistsByField, ARTIST_SORT_FIELD_LABELS, type ArtistSortField } from "@/utils/artistSorting";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildReadableFilename } from "@/utils/fileName";
import { MobileArtistList } from "./mobile/MobileArtistList";
import { useCreateExtrasPresupuesto } from "@/hooks/festival/useCreateExtrasPresupuesto";
import { ArtistTableRow, type ArtistRowActionProps } from "./artist-table/ArtistTableRow";
import { StagePlotDialog } from "./artist-table/StagePlotDialog";
import { ArtistTableHeader } from "./ArtistTableHeader";
import { buildArtistPdfData } from "@/utils/artistPdfDataMapper";
import { getArtistRiderStatus } from "@/features/festival-management/selectors";

import { compareArtistsWithGear } from "@/features/festival-artists/gearComparison";
import {
  useFestivalGearSetups,
  useFestivalStageNames,
} from "@/features/festival-artists/hooks/useFestivalArtistLookups";
import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import type { Artist, ArtistTableProps } from "@/components/festival/artistTableTypes";
import { useArtistStagePlots } from "@/hooks/festival/useArtistStagePlots";

export const ArtistTable = ({
  artists,
  isLoading,
  onEditArtist,
  onDeleteArtist,
  searchTerm,
  stageFilter,
  riderFilter,
  dayStartTime,
  jobId,
  selectedDate,
  crossDateSearch = false,
  onArtistStagePlotUpdated,
  canDelete,
  canCreateExtras,
  canManageFormLinks = false
}: ArtistTableProps) => {
  const [sortBy, setSortBy] = useState<ArtistSortField>('chronological');
  const confirm = useConfirm();
  const { createExtrasPresupuesto, isCreatingExtrasFor } = useCreateExtrasPresupuesto(
    jobId,
    dayStartTime,
  );
  const [deletingArtistId, setDeletingArtistId] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [printingArtistId, setPrintingArtistId] = useState<string | null>(null);

  const { stageNames } = useFestivalStageNames(jobId);
  const { festivalGearSetup, stageGearSetups } = useFestivalGearSetups(jobId);
  const gearComparisons = useMemo(
    () => compareArtistsWithGear(artists, festivalGearSetup, stageGearSetups),
    [artists, festivalGearSetup, stageGearSetups],
  );

  // Helper function to get stage display name
  const getStageDisplayName = (stageNumber: number) => {
    return stageNames[stageNumber] || `Stage ${stageNumber}`;
  };

  const {
    deletingStagePlotArtistId,
    handleDeleteStagePlot,
    handleOpenStagePlotCapture,
    handleReadClipboardImage,
    handleStagePlotPaste,
    handleStagePlotUpload,
    isClipboardReading,
    selectedStagePlotArtist,
    setSelectedStagePlotArtist,
    setStagePlotDialogOpen,
    stagePlotDialogOpen,
    stagePlotInputRef,
    stagePlotUrls,
    uploadingStagePlotArtistId,
  } = useArtistStagePlots(artists, onArtistStagePlotUpdated);



  // Filtering logic
  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === "all" || artist.stage?.toString() === stageFilter;
    const riderStatus = getArtistRiderStatus(artist);
    const matchesRider = riderFilter === "all" || riderStatus === riderFilter;
    return matchesSearch && matchesStage && matchesRider;
  });

  // Apply sorting to filtered artists using imported utility
  const sortedFilteredArtists = (
    sortBy === 'chronological'
      ? sortArtistsChronologically(filteredArtists, dayStartTime)
      : sortArtistsByField(filteredArtists, sortBy)
  ) as Artist[];
  const hasArtistSubmittedData = sortedFilteredArtists.some((artist) => artist.artist_submitted);
  const handleDeleteClick = async (artist: Artist) => {
    if (!canDelete) return;
    const confirmed = await confirm({
      title: "Eliminar artista",
      description: `¿Estás seguro de que quieres eliminar ${artist.name}?`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (confirmed) {
      setDeletingArtistId(artist.id);
      await onDeleteArtist(artist);
      setDeletingArtistId(null);
    }
  };

  const handlePrintArtist = async (artist: Artist) => {
    setPrintingArtistId(artist.id);
    try {
      const pdfData = await buildArtistPdfData(artist, jobId);
      
      const blob = await exportArtistPDF(pdfData, {
        language: artist.form_language === "en" ? "en" : "es",
      });

      downloadBlobInBrowser(blob, buildReadableFilename([artist.name, "Requisitos técnicos"]));

      toast.success(`PDF generado para ${artist.name}`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar PDF');
    } finally {
      setPrintingArtistId(null);
    }
  };
  const handleSendForm = (artist: Artist) => {
    setSelectedArtist(artist);
    setLinkDialogOpen(true);
  };
  const handleViewLinks = () => {
    setLinksDialogOpen(true);
  };
  const handleManageFiles = (artist: Artist) => {
    setSelectedArtist(artist);
    setFileDialogOpen(true);
  };
  const actionProps: ArtistRowActionProps = {
    printingArtistId,
    uploadingStagePlotArtistId,
    deletingStagePlotArtistId,
    deletingArtistId,
    canDelete,
    canCreateExtras,
    canManageFormLinks,
    isCreatingExtrasFor,
    onSendForm: handleSendForm,
    onManageFiles: handleManageFiles,
    onPrintArtist: handlePrintArtist,
    onOpenStagePlotCapture: handleOpenStagePlotCapture,
    onDeleteStagePlot: handleDeleteStagePlot,
    onEditArtist,
    onDeleteArtist: handleDeleteClick,
    onCreateFlexExtras: createExtrasPresupuesto,
  };

  if (isLoading) {
    return <div className="w-full">
        <Loading label="Cargando artistas…" size="lg" className="py-8" />
      </div>;
  }
  return (
    <>
      <TooltipProvider>
        <div className="w-full space-y-4">
          <ArtistTableHeader
            artistCount={sortedFilteredArtists.length}
            canManageFormLinks={canManageFormLinks}
            onViewLinks={handleViewLinks}
          />

          {hasArtistSubmittedData && (
            <div className="px-2">
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Parte de la información mostrada fue enviada por artistas mediante formulario público.
              </div>
            </div>
          )}

          {/* Desktop Table — fixed layout so all columns fit the viewport without horizontal scroll */}
          <div className="hidden md:block w-full">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%] px-2">Artista</TableHead>
                  <TableHead className="w-[11%] px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          title="Ordenar horarios"
                        >
                          Horarios
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(Object.keys(ARTIST_SORT_FIELD_LABELS) as ArtistSortField[]).map((field) => (
                          <DropdownMenuCheckboxItem
                            key={field}
                            checked={sortBy === field}
                            onCheckedChange={() => setSortBy(field)}
                          >
                            {ARTIST_SORT_FIELD_LABELS[field]}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>
                  <TableHead className="w-[13%] px-2">Consolas</TableHead>
                  <TableHead className="w-[10%] px-2">Waves/Outboard</TableHead>
                  <TableHead className="w-[12%] px-2">RF/IEM</TableHead>
                  <TableHead className="w-[9%] px-2">Micrófonos</TableHead>
                  <TableHead className="w-[7%] px-2">Mon/Extras</TableHead>
                  <TableHead className="w-[8%] px-2">Infra</TableHead>
                  <TableHead className="w-[7%] px-2">Notas</TableHead>
                  <TableHead className="w-[5%] px-2">Estado</TableHead>
                  <TableHead className="w-[6%] px-2">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilteredArtists.map((artist) => (
                  <ArtistTableRow
                    key={artist.id}
                    artist={artist}
                    stageName={getStageDisplayName(artist.stage)}
                    crossDateSearch={crossDateSearch}
                    stagePlotUrl={stagePlotUrls[artist.id]}
                    gearComparison={gearComparisons[artist.id]}
                    actionProps={actionProps}
                    onArtistChanged={onArtistStagePlotUpdated}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden">
            <MobileArtistList
              artists={sortedFilteredArtists}
              stageNames={stageNames}
              stagePlotUrls={stagePlotUrls}
              gearComparisons={gearComparisons}
              jobId={jobId || ""}
              selectedDate={selectedDate || ""}
              crossDateSearch={crossDateSearch}
              onEditArtist={onEditArtist}
              onDeleteArtist={handleDeleteClick}
              onSendForm={handleSendForm}
              onManageFiles={handleManageFiles}
              onPrintArtist={handlePrintArtist}
              onOpenStagePlotCapture={handleOpenStagePlotCapture}
              onDeleteStagePlot={handleDeleteStagePlot}
              onArtistsChanged={() => onArtistStagePlotUpdated?.()}
              printingArtistId={printingArtistId}
              deletingArtistId={deletingArtistId}
              uploadingStagePlotArtistId={uploadingStagePlotArtistId}
              deletingStagePlotArtistId={deletingStagePlotArtistId}
              onCreateFlexExtras={createExtrasPresupuesto}
              isCreatingExtrasFor={isCreatingExtrasFor}
              canDelete={canDelete}
              canCreateExtras={canCreateExtras}
              canManageFormLinks={canManageFormLinks}
            />
          </div>

          {sortedFilteredArtists.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron artistas con los filtros actuales.
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* No `capture` attribute: mobile browsers then offer the chooser
          (camera roll / take photo / files) instead of forcing the camera */}
      <input
        ref={stagePlotInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleStagePlotUpload}
      />

      <StagePlotDialog
        open={stagePlotDialogOpen}
        onOpenChange={(open) => {
          setStagePlotDialogOpen(open);
          if (!open) setSelectedStagePlotArtist(null);
        }}
        artist={selectedStagePlotArtist}
        stagePlotUrls={stagePlotUrls}
        inputRef={stagePlotInputRef}
        isClipboardReading={isClipboardReading}
        uploadingArtistId={uploadingStagePlotArtistId}
        deletingArtistId={deletingStagePlotArtistId}
        onPaste={handleStagePlotPaste}
        onReadClipboard={handleReadClipboardImage}
        onDelete={handleDeleteStagePlot}
      />

      {selectedArtist && (
        <>
          <ArtistFormLinkDialog
            open={linkDialogOpen}
            onOpenChange={setLinkDialogOpen}
            artistId={selectedArtist.id}
            artistName={selectedArtist.name}
            jobId={jobId}
            selectedDate={selectedDate}
          />
          
          <ArtistFileDialog open={fileDialogOpen} onOpenChange={setFileDialogOpen} artistId={selectedArtist.id} />
        </>
      )}

      <ArtistFormLinksDialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen} selectedDate={selectedDate || ''} jobId={jobId || ''} />
    </>
  );
};
