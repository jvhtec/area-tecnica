import { CalendarIcon, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFestivalDayKey, formatFestivalInstant } from "@/features/festival-management/dateFormatting";
import type { CopyCandidateArtist, CopySourceFestival } from "@/features/festival-artists/api";

interface CopyBrowseTabProps {
  festivals: CopySourceFestival[];
  isLoading: boolean;
  selectedFestival: string;
  onFestivalChange: (festivalId: string) => void;
  availableDates: string[];
  selectedSourceDate: string;
  onSourceDateChange: (date: string) => void;
  artists: CopyCandidateArtist[];
  selectedIds: string[];
  onToggle: (artistId: string) => void;
  onToggleAll: () => void;
}

/** Browse by festival, then by date, then pick artists (the original copy flow). */
export const CopyBrowseTab = ({
  festivals,
  isLoading,
  selectedFestival,
  onFestivalChange,
  availableDates,
  selectedSourceDate,
  onSourceDateChange,
  artists,
  selectedIds,
  onToggle,
  onToggleAll,
}: CopyBrowseTabProps) => {
  const allSelected = artists.length > 0 && artists.every((artist) => selectedIds.includes(artist.id));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Seleccionar festival de origen</Label>
        <Select onValueChange={onFestivalChange} disabled={isLoading} value={selectedFestival}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Elegir festival del que copiar..." />
          </SelectTrigger>
          <SelectContent>
            {festivals.map((festival) => (
              <SelectItem key={festival.id} value={festival.id}>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{festival.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {formatFestivalInstant(festival.start_time, "MMM yyyy")}
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
          <Select onValueChange={onSourceDateChange} value={selectedSourceDate}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Elegir fecha..." />
            </SelectTrigger>
            <SelectContent>
              {availableDates.map((date) => (
                <SelectItem key={date} value={date}>
                  {formatFestivalDayKey(date, "EEEE, d 'de' MMMM 'de' yyyy", date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {artists.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Artistas de la fecha</Label>
            <Button variant="outline" size="sm" onClick={onToggleAll}>
              {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
            {artists.map((artist) => (
              <label
                key={artist.id}
                htmlFor={`browse-${artist.id}`}
                className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
              >
                <Checkbox
                  id={`browse-${artist.id}`}
                  checked={selectedIds.includes(artist.id)}
                  onCheckedChange={() => onToggle(artist.id)}
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
    </div>
  );
};
