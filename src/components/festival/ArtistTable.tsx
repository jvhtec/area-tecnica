
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Pencil, 
  Trash2, 
  FileText, 
  Loader2, 
  Mic, 
  Link, 
  ExternalLink,
  Upload,
  Printer
} from "lucide-react";
import { format, parseISO, isAfter, setHours, setMinutes } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArtistFormLinkDialog } from "./ArtistFormLinkDialog";
import { ArtistFormLinksDialog } from "./ArtistFormLinksDialog";
import { ArtistFileDialog } from "./ArtistFileDialog";
import { ArtistTablePrintDialog } from "./ArtistTablePrintDialog";

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
  foh_console_provided_by?: string;
  mon_console: string;
  mon_console_provided_by?: string;
  wireless_systems: any[];
  wireless_provided_by?: string;
  iem_systems: any[];
  iem_provided_by?: string;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  notes?: string;
  rider_missing?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  isaftermidnight?: boolean;
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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);

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

  const formatWirelessSystems = (systems: any[] = [], isIEM = false) => {
    if (systems.length === 0) return "None";
    
    return systems.map(system => {
      if (isIEM) {
        // For IEM: show channels and beltpacks
        const channels = system.quantity_hh || system.quantity || 0;
        const beltpacks = system.quantity_bp || 0;
        return `${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ''}`;
      } else {
        // For wireless: show HH and BP
        const hh = system.quantity_hh || 0;
        const bp = system.quantity_bp || 0;
        const total = hh + bp;
        if (hh > 0 && bp > 0) {
          return `${system.model}: ${hh}x HH, ${bp}x BP`;
        } else if (total > 0) {
          return `${system.model}: ${total}x`;
        }
        return system.model;
      }
    }).join("; ");
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      festival: "bg-blue-100 text-blue-800",
      band: "bg-green-100 text-green-800",
      artist: "bg-orange-100 text-orange-800"
    };
    return colors[provider as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const handleGenerateLink = (artist: Artist) => {
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

  const handlePrintArtist = (artist: Artist) => {
    setSelectedArtist(artist);
    setPrintDialogOpen(true);
  };

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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Artist Schedule ({filteredArtists.length} artists)</span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleViewLinks}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View All Links
              </Button>
            </div>
          </CardTitle>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArtists.map((artist) => (
                  <TableRow key={artist.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{artist.name}</div>
                        {artist.isaftermidnight && (
                          <Badge variant="outline" className="text-xs">After Midnight</Badge>
                        )}
                      </div>
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
                    
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <span>FOH: {artist.foh_console || "Not specified"}</span>
                          {artist.foh_console_provided_by && (
                            <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.foh_console_provided_by)}`}>
                              {artist.foh_console_provided_by}
                            </Badge>
                          )}
                          {artist.foh_tech && <Badge variant="outline" className="text-xs">Tech</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>MON: {artist.mon_console || "Not specified"}</span>
                          {artist.mon_console_provided_by && (
                            <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.mon_console_provided_by)}`}>
                              {artist.mon_console_provided_by}
                            </Badge>
                          )}
                          {artist.mon_tech && <Badge variant="outline" className="text-xs">Tech</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {artist.wireless_systems && artist.wireless_systems.length > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="text-xs" title={formatWirelessSystems(artist.wireless_systems)}>
                              Wireless: {formatWirelessSystems(artist.wireless_systems)}
                            </div>
                            {artist.wireless_provided_by && (
                              <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.wireless_provided_by)}`}>
                                {artist.wireless_provided_by}
                              </Badge>
                            )}
                          </div>
                        )}
                        {artist.iem_systems && artist.iem_systems.length > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="text-xs" title={formatWirelessSystems(artist.iem_systems, true)}>
                              IEM: {formatWirelessSystems(artist.iem_systems, true)}
                            </div>
                            {artist.iem_provided_by && (
                              <Badge variant="outline" className={`text-xs ${getProviderBadge(artist.iem_provided_by)}`}>
                                {artist.iem_provided_by}
                              </Badge>
                            )}
                          </div>
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleGenerateLink(artist)}
                          title="Generate form link"
                        >
                          <Link className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManageFiles(artist)}
                          title="Manage files/riders"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintArtist(artist)}
                          title="Print artist details"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditArtist(artist)}
                          title="Edit artist"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(artist)}
                          disabled={deletingArtistId === artist.id}
                          title="Delete artist"
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

      {selectedArtist && (
        <>
          <ArtistFormLinkDialog
            open={linkDialogOpen}
            onOpenChange={setLinkDialogOpen}
            artist={selectedArtist}
          />
          
          <ArtistFileDialog
            open={fileDialogOpen}
            onOpenChange={setFileDialogOpen}
            artistId={selectedArtist.id}
          />
          
          <ArtistTablePrintDialog
            open={printDialogOpen}
            onOpenChange={setPrintDialogOpen}
            jobDates={[new Date(selectedArtist.date)]}
            selectedDate={selectedArtist.date}
            onDateChange={() => {}}
            onStageChange={() => {}}
            onPrint={() => {
              // Implementation for individual artist print
              console.log('Print artist:', selectedArtist);
              setPrintDialogOpen(false);
            }}
            isLoading={false}
          />
        </>
      )}

      <ArtistFormLinksDialog
        open={linksDialogOpen}
        onOpenChange={setLinksDialogOpen}
      />
    </>
  );
};
