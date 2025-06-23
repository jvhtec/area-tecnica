import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, FileText, Loader2, Mic } from "lucide-react";
import { format, parseISO, isAfter, setHours, setMinutes } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  mon_console: string;
  wireless_systems: any[];
  iem_systems: any[];
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  notes?: string;
  rider_missing?: boolean;
  mic_kit?: 'festival' | 'band';
  wired_mics?: Array<{ model: string; quantity: number; notes?: string }>;
}

interface ArtistTableProps {
  artists: Artist[];
  isLoading: boolean;
  onEditArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => void;
  searchTerm: string;
  stageFilter: string;
  equipmentFilter: string;
  riderFilter: string;
  dayStartTime: string;
}

export const ArtistTable = ({
  artists,
  isLoading,
  onEditArtist,
  onDeleteArtist,
  searchTerm,
  stageFilter,
  equipmentFilter,
  riderFilter,
  dayStartTime
}: ArtistTableProps) => {
  const [deletingArtistId, setDeletingArtistId] = useState<string | null>(null);

  // Filtering logic
  const isTimeAfterDayStart = (time: string, date: string) => {
    const [hours, minutes] = dayStartTime.split(':').map(Number);
    const dayStart = setHours(setMinutes(parseISO(date), minutes), hours);
    const artistTime = parseISO(`${date}T${time}`);
    return isAfter(artistTime, dayStart);
  };

  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === "all" || artist.stage?.toString() === stageFilter;
    const matchesEquipment = !equipmentFilter || 
      artist.foh_console.toLowerCase().includes(equipmentFilter.toLowerCase()) ||
      artist.mon_console.toLowerCase().includes(equipmentFilter.toLowerCase()) ||
      (artist.wired_mics && artist.wired_mics.some(mic => 
        mic.model.toLowerCase().includes(equipmentFilter.toLowerCase())
      ));
    const matchesRider = riderFilter === "all" || 
      (riderFilter === "missing" && artist.rider_missing) ||
      (riderFilter === "complete" && !artist.rider_missing);

    return matchesSearch && matchesStage && matchesEquipment && matchesRider;
  });

  const handleDeleteClick = async (artist: Artist) => {
    if (window.confirm(`Are you sure you want to delete ${artist.name}?`)) {
      setDeletingArtistId(artist.id);
      await onDeleteArtist(artist);
      setDeletingArtistId(null);
    }
  };

  const formatWiredMics = (mics: Array<{ model: string; quantity: number }> = []) => {
    if (mics.length === 0) return "None";
    return mics.map(mic => `${mic.quantity}x ${mic.model}`).join(", ");
  };

  // Sorting logic
  const sortedArtists = [...filteredArtists].sort((a, b) => {
    const aDateTime = parseISO(`${a.date}T${a.show_start}`);
    const bDateTime = parseISO(`${b.date}T${b.show_end}`);
    return aDateTime.getTime() - bDateTime.getTime();
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading artists...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artist Schedule ({filteredArtists.length} artists)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artist</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Show Time</TableHead>
                <TableHead>Soundcheck</TableHead>
                <TableHead>Consoles</TableHead>
                <TableHead>Wireless/IEM</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Mic className="h-4 w-4" />
                    Microphones
                  </div>
                </TableHead>
                <TableHead>Monitors</TableHead>
                <TableHead>Extras</TableHead>
                <TableHead>Rider</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedArtists.map((artist) => (
                <TableRow key={artist.id}>
                  {/* Artist name, stage, show time, soundcheck cells */}
                  <TableCell>
                    <div className="font-medium">{artist.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Stage {artist.stage}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {artist.show_start} - {artist.show_end}
                    </div>
                  </TableCell>
                  <TableCell>
                    {artist.soundcheck ? (
                      <div className="text-sm">
                        <Badge variant="secondary">Yes</Badge>
                        <div className="text-xs text-muted-foreground">
                          {artist.soundcheck_start} - {artist.soundcheck_end}
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  
                  {/* Consoles, wireless/iem cells */}
                  <TableCell>
                    <div className="text-sm space-y-1">
                      <div>FOH: {artist.foh_console || "Not specified"}</div>
                      <div>MON: {artist.mon_console || "Not specified"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {artist.wireless_systems && artist.wireless_systems.length > 0 && (
                        <div>Wireless: {artist.wireless_systems.length} systems</div>
                      )}
                      {artist.iem_systems && artist.iem_systems.length > 0 && (
                        <div>IEM: {artist.iem_systems.length} systems</div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm space-y-1">
                      <Badge variant={artist.mic_kit === 'festival' ? 'default' : 'secondary'}>
                        {artist.mic_kit === 'festival' ? 'Festival' : 'Band'}
                      </Badge>
                      {artist.mic_kit === 'festival' && artist.wired_mics && artist.wired_mics.length > 0 && (
                        <div className="text-xs text-muted-foreground max-w-32 truncate" title={formatWiredMics(artist.wired_mics)}>
                          {formatWiredMics(artist.wired_mics)}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Monitors, extras, rider, actions cells */}
                  <TableCell>
                    {artist.monitors_enabled ? (
                      <div className="text-sm">
                        <Badge variant="secondary">{artist.monitors_quantity}x</Badge>
                      </div>
                    ) : (
                      <Badge variant="outline">None</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {artist.extras_sf && <Badge variant="outline" className="text-xs">SF</Badge>}
                      {artist.extras_df && <Badge variant="outline" className="text-xs">DF</Badge>}
                      {artist.extras_djbooth && <Badge variant="outline" className="text-xs">DJ</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={artist.rider_missing ? "destructive" : "default"}>
                      {artist.rider_missing ? "Missing" : "Complete"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditArtist(artist)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(artist)}
                        disabled={deletingArtistId === artist.id}
                      >
                        {deletingArtistId === artist.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredArtists.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            No artists found matching the current filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
