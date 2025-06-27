import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/enhanced-supabase-client";
import { format } from "date-fns";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { exportArtistPDF } from "@/utils/artistPdfExport";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { compareArtistRequirements } from "@/utils/gearComparisonService";
import { GearMismatchIndicator } from "@/components/festival/GearMismatchIndicator";
import { FestivalGearSetup, StageGearSetup } from "@/types/festival";

interface Artist {
  id: string;
  created_at: string;
  name: string;
  stage: number;
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
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
  date?: string;
  // Infrastructure fields
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
  infrastructure_provided_by?: string;
}

interface ArtistRequirements {
  name: string;
  stage: number;
  foh_console: string;
  mon_console: string;
  wireless_systems: any[];
  iem_systems: any[];
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  infra_cat6: boolean;
  infra_cat6_quantity: number;
  infra_hma: boolean;
  infra_hma_quantity: number;
  infra_coax: boolean;
  infra_coax_quantity: number;
  infra_opticalcon_duo: boolean;
  infra_opticalcon_duo_quantity: number;
  infra_analog: number;
}

export interface ArtistPdfData {
  name: string;
  stage: number;
  date: string;
  schedule: {
    show: { start: string; end: string };
    soundcheck?: { start: string; end: string };
  };
  technical: {
    fohTech: boolean;
    monTech: boolean;
    fohConsole: { model: string; providedBy: string };
    monConsole: { model: string; providedBy: string };
    wireless: {
      systems?: any[];
      model?: string;
      providedBy: string;
      handhelds?: number;
      bodypacks?: number;
      band?: string;
      hh?: number;
      bp?: number;
    };
    iem: {
      systems?: any[];
      model?: string;
      providedBy: string;
      quantity?: number;
      band?: string;
    };
    monitors: {
      enabled: boolean;
      quantity: number;
    };
  };
  infrastructure: {
    providedBy: string;
    cat6: { enabled: boolean; quantity: number };
    hma: { enabled: boolean; quantity: number };
    coax: { enabled: boolean; quantity: number };
    opticalconDuo: { enabled: boolean; quantity: number };
    analog: number;
    other: string;
  };
  extras: {
    sideFill: boolean;
    drumFill: boolean;
    djBooth: boolean;
    wired: string;
  };
  notes?: string;
  logoUrl?: string;
  wiredMics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
  micKit?: 'festival' | 'band' | 'mixed';
  riderMissing?: boolean;
}

interface ArtistTableProps {
  artists: Artist[];
  onEditArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => void;
  searchTerm: string;
  stageFilter: string;
  equipmentFilter: string;
  riderFilter: string;
  dayStartTime: string;
  jobId: string;
  selectedDate: string;
}

