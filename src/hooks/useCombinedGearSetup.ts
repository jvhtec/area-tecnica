
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CombinedGearSetup, FestivalGearSetup, StageGearSetup } from "@/types/festival";

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
      if (!jobId || !selectedDate) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch global gear setup
        const { data: globalSetup, error: globalError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .eq('date', selectedDate)
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
          
          stageSetup = stageData;
        }
        
        setCombinedSetup({
          globalSetup: globalSetup as FestivalGearSetup,
          stageSetup: stageSetup
        });
      } catch (err) {
        console.error('Error in useCombinedGearSetup:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSetups();
  }, [jobId, selectedDate, stageNumber]);

  return { combinedSetup, isLoading, error };
};
