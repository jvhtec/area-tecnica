
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { exportArtistTablePDF, ArtistTablePdfData } from "@/utils/artistTablePdfExport";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";

interface Artist {
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
  mic_kit?: 'festival' | 'band';
  wired_mics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
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

interface ArtistTablePrintDialogProps {
  artists: Artist[];
  jobTitle?: string;
  selectedDate: string;
  stageFilter: string;
  jobId?: string;
  stageNames?: Record<number, string>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  jobDates?: Date[];
  onDateChange?: (date: string) => void;
  onStageChange?: (stage: string) => void;
  onPrint?: () => Promise<void>;
  isLoading?: boolean;
}

export const ArtistTablePrintDialog = ({
  artists,
  jobTitle,
  selectedDate,
  stageFilter,
  jobId,
  stageNames,
  open,
  onOpenChange,
  jobDates,
  onDateChange,
  onStageChange,
  onPrint,
  isLoading
}: ArtistTablePrintDialogProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  // Use external open state if provided, otherwise use internal state
  const dialogOpen = open !== undefined ? open : isDialogOpen;
  const setDialogOpen = onOpenChange || setIsDialogOpen;

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

  const handleTablePrint = async () => {
    if (onPrint) {
      await onPrint();
      return;
    }

    setIsGenerating(true);
    
    try {
      // Transform artists data for PDF
      const transformedArtists = artists.map(artist => ({
        name: artist.name,
        stage: artist.stage,
        showTime: {
          start: artist.show_start,
          end: artist.show_end
        },
        soundcheck: artist.soundcheck ? {
          start: artist.soundcheck_start || '',
          end: artist.soundcheck_end || ''
        } : undefined,
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
        extras: {
          sideFill: artist.extras_sf,
          drumFill: artist.extras_df,
          djBooth: artist.extras_djbooth
        },
        notes: artist.notes,
        // Add missing fields
        micKit: artist.mic_kit || 'band',
        wiredMics: artist.wired_mics || [],
        infrastructure: {
          infra_cat6: artist.infra_cat6,
          infra_cat6_quantity: artist.infra_cat6_quantity,
          infra_hma: artist.infra_hma,
          infra_hma_quantity: artist.infra_hma_quantity,
          infra_coax: artist.infra_coax,
          infra_coax_quantity: artist.infra_coax_quantity,
          infra_opticalcon_duo: artist.infra_opticalcon_duo,
          infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity,
          infra_analog: artist.infra_analog,
          other_infrastructure: artist.other_infrastructure,
          infrastructure_provided_by: artist.infrastructure_provided_by
        },
        riderMissing: artist.rider_missing || false
      }));

      const pdfData: ArtistTablePdfData = {
        jobTitle: jobTitle || 'Festival Schedule',
        date: selectedDate,
        stage: stageFilter !== 'all' ? stageFilter : undefined,
        stageNames: stageNames,
        artists: transformedArtists,
        logoUrl: logoUrl
      };

      const blob = await exportArtistTablePDF(pdfData);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Artist_Schedule_${selectedDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Artist schedule PDF generated successfully');
    } catch (error) {
      console.error('Error generating artist schedule PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          Print Table
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Print Artist Schedule</DialogTitle>
          <DialogDescription>
            Generate a PDF of the current artist schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Job Title
            </Label>
            <Input id="name" value={jobTitle || 'Festival Schedule'} className="col-span-3" disabled />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Date
            </Label>
            <Input id="username" value={selectedDate} className="col-span-3" disabled />
          </div>
        </div>
        <Button onClick={handleTablePrint} disabled={isGenerating || isLoading}>
          {(isGenerating || isLoading) ? (
            <>
              Generating <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </>
          ) : (
            "Generate PDF"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
