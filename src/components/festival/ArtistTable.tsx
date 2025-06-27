import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";
import { exportArtistTablePDF, ArtistTablePdfData } from "@/utils/artistTablePdfExport";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { GearMismatchIndicator } from "./GearMismatchIndicator";
import { compareArtistRequirements, ArtistGearComparison } from "@/utils/gearComparisonService";
import { FestivalGearSetup, StageGearSetup } from "@/types/festival";

interface Artist {
  id: string;
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
  date?: string; // Added missing date property
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

interface ArtistTableProps {
  artists: Artist[];
  jobTitle?: string;
  date: string;
  onArtistClick: (artist: Artist) => void;
  jobId?: string;
  stageNames?: Record<number, string>;
}

const formatTime = (timeString: string | undefined): string => {
  if (!timeString) return '';
  const [hour, minute] = timeString.split(':');
  const hourInt = parseInt(hour, 10);
  const period = hourInt < 12 ? 'AM' : 'PM';
  const formattedHour = hourInt % 12 === 0 ? 12 : hourInt % 12;
  return `${formattedHour}:${minute} ${period}`;
};

const ArtistTable = ({ 
  artists, 
  jobTitle, 
  date, 
  onArtistClick, 
  jobId, 
  stageNames 
}: ArtistTableProps) => {
  const [gearComparisons, setGearComparisons] = useState<Record<string, ArtistGearComparison>>({});
  const [festivalGearSetup, setFestivalGearSetup] = useState<FestivalGearSetup | null>(null);
  const [stageGearSetups, setStageGearSetups] = useState<Record<number, StageGearSetup>>({});

  useEffect(() => {
    const fetchGearSetups = async () => {
      if (!jobId) return;

      try {
        // Fetch main festival gear setup
        const { data: mainSetup, error: mainError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (mainError && mainError.code !== 'PGRST116') {
          console.error('Error fetching festival gear setup:', mainError);
        } else {
          setFestivalGearSetup(mainSetup);

          if (mainSetup) {
            // Fetch stage-specific gear setups
            const { data: stageSetups, error: stageError } = await supabase
              .from('festival_stage_gear_setups')
              .select('*')
              .eq('gear_setup_id', mainSetup.id);

            if (stageError) {
              console.error('Error fetching stage gear setups:', stageError);
            } else {
              const stageSetupsMap: Record<number, StageGearSetup> = {};
              stageSetups?.forEach(setup => {
                stageSetupsMap[setup.stage_number] = setup;
              });
              setStageGearSetups(stageSetupsMap);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching gear setups:', error);
      }
    };

    fetchGearSetups();
  }, [jobId]);

  useEffect(() => {
    const runGearComparisons = async () => {
      if (!artists || artists.length === 0) return;

      const comparisons: Record<string, ArtistGearComparison> = {};

      for (const artist of artists) {
        const stageSetup = stageGearSetups[artist.stage] || null;
        const gearComparison = compareArtistRequirements(artist, festivalGearSetup, stageSetup);
        comparisons[artist.id] = gearComparison;
      }

      setGearComparisons(comparisons);
    };

    runGearComparisons();
  }, [artists, festivalGearSetup, stageGearSetups]);

  const handleExportPDF = async () => {
    if (!artists || artists.length === 0) {
      toast.error("No artists to export.");
      return;
    }

    const tableData: ArtistTablePdfData = {
      jobTitle: jobTitle || 'Festival Schedule',
      date: date,
      artists: artists.map(artist => ({
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
      }),
    };

    try {
      const blob = await exportArtistTablePDF(tableData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'artist_schedule.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Artist schedule PDF generated successfully.");
    } catch (error) {
      console.error("Error generating artist schedule PDF:", error);
      toast.error("Failed to generate PDF.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artist Schedule - {date}</CardTitle>
      </CardHeader>
      <CardContent className="relative overflow-auto">
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((artist) => (
            <div key={artist.id} className="border rounded-md p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onArtistClick(artist)}>
              <h3 className="text-lg font-semibold">{artist.name}</h3>
              <p className="text-sm text-gray-500">Stage: {stageNames?.[artist.stage] || `Stage ${artist.stage}`}</p>
              <p className="text-sm">Show Time: {formatTime(artist.show_start)} - {formatTime(artist.show_end)}</p>
              {gearComparisons[artist.id] && (
                <div className="mt-2">
                  <GearMismatchIndicator mismatches={gearComparisons[artist.id].mismatches} compact={true} />
                </div>
              )}
            </div>
          ))}
        </div>
        {/* <Button onClick={handleExportPDF} className="absolute top-2 right-2">
          <FileText className="mr-2 h-4 w-4" />
          Export to PDF
        </Button> */}
      </CardContent>
    </Card>
  );
};

export default ArtistTable;
