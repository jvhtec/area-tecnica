
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Loader2, Mic, Headphones, FileText, Trash2, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ArtistFileDialog } from "./ArtistFileDialog";
import { cn } from "@/lib/utils";
import { ArtistPdfData, exportArtistPDF } from "@/utils/artistPdfExport";
import { useToast } from "@/hooks/use-toast";

interface ArtistTableProps {
  artists: any[];
  isLoading: boolean;
  onEditArtist: (artist: any) => void;
  onDeleteArtist: (artist: any) => void;
  searchTerm: string;
  stageFilter: string;
  equipmentFilter: string;
}

export const ArtistTable = ({ 
  artists, 
  isLoading, 
  onEditArtist,
  onDeleteArtist,
  searchTerm,
  stageFilter,
  equipmentFilter
}: ArtistTableProps) => {
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [selectedArtistForFiles, setSelectedArtistForFiles] = useState<string>("");
  const { toast } = useToast();

  const toggleRowExpansion = (artistId: string) => {
    setExpandedRows(prev => 
      prev.includes(artistId) 
        ? prev.filter(id => id !== artistId)
        : [...prev, artistId]
    );
  };

  const handleDeleteClick = (artist: any) => {
    setSelectedArtist(artist);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedArtist) {
      onDeleteArtist(selectedArtist);
    }
    setDeleteDialogOpen(false);
    setSelectedArtist(null);
  };

  const handlePrintArtist = async (artist: any) => {
    try {
      const artistData: ArtistPdfData = {
        name: artist.name,
        stage: artist.stage,
        date: artist.date,
        schedule: {
          show: {
            start: artist.show_start,
            end: artist.show_end
          },
          soundcheck: artist.soundcheck ? {
            start: artist.soundcheck_start,
            end: artist.soundcheck_end
          } : undefined
        },
        technical: {
          fohTech: artist.foh_tech,
          monTech: artist.mon_tech,
          fohConsole: {
            model: artist.foh_console,
            providedBy: artist.foh_console_provided_by
          },
          monConsole: {
            model: artist.mon_console,
            providedBy: artist.mon_console_provided_by
          },
          wireless: {
            model: artist.wireless_model,
            providedBy: artist.wireless_provided_by,
            handhelds: artist.wireless_quantity_hh,
            bodypacks: artist.wireless_quantity_bp,
            band: artist.wireless_band
          },
          iem: {
            model: artist.iem_model,
            providedBy: artist.iem_provided_by,
            quantity: artist.iem_quantity,
            band: artist.iem_band
          },
          monitors: {
            enabled: artist.monitors_enabled,
            quantity: artist.monitors_quantity || 0
          }
        },
        infrastructure: {
          providedBy: artist.infrastructure_provided_by,
          cat6: {
            enabled: artist.infra_cat6,
            quantity: artist.infra_cat6_quantity || 0
          },
          hma: {
            enabled: artist.infra_hma,
            quantity: artist.infra_hma_quantity || 0
          },
          coax: {
            enabled: artist.infra_coax,
            quantity: artist.infra_coax_quantity || 0
          },
          opticalconDuo: {
            enabled: artist.infra_opticalcon_duo,
            quantity: artist.infra_opticalcon_duo_quantity || 0
          },
          analog: artist.infra_analog || 0,
          other: artist.other_infrastructure || ''
        },
        extras: {
          sideFill: artist.extras_sf,
          drumFill: artist.extras_df,
          djBooth: artist.extras_djbooth,
          wired: artist.extras_wired || ''
        },
        notes: artist.notes
      };

      const blob = await exportArtistPDF(artistData);

      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artist.name}_technical_requirements.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = !stageFilter || artist.stage?.toString() === stageFilter;
    const matchesEquipment = !equipmentFilter || (
      (equipmentFilter === 'wireless' && (artist.wireless_quantity_hh > 0 || artist.wireless_quantity_bp > 0)) ||
      (equipmentFilter === 'iem' && artist.iem_quantity > 0) ||
      (equipmentFilter === 'monitors' && artist.monitors_enabled)
    );
    return matchesSearch && matchesStage && matchesEquipment;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!filteredArtists.length) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        No artists found matching the current filters.
      </div>
    );
  }

  const renderProviderBadge = (provider: string) => (
    <Badge variant={provider === 'festival' ? 'default' : 'secondary'}>
      {provider === 'festival' ? 'Festival' : 'Band'}
    </Badge>
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>Artist</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Show Time</TableHead>
            <TableHead>Soundcheck</TableHead>
            <TableHead>Technical Setup</TableHead>
            <TableHead>RF/IEM</TableHead>
            <TableHead>Files</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredArtists.map((artist) => (
            <>
              <TableRow key={artist.id} className={cn(expandedRows.includes(artist.id) && "bg-muted/50")}>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowExpansion(artist.id)}
                  >
                    {expandedRows.includes(artist.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="font-medium">{artist.name}</TableCell>
                <TableCell>{artist.stage}</TableCell>
                <TableCell>
                  {artist.show_start && format(new Date(`2000-01-01T${artist.show_start}`), 'HH:mm')} - 
                  {artist.show_end && format(new Date(`2000-01-01T${artist.show_end}`), 'HH:mm')}
                </TableCell>
                <TableCell>
                  {artist.soundcheck && (
                    <>
                      {artist.soundcheck_start && format(new Date(`2000-01-01T${artist.soundcheck_start}`), 'HH:mm')} - 
                      {artist.soundcheck_end && format(new Date(`2000-01-01T${artist.soundcheck_end}`), 'HH:mm')}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm gap-1">
                    <div className="flex items-center justify-between">
                      <span>FOH: {artist.foh_console}</span>
                      {renderProviderBadge(artist.foh_console_provided_by)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>MON: {artist.mon_console}</span>
                      {renderProviderBadge(artist.mon_console_provided_by)}
                    </div>
                    {artist.monitors_enabled && (
                      <span className="text-xs text-muted-foreground">
                        {artist.monitors_quantity} monitors
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    {(artist.wireless_quantity_hh > 0 || artist.wireless_quantity_bp > 0) && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1" title="Wireless Mics">
                          <Mic className="h-4 w-4" />
                          <span className="text-xs">
                            HH: {artist.wireless_quantity_hh} / BP: {artist.wireless_quantity_bp}
                          </span>
                        </div>
                        {renderProviderBadge(artist.wireless_provided_by)}
                      </div>
                    )}
                    {artist.iem_quantity > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1" title="IEM Systems">
                          <Headphones className="h-4 w-4" />
                          <span className="text-xs">{artist.iem_quantity}</span>
                        </div>
                        {renderProviderBadge(artist.iem_provided_by)}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedArtistForFiles(artist.id);
                      setFileDialogOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="text-xs">Manage</span>
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditArtist(artist)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(artist)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePrintArtist(artist)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedRows.includes(artist.id) && (
                <TableRow>
                  <TableCell colSpan={9} className="bg-muted/50">
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Infrastructure</h4>
                          <div className="space-y-2">
                            {artist.infra_cat6 && (
                              <div>CAT6: {artist.infra_cat6_quantity}</div>
                            )}
                            {artist.infra_hma && (
                              <div>HMA: {artist.infra_hma_quantity}</div>
                            )}
                            {artist.infra_coax && (
                              <div>Coax: {artist.infra_coax_quantity}</div>
                            )}
                            {artist.infra_opticalcon_duo && (
                              <div>OpticalCon Duo: {artist.infra_opticalcon_duo_quantity}</div>
                            )}
                            {artist.infra_analog > 0 && (
                              <div>Analog Lines: {artist.infra_analog}</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Extra Requirements</h4>
                          <div className="space-y-2">
                            {artist.extras_sf && <div>Side Fill</div>}
                            {artist.extras_df && <div>Drum Fill</div>}
                            {artist.extras_djbooth && <div>DJ Booth</div>}
                            {artist.extras_wired && (
                              <div>Additional Wired: {artist.extras_wired}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      {artist.notes && (
                        <div>
                          <h4 className="font-medium mb-2">Notes</h4>
                          <p className="text-sm text-muted-foreground">{artist.notes}</p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this artist? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ArtistFileDialog
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        artistId={selectedArtistForFiles}
      />
    </>
  );
};

