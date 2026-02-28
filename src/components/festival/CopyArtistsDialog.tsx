import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
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

interface CopyArtistsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentJobId: string;
  targetDate: string;
  onArtistsCopied: () => void;
}

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
  const [copyOptions, setCopyOptions] = useState({
    resetTimes: true,
    resetStages: false,
    copyNotes: true,
    copyTechnicalSpecs: true
  });

  // Load festivals on open
  useEffect(() => {
    if (open) {
      loadFestivals();
    }
  }, [open, currentJobId]);

  // Load artists when festival and date are selected
  useEffect(() => {
    if (selectedFestival && selectedSourceDate) {
      loadArtists();
    }
  }, [selectedFestival, selectedSourceDate]);

  const loadFestivals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
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
      const { data, error } = await supabase
        .from("festival_artists")
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
      const { data, error } = await supabase
        .from("festival_artists")
        .select("id, name, stage, date, show_start, show_end")
        .eq("job_id", selectedFestival)
        .eq("date", selectedSourceDate)
        .order("show_start", { ascending: true });

      if (error) throw error;
      setArtists(data || []);
      setSelectedArtists(data?.map(artist => artist.id) || []);
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
    setSelectedArtists([]);
    loadAvailableDates(festivalId);
  };

  const handleArtistToggle = (artistId: string) => {
    setSelectedArtists(prev => 
      prev.includes(artistId) 
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
    );
  };

  const handleSelectAll = () => {
    if (selectedArtists.length === artists.length) {
      setSelectedArtists([]);
    } else {
      setSelectedArtists(artists.map(artist => artist.id));
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
      const { data: artistsData, error: fetchError } = await supabase
        .from("festival_artists")
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
          // Reset times if option is selected
          show_start: copyOptions.resetTimes ? null : artistData.show_start,
          show_end: copyOptions.resetTimes ? null : artistData.show_end,
          soundcheck_start: copyOptions.resetTimes ? null : artistData.soundcheck_start,
          soundcheck_end: copyOptions.resetTimes ? null : artistData.soundcheck_end,
          // Reset stages if option is selected
          stage: copyOptions.resetStages ? 1 : artistData.stage,
          // Remove notes if option is not selected
          notes: copyOptions.copyNotes ? artistData.notes : null,
          // Keep or remove technical specs based on option
          foh_console: copyOptions.copyTechnicalSpecs ? artistData.foh_console : null,
          mon_console: copyOptions.copyTechnicalSpecs ? artistData.mon_console : null,
          monitors_from_foh: copyOptions.copyTechnicalSpecs ? artistData.monitors_from_foh : false,
          foh_waves_outboard: copyOptions.copyTechnicalSpecs ? artistData.foh_waves_outboard : null,
          mon_waves_outboard: copyOptions.copyTechnicalSpecs ? artistData.mon_waves_outboard : null,
          wireless_systems: copyOptions.copyTechnicalSpecs ? artistData.wireless_systems : [],
          iem_systems: copyOptions.copyTechnicalSpecs ? artistData.iem_systems : [],
          wired_mics: copyOptions.copyTechnicalSpecs ? artistData.wired_mics : []
        };
      }) || [];

      // Insert copied artists
      const { error: insertError } = await supabase
        .from("festival_artists")
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Copiar artistas de otro festival
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Festival Selection */}
          <div className="space-y-2">
            <Label>Seleccionar festival de origen</Label>
            <Select onValueChange={handleFestivalChange} disabled={isLoading}>
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

          {/* Date Selection */}
          {selectedFestival && availableDates.length > 0 && (
            <div className="space-y-2">
              <Label>Seleccionar fecha de origen</Label>
              <Select onValueChange={setSelectedSourceDate}>
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

          {/* Copy Options */}
          {artists.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Opciones de copia</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="resetTimes"
                    checked={copyOptions.resetTimes}
                    onCheckedChange={(checked) =>
                      setCopyOptions(prev => ({ ...prev, resetTimes: !!checked }))
                    }
                    className="mt-1"
                  />
                  <Label htmlFor="resetTimes" className="text-sm leading-normal cursor-pointer">Restablecer horarios del show</Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="resetStages"
                    checked={copyOptions.resetStages}
                    onCheckedChange={(checked) =>
                      setCopyOptions(prev => ({ ...prev, resetStages: !!checked }))
                    }
                    className="mt-1"
                  />
                  <Label htmlFor="resetStages" className="text-sm leading-normal cursor-pointer">Restablecer a Stage 1</Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="copyNotes"
                    checked={copyOptions.copyNotes}
                    onCheckedChange={(checked) =>
                      setCopyOptions(prev => ({ ...prev, copyNotes: !!checked }))
                    }
                    className="mt-1"
                  />
                  <Label htmlFor="copyNotes" className="text-sm leading-normal cursor-pointer">Copiar notas</Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="copyTechnicalSpecs"
                    checked={copyOptions.copyTechnicalSpecs}
                    onCheckedChange={(checked) =>
                      setCopyOptions(prev => ({ ...prev, copyTechnicalSpecs: !!checked }))
                    }
                    className="mt-1"
                  />
                  <Label htmlFor="copyTechnicalSpecs" className="text-sm leading-normal cursor-pointer">Copiar especificaciones técnicas</Label>
                </div>
              </div>
            </div>
          )}

          {/* Artist Selection */}
          {artists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  Seleccionar artistas ({selectedArtists.length}/{artists.length})
                </Label>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedArtists.length === artists.length ? "Deseleccionar todo" : "Seleccionar todo"}
                </Button>
              </div>
              
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                {artists.map(artist => (
                  <div
                    key={artist.id}
                    className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md"
                  >
                    <Checkbox
                      id={artist.id}
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
                  </div>
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
        </div>

        <DialogFooter>
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
