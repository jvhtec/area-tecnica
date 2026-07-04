import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Users, Clock, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { queryKeys } from "@/lib/react-query";
import { toast } from "sonner";

interface Festival {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
}

interface SearchResultArtist extends Artist {
  job_id: string;
  jobTitle: string;
}

interface CopyArtistsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentJobId: string;
  targetDate: string;
  onArtistsCopied: () => void;
}

const SEARCH_MIN_LENGTH = 2;
const SEARCH_LIMIT = 50;

const formatShowDate = (date: string | null | undefined) => {
  if (!date) return "";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : format(parsed, "d MMM yyyy");
};

export const CopyArtistsDialog = ({
  open,
  onOpenChange,
  currentJobId,
  targetDate,
  onArtistsCopied
}: CopyArtistsDialogProps) => {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [selectedFestival, setSelectedFestival] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedSourceDate, setSelectedSourceDate] = useState<string>("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [copyOptions, setCopyOptions] = useState({
    resetTimes: true,
    resetStages: false,
    copyNotes: true,
    copyTechnicalSpecs: true
  });

  // Reset transient state each time the dialog opens so a previous session's
  // search term / selection doesn't leak into a fresh copy.
  useEffect(() => {
    if (open) {
      loadFestivals();
    } else {
      setSearchTerm("");
      setDebouncedSearch("");
      setSelectedArtists([]);
      setSelectedFestival("");
      setSelectedSourceDate("");
      setArtists([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentJobId]);

  // Debounce the search term so we don't fire a query on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // Load artists when festival and date are selected (browse mode)
  useEffect(() => {
    if (selectedFestival && selectedSourceDate) {
      loadArtists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFestival, selectedSourceDate]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: queryKeys.scope("copy-artists-search", currentJobId, debouncedSearch),
    queryFn: async (): Promise<SearchResultArtist[]> => {
      const { data, error } = await dataLayerClient.from("festival_artists")
        .select("id, name, stage, date, show_start, show_end, job_id")
        .neq("job_id", currentJobId)
        .ilike("name", `%${debouncedSearch}%`)
        .order("date", { ascending: false })
        .limit(SEARCH_LIMIT);

      if (error) throw error;

      const rows = data || [];

      // Resolve festival titles in a second pass (avoids a typed-client embed
      // that trips CI type-checking on the shared FK name).
      const jobIds = [...new Set(rows.map(r => r.job_id).filter(Boolean))] as string[];
      let titleById: Record<string, string> = {};
      if (jobIds.length > 0) {
        const { data: jobs, error: jobsError } = await dataLayerClient.from("jobs")
          .select("id, title")
          .in("id", jobIds);
        if (jobsError) throw jobsError;
        titleById = Object.fromEntries((jobs || []).map(j => [j.id, j.title]));
      }

      return rows.map(row => ({
        id: row.id,
        name: row.name || "",
        stage: row.stage ?? 1,
        date: row.date || "",
        show_start: row.show_start || "",
        show_end: row.show_end || "",
        job_id: row.job_id as string,
        jobTitle: titleById[row.job_id as string] || "Festival sin título",
      }));
    },
    enabled: open && debouncedSearch.length >= SEARCH_MIN_LENGTH,
  });

  // When the same artist name shows up multiple times, flag the newest instance
  // (results come back date-descending, so the first occurrence per name is the
  // most recent) so the user can copy the freshest rider at a glance.
  const { duplicatedNames, mostRecentIdByName } = useMemo(() => {
    const counts = new Map<string, number>();
    const recentId = new Map<string, string>();
    searchResults.forEach(artist => {
      const key = artist.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!recentId.has(key) && artist.date) recentId.set(key, artist.id);
    });
    const dupes = new Set<string>();
    counts.forEach((count, key) => { if (count > 1) dupes.add(key); });
    return { duplicatedNames: dupes, mostRecentIdByName: recentId };
  }, [searchResults]);

  const loadFestivals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await dataLayerClient.from("jobs")
        .select("id, title, start_time, end_time")
        .in("job_type", ["festival", "ciclo"])
        .neq("id", currentJobId)
        .order("start_time", { ascending: false });

      if (error) throw error;
      setFestivals(data || []);
    } catch (error) {
      console.error("Error loading festivals:", error);
      toast.error("Error al cargar festivales");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableDates = async (festivalId: string) => {
    try {
      const { data, error } = await dataLayerClient.from("festival_artists")
        .select("date")
        .eq("job_id", festivalId)
        .not("date", "is", null);

      if (error) throw error;

      const uniqueDates = [...new Set(data?.map(item => item.date) || [])];
      setAvailableDates(uniqueDates.sort());
    } catch (error) {
      console.error("Error loading dates:", error);
      toast.error("Error al cargar fechas disponibles");
    }
  };

  const loadArtists = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await dataLayerClient.from("festival_artists")
        .select("id, name, stage, date, show_start, show_end")
        .eq("job_id", selectedFestival)
        .eq("date", selectedSourceDate)
        .order("show_start", { ascending: true });

      if (error) throw error;
      setArtists(data || []);
      // Auto-select the whole day in browse mode (previous behavior), merging
      // with anything already picked via search.
      setSelectedArtists(prev => [...new Set([...prev, ...(data?.map(artist => artist.id) || [])])]);
    } catch (error) {
      console.error("Error loading artists:", error);
      toast.error("Error al cargar artistas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFestivalChange = (festivalId: string) => {
    setSelectedFestival(festivalId);
    setSelectedSourceDate("");
    setArtists([]);
    loadAvailableDates(festivalId);
  };

  const handleArtistToggle = (artistId: string) => {
    setSelectedArtists(prev =>
      prev.includes(artistId)
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
    );
  };

  const handleSelectAllBrowse = () => {
    const browseIds = artists.map(a => a.id);
    const allSelected = browseIds.every(id => selectedArtists.includes(id));
    if (allSelected) {
      setSelectedArtists(prev => prev.filter(id => !browseIds.includes(id)));
    } else {
      setSelectedArtists(prev => [...new Set([...prev, ...browseIds])]);
    }
  };

  const copyArtists = async () => {
    if (selectedArtists.length === 0) {
      toast.error("Por favor selecciona al menos un artista para copiar");
      return;
    }

    setIsCopying(true);
    try {
      // Fetch full artist data for selected artists
      const { data: artistsData, error: fetchError } = await dataLayerClient.from("festival_artists")
        .select("*")
        .in("id", selectedArtists);

      if (fetchError) throw fetchError;

      // Prepare artists data for copying
      const artistsToCopy = artistsData?.map(artist => {
        const { id, created_at, updated_at, ...artistData } = artist;

        return {
          ...artistData,
          job_id: currentJobId,
          date: targetDate,
          // Stamp the rider as copied from its original show date so the table
          // can flag it as "outdated" (vs missing) and prompt for a fresher
          // rider. artistData.date still holds the source date here.
          rider_copied_from_date: artistData.date || null,
          rider_outdated_dismissed: false,
          // Reset times if option is selected
          show_start: copyOptions.resetTimes ? null : artistData.show_start,
          show_end: copyOptions.resetTimes ? null : artistData.show_end,
          soundcheck_start: copyOptions.resetTimes ? null : artistData.soundcheck_start,
          soundcheck_end: copyOptions.resetTimes ? null : artistData.soundcheck_end,
          line_check_start: copyOptions.resetTimes ? null : artistData.line_check_start,
          line_check_end: copyOptions.resetTimes ? null : artistData.line_check_end,
          load_in_time: copyOptions.resetTimes ? null : artistData.load_in_time,
          // Reset stages if option is selected
          stage: copyOptions.resetStages ? 1 : artistData.stage,
          // Remove notes if option is not selected
          notes: copyOptions.copyNotes ? artistData.notes : null,
          // Keep or remove technical specs based on option
          foh_console: copyOptions.copyTechnicalSpecs ? artistData.foh_console : null,
          foh_console_provided_by: copyOptions.copyTechnicalSpecs ? artistData.foh_console_provided_by : 'festival',
          mon_console: copyOptions.copyTechnicalSpecs ? artistData.mon_console : null,
          mon_console_provided_by: copyOptions.copyTechnicalSpecs ? artistData.mon_console_provided_by : 'festival',
          monitors_from_foh: copyOptions.copyTechnicalSpecs ? artistData.monitors_from_foh : false,
          foh_drive: copyOptions.copyTechnicalSpecs ? artistData.foh_drive : null,
          foh_drive_position: copyOptions.copyTechnicalSpecs ? artistData.foh_drive_position : null,
          mon_position: copyOptions.copyTechnicalSpecs ? artistData.mon_position : null,
          foh_waves_models: copyOptions.copyTechnicalSpecs ? artistData.foh_waves_models : [],
          foh_outboard: copyOptions.copyTechnicalSpecs ? artistData.foh_outboard : null,
          foh_waves_provided_by: copyOptions.copyTechnicalSpecs ? artistData.foh_waves_provided_by : 'festival',
          mon_waves_models: copyOptions.copyTechnicalSpecs ? artistData.mon_waves_models : [],
          mon_outboard: copyOptions.copyTechnicalSpecs ? artistData.mon_outboard : null,
          mon_waves_provided_by: copyOptions.copyTechnicalSpecs ? artistData.mon_waves_provided_by : 'festival',
          wireless_systems: copyOptions.copyTechnicalSpecs ? artistData.wireless_systems : [],
          wireless_provided_by: copyOptions.copyTechnicalSpecs ? artistData.wireless_provided_by : 'festival',
          iem_systems: copyOptions.copyTechnicalSpecs ? artistData.iem_systems : [],
          iem_provided_by: copyOptions.copyTechnicalSpecs ? artistData.iem_provided_by : 'festival',
          wired_mics: copyOptions.copyTechnicalSpecs ? artistData.wired_mics : []
        };
      }) || [];

      // Insert copied artists
      const { error: insertError } = await dataLayerClient.from("festival_artists")
        .insert(artistsToCopy);

      if (insertError) throw insertError;

      toast.success(`Se copiaron exitosamente ${selectedArtists.length} artista${selectedArtists.length > 1 ? 's' : ''}`);
      onArtistsCopied();
      onOpenChange(false);
    } catch (error) {
      console.error("Error copying artists:", error);
      toast.error("Error al copiar artistas");
    } finally {
      setIsCopying(false);
    }
  };

  const browseAllSelected = artists.length > 0 && artists.every(a => selectedArtists.includes(a.id));
  const searchTooShort = debouncedSearch.length > 0 && debouncedSearch.length < SEARCH_MIN_LENGTH;

  const copyOptionItems = useMemo(
    () => (
      <div className="space-y-3">
        <Label className="text-base font-medium">Opciones de copia</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="resetTimes"
              checked={copyOptions.resetTimes}
              onCheckedChange={(checked) => setCopyOptions(prev => ({ ...prev, resetTimes: !!checked }))}
              className="mt-1"
            />
            <Label htmlFor="resetTimes" className="text-sm leading-normal cursor-pointer">Restablecer horarios del show</Label>
          </div>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="resetStages"
              checked={copyOptions.resetStages}
              onCheckedChange={(checked) => setCopyOptions(prev => ({ ...prev, resetStages: !!checked }))}
              className="mt-1"
            />
            <Label htmlFor="resetStages" className="text-sm leading-normal cursor-pointer">Restablecer a Stage 1</Label>
          </div>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="copyNotes"
              checked={copyOptions.copyNotes}
              onCheckedChange={(checked) => setCopyOptions(prev => ({ ...prev, copyNotes: !!checked }))}
              className="mt-1"
            />
            <Label htmlFor="copyNotes" className="text-sm leading-normal cursor-pointer">Copiar notas</Label>
          </div>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="copyTechnicalSpecs"
              checked={copyOptions.copyTechnicalSpecs}
              onCheckedChange={(checked) => setCopyOptions(prev => ({ ...prev, copyTechnicalSpecs: !!checked }))}
              className="mt-1"
            />
            <Label htmlFor="copyTechnicalSpecs" className="text-sm leading-normal cursor-pointer">Copiar especificaciones técnicas</Label>
          </div>
        </div>
      </div>
    ),
    [copyOptions],
  );

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

          {/* Global name search */}
          <TabsContent value="search" className="space-y-4 mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                autoFocus
                placeholder="Buscar artista por nombre en todos los festivales..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                aria-label="Buscar artista por nombre"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>

            {searchTooShort ? (
              <p className="text-sm text-muted-foreground px-1">
                Escribe al menos {SEARCH_MIN_LENGTH} caracteres para buscar.
              </p>
            ) : debouncedSearch.length >= SEARCH_MIN_LENGTH ? (
              searchResults.length > 0 ? (
                <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
                  {searchResults.map(artist => {
                    const nameKey = artist.name.trim().toLowerCase();
                    const isDuplicated = duplicatedNames.has(nameKey);
                    const isMostRecent = mostRecentIdByName.get(nameKey) === artist.id;
                    return (
                      <label
                        key={artist.id}
                        htmlFor={`search-${artist.id}`}
                        className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                      >
                        <Checkbox
                          id={`search-${artist.id}`}
                          checked={selectedArtists.includes(artist.id)}
                          onCheckedChange={() => handleArtistToggle(artist.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{artist.name}</span>
                            <Badge variant="secondary" className="text-xs">Stage {artist.stage}</Badge>
                            {isDuplicated && isMostRecent && (
                              <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">
                                Más reciente
                              </Badge>
                            )}
                            {artist.show_start && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {artist.show_start}{artist.show_end ? ` - ${artist.show_end}` : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-medium shrink-0">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {artist.date ? formatShowDate(artist.date) : "Sin fecha"}
                            </Badge>
                            <span className="truncate">{artist.jobTitle}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {searchResults.length >= SEARCH_LIMIT && (
                    <p className="text-xs text-muted-foreground px-2 pt-1">
                      Mostrando los primeros {SEARCH_LIMIT} resultados. Refina la búsqueda para ver más.
                    </p>
                  )}
                </div>
              ) : (
                !isSearching && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron artistas que coincidan con "{debouncedSearch}".</p>
                  </div>
                )
              )
            ) : (
              <p className="text-sm text-muted-foreground px-1">
                Busca cualquier artista por nombre; los resultados incluyen su festival, fecha y stage de origen.
              </p>
            )}
          </TabsContent>

          {/* Browse by festival → date (original flow) */}
          <TabsContent value="browse" className="space-y-4 mt-0">
            <div className="space-y-2">
              <Label>Seleccionar festival de origen</Label>
              <Select onValueChange={handleFestivalChange} disabled={isLoading} value={selectedFestival}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Elegir festival del que copiar..." />
                </SelectTrigger>
                <SelectContent>
                  {festivals.map(festival => (
                    <SelectItem key={festival.id} value={festival.id}>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{festival.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(festival.start_time), "MMM yyyy")}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFestival && availableDates.length > 0 && (
              <div className="space-y-2">
                <Label>Seleccionar fecha de origen</Label>
                <Select onValueChange={setSelectedSourceDate} value={selectedSourceDate}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Elegir fecha..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map(date => (
                      <SelectItem key={date} value={date}>
                        {format(new Date(date), "EEEE, MMMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {artists.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">
                    Artistas de la fecha
                  </Label>
                  <Button variant="outline" size="sm" onClick={handleSelectAllBrowse}>
                    {browseAllSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                  {artists.map(artist => (
                    <label
                      key={artist.id}
                      htmlFor={`browse-${artist.id}`}
                      className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                    >
                      <Checkbox
                        id={`browse-${artist.id}`}
                        checked={selectedArtists.includes(artist.id)}
                        onCheckedChange={() => handleArtistToggle(artist.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{artist.name}</span>
                          <Badge variant="secondary">Stage {artist.stage}</Badge>
                          {artist.show_start && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {artist.show_start}
                              {artist.show_end && ` - ${artist.show_end}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedFestival && availableDates.length === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron artistas en el festival seleccionado.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Shared copy options (apply to whatever is selected across both tabs) */}
        {selectedArtists.length > 0 && (
          <div className="pt-2 border-t">
            {copyOptionItems}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          {selectedArtists.length > 0 && (
            <span className="text-sm text-muted-foreground sm:mr-auto">
              {selectedArtists.length} artista{selectedArtists.length !== 1 ? "s" : ""} seleccionado{selectedArtists.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={copyArtists}
            disabled={selectedArtists.length === 0 || isCopying}
            className="min-w-24"
          >
            {isCopying ? "Copiando..." : `Copiar ${selectedArtists.length} artista${selectedArtists.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
