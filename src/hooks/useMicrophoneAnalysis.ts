
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { WiredMic } from "@/components/festival/gear-setup/WiredMicConfig";

interface ArtistMicRequirement {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  wired_mics: WiredMic[];
}

interface MicrophoneAnalysisResult {
  artists: ArtistMicRequirement[];
  peakRequirements: WiredMic[];
  analysisDetails: {
    totalArtists: number;
    microphoneModels: string[];
    peakCalculationMethod: string;
    stageNumber: number;
  };
}

export const useMicrophoneAnalysis = (jobId: string, stageNumber: number) => {
  return useQuery({
    queryKey: ['microphone-analysis', jobId, stageNumber],
    queryFn: async (): Promise<MicrophoneAnalysisResult> => {
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('id, name, stage, date, show_start, show_end, wired_mics, mic_kit')
        .eq('job_id', jobId)
        .eq('stage', stageNumber)
        .eq('mic_kit', 'festival')
        .not('wired_mics', 'is', null);
      
      if (error) throw error;

      const validArtists = artists?.filter(artist => 
        artist.wired_mics && 
        Array.isArray(artist.wired_mics) && 
        artist.wired_mics.length > 0
      ) || [];

      // Calculate peak requirements for this specific stage
      const peakRequirements = calculatePeakMicrophoneRequirements(validArtists);

      return {
        artists: validArtists,
        peakRequirements,
        analysisDetails: {
          totalArtists: validArtists.length,
          microphoneModels: Array.from(new Set(
            validArtists.flatMap(artist => 
              artist.wired_mics?.map((mic: WiredMic) => mic.model) || []
            )
          )),
          peakCalculationMethod: 'stage_aware_peak_analysis',
          stageNumber
        }
      };
    },
    enabled: !!jobId && !!stageNumber
  });
};

const calculatePeakMicrophoneRequirements = (artists: ArtistMicRequirement[]): WiredMic[] => {
  const micRequirements = new Map<string, WiredMic>();

  // Group artists by date and calculate peak requirements per date
  const artistsByDate = artists.reduce((acc, artist) => {
    const date = artist.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(artist);
    return acc;
  }, {} as Record<string, ArtistMicRequirement[]>);

  // For each date, calculate peak concurrent usage
  Object.values(artistsByDate).forEach(dateArtists => {
    const micUsageByModel = new Map<string, number>();

    dateArtists.forEach(artist => {
      if (!artist.wired_mics) return;

      artist.wired_mics.forEach((mic: WiredMic) => {
        const key = mic.model;
        const currentUsage = micUsageByModel.get(key) || 0;
        
        // If exclusive use, add full quantity
        // If shared, we need to consider peak concurrent usage
        if (mic.exclusive_use) {
          micUsageByModel.set(key, currentUsage + mic.quantity);
        } else {
          // For shared mics, take the maximum quantity needed by any single artist
          micUsageByModel.set(key, Math.max(currentUsage, mic.quantity));
        }
      });
    });

    // Update global peak requirements
    micUsageByModel.forEach((quantity, model) => {
      const existing = micRequirements.get(model);
      if (!existing) {
        micRequirements.set(model, {
          model,
          quantity,
          exclusive_use: false,
          notes: `Peak requirement for stage (${dateArtists.length} artists)`
        });
      } else {
        // Take the maximum quantity needed across all dates
        if (quantity > existing.quantity) {
          micRequirements.set(model, {
            ...existing,
            quantity,
            notes: `Peak requirement for stage (${dateArtists.length} artists)`
          });
        }
      }
    });
  });

  return Array.from(micRequirements.values()).sort((a, b) => a.model.localeCompare(b.model));
};
