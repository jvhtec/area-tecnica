
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CombinedGearSetup, StageGearSetup } from "@/types/festival";
import { mapFestivalGearSetup, mapStageGearSetup } from "@/utils/festivalGearMappers";

export const useCombinedGearSetup = (
  jobId: string, 
  selectedDate: string,
  stageNumber: number
): {
  combinedSetup: CombinedGearSetup | null;
  isLoading: boolean;
  error: string | null;
} => {
  const [combinedSetup, setCombinedSetup] = useState<CombinedGearSetup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSetups = async () => {
      if (!jobId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch global gear setup - removed the invalid .eq('date', selectedDate) filter
        const { data: globalSetup, error: globalError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .maybeSingle();
        
        if (globalError) {
          throw new Error(`Error fetching global setup: ${globalError.message}`);
        }

        let stageSetup: StageGearSetup | null = null;
        
        // If we have a global setup and a stage number, try to fetch stage-specific setup
        if (globalSetup && stageNumber) {
          const { data: stageData, error: stageError } = await supabase
            .from('festival_stage_gear_setups')
            .select('*')
            .eq('gear_setup_id', globalSetup.id)
            .eq('stage_number', stageNumber)
            .maybeSingle();
          
          if (stageError) {
            throw new Error(`Error fetching stage setup: ${stageError.message}`);
          }
          
          stageSetup = mapStageGearSetup(stageData);
        }
        
        setCombinedSetup({
          globalSetup: mapFestivalGearSetup(globalSetup),
          stageSetup: stageSetup
        });
      } catch (err) {
        console.error('Error in useCombinedGearSetup:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSetups();
  }, [jobId, selectedDate, stageNumber]);

  return { combinedSetup, isLoading, error };
};