export const ArtistTable = ({ 
  artists, 
  onEditArtist, 
  onDeleteArtist, 
  searchTerm, 
  stageFilter, 
  equipmentFilter, 
  riderFilter, 
  dayStartTime,
  jobId,
  selectedDate 
}: ArtistTableProps) => {
  const { toast } = useToast();
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [artistToDelete, setArtistToDelete] = useState<Artist | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogo = async () => {
      if (jobId) {
        try {
          const url = await fetchJobLogo(jobId);
          setLogoUrl(url);
        } catch (error) {
          console.error('Error fetching logo:', error);
        }
      }
    };

    fetchLogo();
  }, [jobId]);

  const transformArtistToRequirements = (artist: Artist): ArtistRequirements => {
    return {
      name: artist.name,
      stage: artist.stage,
      foh_console: artist.foh_console || '',
      mon_console: artist.mon_console || '',
      wireless_systems: artist.wireless_systems || [],
      iem_systems: artist.iem_systems || [],
      monitors_enabled: artist.monitors_enabled || false,
      monitors_quantity: artist.monitors_quantity || 0,
      extras_sf: artist.extras_sf || false,
      extras_df: artist.extras_df || false,
      extras_djbooth: artist.extras_djbooth || false,
      infra_cat6: artist.infra_cat6 || false,
      infra_cat6_quantity: artist.infra_cat6_quantity || 0,
      infra_hma: artist.infra_hma || false,
      infra_hma_quantity: artist.infra_hma_quantity || 0,
      infra_coax: artist.infra_coax || false,
      infra_coax_quantity: artist.infra_coax_quantity || 0,
      infra_opticalcon_duo: artist.infra_opticalcon_duo || false,
      infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity || 0,
      infra_analog: artist.infra_analog || 0
    };
  };

  const { data: festivalGearSetup } = useMemo(() => {
    if (!jobId) return { data: null };
    return supabase
      .from('festival_gear_setups')
      .select('*')
      .eq('job_id', jobId)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching festival gear setup:', error);
          toast({
            title: "Error",
            description: "Could not fetch festival gear setup",
            variant: "destructive"
          });
        }
        return { data };
      });
  }, [jobId, toast]);

  const { data: stageGearSetups } = useMemo(() => {
    if (!festivalGearSetup?.id) return { data: {} };
    return supabase
      .from('festival_stage_gear_setups')
      .select('*')
      .eq('gear_setup_id', festivalGearSetup.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching stage gear setups:', error);
          toast({
            title: "Error",
            description: "Could not fetch stage gear setups",
            variant: "destructive"
          });
          return { data: {} };
        }
        const stageSetups: Record<number, StageGearSetup> = {};
        data?.forEach(setup => {
          stageSetups[setup.stage_number] = setup;
        });
        return { data: stageSetups };
      });
  }, [festivalGearSetup?.id, toast]);

  const artistsWithGearComparison = useMemo(() => {
    if (!artists.length) return [];
    
    return artists.map(artist => {
      const artistRequirements = transformArtistToRequirements(artist);
      
      const stageSetup = stageGearSetups?.data?.[artist.stage] || null;
      const gearComparison = compareArtistRequirements(artistRequirements, festivalGearSetup?.data, stageSetup);
      
      return {
        ...artist,
        gearMismatches: gearComparison.mismatches
      };
    });
  }, [artists, festivalGearSetup?.data, stageGearSetups?.data]);

  const filteredArtists = useMemo(() => {
    let filtered = [...artistsWithGearComparison];

    if (searchTerm) {
      filtered = filtered.filter(artist =>
        artist.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (stageFilter !== "all") {
      filtered = filtered.filter(artist => artist.stage.toString() === stageFilter);
    }

    if (equipmentFilter) {
      filtered = filtered.filter(artist => {
        const equipmentString = JSON.stringify(artist).toLowerCase();
        return equipmentString.includes(equipmentFilter.toLowerCase());
      });
    }

    if (riderFilter !== "all") {
      filtered = filtered.filter(artist =>
        riderFilter === "missing" ? artist.rider_missing : !artist.rider_missing
      );
    }

    return filtered;
  }, [artistsWithGearComparison, searchTerm, stageFilter, equipmentFilter, riderFilter]);

  const confirmDeleteArtist = (artist: Artist) => {
    setArtistToDelete(artist);
    setDeleteAlertOpen(true);
  };

  const cancelDeleteArtist = () => {
    setArtistToDelete(null);
    setDeleteAlertOpen(false);
  };

  const handleExportArtistPDF = async (artist: Artist) => {
    setIsExporting(true);
    try {
      const pdfData: ArtistPdfData = {
        name: artist.name,
        stage: artist.stage,
        date: selectedDate,
        schedule: {
          show: {
            start: artist.show_start,
            end: artist.show_end
          },
          soundcheck: artist.soundcheck ? {
            start: artist.soundcheck_start || '',
            end: artist.soundcheck_end || ''
          } : undefined
        },
        technical: {
          fohTech: artist.foh_tech || false,
          monTech: artist.mon_tech || false,
          fohConsole: {
            model: artist.foh_console,
            providedBy: artist.foh_console_provided_by || 'festival'
          },
          monConsole: {
            model: artist.mon_console,
            providedBy: artist.mon_console_provided_by || 'festival'
          },
          wireless: {
            systems: artist.wireless_systems || [],
            providedBy: artist.wireless_provided_by || 'festival'
          },
          iem: {
            systems: artist.iem_systems || [],
            providedBy: artist.iem_provided_by || 'festival'
          },
          monitors: {
            enabled: artist.monitors_enabled,
            quantity: artist.monitors_quantity
          }
        },
        infrastructure: {
          providedBy: artist.infrastructure_provided_by || 'festival',
          cat6: {
            enabled: artist.infra_cat6 || false,
            quantity: artist.infra_cat6_quantity || 0
          },
          hma: {
            enabled: artist.infra_hma || false,
            quantity: artist.infra_hma_quantity || 0
          },
          coax: {
            enabled: artist.infra_coax || false,
            quantity: artist.infra_coax_quantity || 0
          },
          opticalconDuo: {
            enabled: artist.infra_opticalcon_duo || false,
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
        notes: artist.notes,
        logoUrl: logoUrl,
        wiredMics: artist.wired_mics || [],
        micKit: artist.mic_kit || 'band',
        riderMissing: artist.rider_missing || false
      };
      const blob = await exportArtistPDF(pdfData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artist_${artist.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "PDF generated successfully"
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Could not generate PDF",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getAdjustedTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date(0, 0, 0, hours, minutes);
    const dayStart = parseInt(dayStartTime.split(':')[0]);
    let adjustedHours = hours;

    if (dayStart !== 0) {
      adjustedHours = hours < dayStart ? hours + 24 : hours;
    }

    const adjustedDate = new Date(0, 0, 0, adjustedHours, minutes);
    return adjustedDate;
  };

  const sortByTime = (a: Artist, b: Artist) => {
    const timeA = getAdjustedTime(a.show_start);
    const timeB = getAdjustedTime(b.show_start);
    return timeA.getTime() - timeB.getTime();
  };

  const sortedArtists = useMemo(() => {
    return [...filteredArtists].sort(sortByTime);
  }, [filteredArtists, dayStartTime]);

  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableCaption>A list of artists and their details.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Name</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Show Time</TableHead>
            <TableHead>Soundcheck</TableHead>
            <TableHead>FOH Console</TableHead>
            <TableHead>MON Console</TableHead>
            <TableHead>Wireless</TableHead>
            <TableHead>IEM</TableHead>
            <TableHead>Monitors</TableHead>
            <TableHead>Rider</TableHead>
            <TableHead className="text-center">Gear</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedArtists.map((artist) => (
            <TableRow key={artist.id}>
              <TableCell className="font-medium">{artist.name}</TableCell>
              <TableCell>{artist.stage}</TableCell>
              <TableCell>{artist.show_start} - {artist.show_end}</TableCell>
              <TableCell>
                {artist.soundcheck ? `${artist.soundcheck_start} - ${artist.soundcheck_end}` : 'No'}
              </TableCell>
              <TableCell>
                {artist.foh_console} ({artist.foh_console_provided_by})
                {artist.foh_tech ? <Badge className="ml-1">Tech</Badge> : null}
              </TableCell>
              <TableCell>
                {artist.mon_console} ({artist.mon_console_provided_by})
                {artist.mon_tech ? <Badge className="ml-1">Tech</Badge> : null}
              </TableCell>
              <TableCell>
                {artist.wireless_systems?.map((system: any) => (
                  <div key={system.id}>
                    {system.model} ({system.quantity_hh} HH, {system.quantity_bp} BP)
                  </div>
                ))}
              </TableCell>
              <TableCell>
                {artist.iem_systems?.map((system: any) => (
                  <div key={system.id}>
                    {system.model} ({system.quantity})
                  </div>
                ))}
              </TableCell>
              <TableCell>
                {artist.monitors_enabled ? artist.monitors_quantity : 'No'}
              </TableCell>
              <TableCell>
                {artist.rider_missing ? <Badge variant="destructive">Missing</Badge> : 'Complete'}
              </TableCell>
              <TableCell className="text-center">
                <GearMismatchIndicator mismatches={artist.gearMismatches || []} compact />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleExportArtistPDF(artist)} disabled={isExporting}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEditArtist(artist)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. Are you sure you want to delete {artist.name}?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelDeleteArtist}>Cancel</AlertDialogCancel>
                        <Button variant="destructive" onClick={() => confirmDeleteArtist(artist)}>Delete</Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={12}>
              {sortedArtists.length} Artists
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Are you sure you want to delete {artistToDelete?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteArtist}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => {
              if (artistToDelete) {
                onDeleteArtist(artistToDelete);
                setDeleteAlertOpen(false);
              }
            }}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
