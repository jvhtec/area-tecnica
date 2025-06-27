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

interface ArtistTableProps {
  artists: Artist[];
  isLoading: boolean;
  onEditArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => Promise<void>;
  searchTerm: string;
  stageFilter: string;
  equipmentFilter: string;
  riderFilter: string;
  dayStartTime: string;
  jobId?: string;
  selectedDate: string;
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
  isLoading,
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

  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'all' || artist.stage.toString() === stageFilter;
    const matchesEquipment = !equipmentFilter || 
      artist.foh_console.toLowerCase().includes(equipmentFilter.toLowerCase()) ||
      artist.mon_console.toLowerCase().includes(equipmentFilter.toLowerCase());
    const matchesRider = riderFilter === 'all' || 
      (riderFilter === 'missing' && artist.rider_missing) ||
      (riderFilter === 'complete' && !artist.rider_missing);
    
    return matchesSearch && matchesStage && matchesEquipment && matchesRider;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading artists...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="relative overflow-auto">
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArtists.map((artist) => (
            <div key={artist.id} className="border rounded-md p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div onClick={() => onEditArtist(artist)}>
                <h3 className="text-lg font-semibold">{artist.name}</h3>
                <p className="text-sm text-gray-500">Stage: {artist.stage}</p>
                <p className="text-sm">Show Time: {formatTime(artist.show_start)} - {formatTime(artist.show_end)}</p>
                {gearComparisons[artist.id] && (
                  <div className="mt-2">
                    <GearMismatchIndicator mismatches={gearComparisons[artist.id].mismatches} compact={true} />
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEditArtist(artist)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDeleteArtist(artist)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
        {filteredArtists.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No artists found matching the current filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ArtistTable;
