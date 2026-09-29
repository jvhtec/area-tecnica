import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { trackError } from "@/lib/errorTracking";
import { DEFAULT_COPY_ARTISTS_OPTIONS, type CopyArtistsOptions } from "@/features/festival-artists/copyArtists";
import { useCopyArtists, useCopyArtistsData } from "@/features/festival-artists/hooks/useCopyArtistsData";
import { CopyBrowseTab } from "./copy-artists/CopyBrowseTab";
import { CopyOptionsPanel } from "./copy-artists/CopyOptionsPanel";
import { CopySearchTab } from "./copy-artists/CopySearchTab";

interface CopyArtistsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentJobId: string;
  targetDate: string;
  onArtistsCopied: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export const CopyArtistsDialog = ({
  open,
  onOpenChange,
  currentJobId,
  targetDate,
  onArtistsCopied,
}: CopyArtistsDialogProps) => {
  const [selectedFestival, setSelectedFestival] = useState("");
  const [selectedSourceDate, setSelectedSourceDate] = useState("");
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [copyOptions, setCopyOptions] = useState<CopyArtistsOptions>(DEFAULT_COPY_ARTISTS_OPTIONS);

  const data = useCopyArtistsData({ open, currentJobId, selectedFestival, selectedSourceDate, debouncedSearch });
  const copyMutation = useCopyArtists({ targetJobId: currentJobId, targetDate });
  const { dayArtists } = data;

  // Reset transient state each time the dialog closes so a previous session's
  // search term / selection doesn't leak into a fresh copy.
  useEffect(() => {
    if (open) return;
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedArtists([]);
    setSelectedFestival("");
    setSelectedSourceDate("");
  }, [open]);

  // Debounce the search term so we don't fire a query on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // Browsing a date selects the whole day (merged with anything already picked via search).
  useEffect(() => {
    if (dayArtists.length === 0) return;
    setSelectedArtists((prev) => [...new Set([...prev, ...dayArtists.map((artist) => artist.id)])]);
  }, [dayArtists]);

  const handleFestivalChange = (festivalId: string) => {
    setSelectedFestival(festivalId);
    setSelectedSourceDate("");
  };

  const handleArtistToggle = (artistId: string) => {
    setSelectedArtists((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId],
    );
  };

  const handleToggleAllBrowse = () => {
    const browseIds = dayArtists.map((artist) => artist.id);
    const allSelected = browseIds.every((id) => selectedArtists.includes(id));
    setSelectedArtists((prev) =>
      allSelected ? prev.filter((id) => !browseIds.includes(id)) : [...new Set([...prev, ...browseIds])],
    );
  };

  const copyArtists = async () => {
    if (selectedArtists.length === 0) {
      toast.error("Por favor selecciona al menos un artista para copiar");
      return;
    }

    try {
      await copyMutation.mutateAsync({ artistIds: selectedArtists, options: copyOptions });
      const count = selectedArtists.length;
      toast.success(`Se copiaron exitosamente ${count} artista${count > 1 ? "s" : ""}`);
      onArtistsCopied();
      onOpenChange(false);
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "copy-artists", jobId: currentJobId });
      toast.error("Error al copiar artistas");
    }
  };

  const selectedCount = selectedArtists.length;
  const plural = selectedCount !== 1 ? "s" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Copiar artistas
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="search" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-2" />
              Buscar por nombre
            </TabsTrigger>
            <TabsTrigger value="browse">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Explorar por festival
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-0">
            <CopySearchTab
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              debouncedSearch={debouncedSearch}
              results={data.searchResults}
              isSearching={data.isSearching}
              selectedIds={selectedArtists}
              onToggle={handleArtistToggle}
            />
          </TabsContent>

          <TabsContent value="browse" className="mt-0">
            <CopyBrowseTab
              festivals={data.festivals}
              isLoading={data.isLoadingFestivals || data.isLoadingDates || data.isLoadingDayArtists}
              selectedFestival={selectedFestival}
              onFestivalChange={handleFestivalChange}
              availableDates={data.availableDates}
              selectedSourceDate={selectedSourceDate}
              onSourceDateChange={setSelectedSourceDate}
              artists={dayArtists}
              selectedIds={selectedArtists}
              onToggle={handleArtistToggle}
              onToggleAll={handleToggleAllBrowse}
            />
          </TabsContent>
        </Tabs>

        {selectedCount > 0 && (
          <div className="pt-2 border-t">
            <CopyOptionsPanel options={copyOptions} onChange={setCopyOptions} />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          {selectedCount > 0 && (
            <span className="text-sm text-muted-foreground sm:mr-auto">
              {selectedCount} artista{plural} seleccionado{plural}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={copyArtists} disabled={selectedCount === 0 || copyMutation.isPending} className="min-w-24">
            {copyMutation.isPending ? "Copiando..." : `Copiar ${selectedCount} artista${plural}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
