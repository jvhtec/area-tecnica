import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { exportArtistTablePDF, ArtistTablePdfData } from "@/utils/artistTablePdfExport";
import { sortArtistsChronologically } from "@/utils/artistSorting";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { compareArtistRequirements, calculateEquipmentNeeds } from "@/utils/gearComparisonService";
import { supabase } from "@/lib/supabase";
import { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import { Checkbox } from "@/components/ui/checkbox";
import { buildReadableFilename } from "@/utils/fileName";

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
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  wireless_systems: any[];
  wireless_provided_by?: 'festival' | 'band' | 'mixed';
  iem_systems: any[];
  iem_provided_by?: 'festival' | 'band' | 'mixed';
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
  job_id?: string;
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
  infrastructure_provided_by?: 'festival' | 'band' | 'mixed';
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
  const [includeGearConflicts, setIncludeGearConflicts] = useState(false);

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
    console.log('ArtistTablePrintDialog handleTablePrint called');
    console.log('Artists received:', artists.length);
    console.log('Selected date:', selectedDate);
    console.log('Stage filter:', stageFilter);
    console.log('Include gear conflicts:', includeGearConflicts);
    
    setIsGenerating(true);
    
    try {
      // Filter artists based on selected criteria
      // Since artists are already filtered by date in the parent component,
      // we mainly need to filter by stage
      const filteredArtists = artists.filter(artist => {
        const matchesStage = stageFilter === 'all' || !stageFilter || artist.stage?.toString() === stageFilter;
        console.log(`Artist ${artist.name}: stage=${artist.stage}, filter=${stageFilter}, matches=${matchesStage}`);
        return matchesStage;
      });

      // Sort artists chronologically using the shared utility
      const sortedArtists = sortArtistsChronologically(filteredArtists as any) as Artist[];

      console.log('Filtered artists count:', filteredArtists.length);
      
      if (filteredArtists.length === 0) {
        console.warn('No artists match the filter criteria');
        toast.error('No se encontraron artistas para los criterios seleccionados');
        return;
      }

      console.log('Sample filtered artist:', filteredArtists[0]);

      // Fetch gear setup data for comparison
      let festivalGearSetup: FestivalGearSetup | null = null;
      const stageGearSetups: Record<number, StageGearSetup> = {};

      if (jobId) {
        try {
          const { data: mainSetup, error: mainError } = await supabase
            .from('festival_gear_setups')
            .select('*')
            .eq('job_id', jobId)
            .single();

          if (mainError && mainError.code !== 'PGRST116') {
            console.error('Error fetching festival gear setup:', mainError);
          } else {
            festivalGearSetup = mainSetup;

            if (mainSetup) {
              const { data: stageSetups, error: stageError } = await supabase
                .from('festival_stage_gear_setups')
                .select('*')
                .eq('gear_setup_id', mainSetup.id);

              if (stageError) {
                console.error('Error fetching stage gear setups:', stageError);
              } else {
                stageSetups?.forEach(setup => {
                  stageGearSetups[setup.stage_number] = setup;
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching gear setups:', error);
        }
      }

      // Transform artists data for PDF
      const transformedArtists = sortedArtists.map(artist => {
        console.log(`Transforming artist: ${artist.name}`, {
          micKit: artist.mic_kit,
          wiredMics: artist.wired_mics?.length || 0,
          infrastructure: {
            cat6: artist.infra_cat6,
            hma: artist.infra_hma,
            coax: artist.infra_coax,
            opticalcon: artist.infra_opticalcon_duo,
            analog: artist.infra_analog
          },
          riderMissing: artist.rider_missing
        });

        // Run gear comparison for this artist
        const stageSetup = stageGearSetups[artist.stage] || null;
        
        // Transform artist to match ArtistRequirements interface with proper type casting
        const artistRequirements = {
          name: artist.name,
          stage: artist.stage,
          foh_console: artist.foh_console,
          foh_console_provided_by: (artist.foh_console_provided_by as 'festival' | 'band' | 'mixed') || 'festival',
          mon_console: artist.mon_console,
          mon_console_provided_by: (artist.mon_console_provided_by as 'festival' | 'band' | 'mixed') || 'festival',
          wireless_systems: artist.wireless_systems || [],
          wireless_provided_by: (artist.wireless_provided_by as 'festival' | 'band' | 'mixed') || 'festival',
          iem_systems: artist.iem_systems || [],
          iem_provided_by: (artist.iem_provided_by as 'festival' | 'band' | 'mixed') || 'festival',
          monitors_enabled: artist.monitors_enabled,
          monitors_quantity: artist.monitors_quantity,
          extras_sf: artist.extras_sf,
          extras_df: artist.extras_df,
          extras_djbooth: artist.extras_djbooth,
          infra_cat6: artist.infra_cat6 || false,
          infra_cat6_quantity: artist.infra_cat6_quantity || 0,
          infra_hma: artist.infra_hma || false,
          infra_hma_quantity: artist.infra_hma_quantity || 0,
          infra_coax: artist.infra_coax || false,
          infra_coax_quantity: artist.infra_coax_quantity || 0,
          infra_opticalcon_duo: artist.infra_opticalcon_duo || false,
          infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity || 0,
          infra_analog: artist.infra_analog || 0,
          infrastructure_provided_by: (artist.infrastructure_provided_by as 'festival' | 'band' | 'mixed') || 'festival',
          mic_kit: artist.mic_kit || 'band',
          wired_mics: artist.wired_mics || []
        };
        
        const gearComparison = compareArtistRequirements(artistRequirements, festivalGearSetup, stageSetup);

        return {
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
          riderMissing: artist.rider_missing || false,
          gearMismatches: gearComparison.mismatches
        };
      });

      const pdfData: ArtistTablePdfData = {
        jobTitle: jobTitle || 'Cronograma del festival',
        date: selectedDate,
        stage: stageFilter !== 'all' ? stageFilter : undefined,
        stageNames: stageNames,
        artists: transformedArtists,
        logoUrl: logoUrl,
        includeGearConflicts: includeGearConflicts
      };

      console.log('PDF data structure:', {
        jobTitle: pdfData.jobTitle,
        date: pdfData.date,
        stage: pdfData.stage,
        artistCount: pdfData.artists.length,
        logoUrl: !!pdfData.logoUrl,
        sampleArtist: pdfData.artists[0],
        artistsWithGearIssues: pdfData.artists.filter(a => a.gearMismatches && a.gearMismatches.length > 0).length,
        includeGearConflicts: pdfData.includeGearConflicts
      });

      console.log('Calling exportArtistTablePDF...');
      const blob = await exportArtistTablePDF(pdfData);
      console.log('PDF blob generated successfully, size:', blob.size);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stageName =
        stageFilter && stageFilter !== 'all'
          ? (stageNames?.[parseInt(stageFilter)] || `Escenario ${stageFilter}`)
          : '';
      a.download = buildReadableFilename(["Cronograma artistas", selectedDate, stageName]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);


      toast.success('PDF del cronograma de artistas generado exitosamente');
      setDialogOpen(false);
    } catch (error) {
      console.error('Error generating artist schedule PDF:', error);
      console.error('Error stack:', error.stack);
      toast.error('Error al generar PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[425px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Imprimir cronograma de artistas</DialogTitle>
          <DialogDescription>
            Generar un PDF del cronograma de artistas actual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label htmlFor="name" className="sm:text-right">
              Título del trabajo
            </Label>
            <Input id="name" value={jobTitle || 'Cronograma del festival'} className="sm:col-span-3" disabled />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label htmlFor="username" className="sm:text-right">
              Fecha
            </Label>
            <Input id="username" value={selectedDate} className="sm:col-span-3" disabled />
          </div>
          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="gear-conflicts"
              checked={includeGearConflicts}
              onCheckedChange={(checked) => {
                setIncludeGearConflicts(checked === true);
              }}
              className="mt-1"
            />
            <Label htmlFor="gear-conflicts" className="text-sm font-medium leading-normal cursor-pointer">
              Incluir resumen de conflictos de equipo
            </Label>
          </div>
        </div>
        <Button onClick={handleTablePrint} disabled={isGenerating || isLoading} className="w-full">
          {(isGenerating || isLoading) ? (
            <>
              Generando <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </>
          ) : (
            "Generar PDF"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
