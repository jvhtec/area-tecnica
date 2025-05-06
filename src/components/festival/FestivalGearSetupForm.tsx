
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Save } from "lucide-react";
import { GearSetupFormData } from "@/types/festival-gear";
import { StageGearSetup } from "@/types/festival";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "./form/sections/WirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FestivalGearSetupFormProps {
  jobId: string;
  selectedDate: string;
  stageNumber?: number;
  onSave?: () => void;
}

export const FestivalGearSetupForm = ({
  jobId,
  selectedDate,
  stageNumber = 1,
  onSave
}: FestivalGearSetupFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [setup, setSetup] = useState<GearSetupFormData>({
    max_stages: 1,
    foh_consoles: [],
    mon_consoles: [],
    wireless_systems: [],
    iem_systems: [],
    monitors_enabled: false,
    monitors_quantity: 0,
    extras_sf: false,
    extras_df: false,
    extras_djbooth: false,
    extras_wired: "",
    infra_cat6: false,
    infra_cat6_quantity: 0,
    infra_hma: false,
    infra_hma_quantity: 0,
    infra_coax: false,
    infra_coax_quantity: 0,
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infra_analog: 0,
    other_infrastructure: "",
    notes: "",
  });
  const [gearSetup, setGearSetup] = useState(null);
  const [existingSetupId, setExistingSetupId] = useState<string | null>(null);
  const [stageSetupId, setStageSetupId] = useState<string | null>(null);
  const [hasStageSpecificSetup, setHasStageSpecificSetup] = useState(false);

  useEffect(() => {
    const fetchExistingSetup = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the main gear setup to get available equipment
        const { data: setupData, error: setupError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .eq('date', selectedDate)
          .single();

        if (setupError) {
          // If the error is not a "not found" error, throw it
          if (setupError.code !== 'PGRST116') {
            throw setupError;
          }
          // If the setup doesn't exist, reset the form
          console.log('No existing setup found for this date');
          setExistingSetupId(null);
          setGearSetup(null);
          setStageSetupId(null);
          setHasStageSpecificSetup(false);
          return;
        }
        
        if (setupData) {
          console.log('Found existing global setup:', setupData);
          // Store the gear setup for validation purposes
          setGearSetup(setupData);
          setExistingSetupId(setupData.id);
          
          // With the gear_setup_id, check for a stage-specific setup
          const { data: stageSetupData, error: stageError } = await supabase
            .from('festival_stage_gear_setups')
            .select('*')
            .eq('gear_setup_id', setupData.id)
            .eq('stage_number', stageNumber)
            .maybeSingle();
            
          if (stageError) {
            console.error('Error fetching stage setup:', stageError);
          }
          
          // If we found a stage-specific setup, use its values
          if (stageSetupData) {
            console.log('Found existing stage setup:', stageSetupData);
            setStageSetupId(stageSetupData.id);
            setHasStageSpecificSetup(true);
            
            // Update form with stage-specific data
            setSetup({
              max_stages: setupData.max_stages || 1,
              foh_consoles: stageSetupData.foh_consoles || [],
              mon_consoles: stageSetupData.mon_consoles || [],
              wireless_systems: stageSetupData.wireless_systems || [],
              iem_systems: stageSetupData.iem_systems || [],
              monitors_enabled: stageSetupData.monitors_enabled || false,
              monitors_quantity: stageSetupData.monitors_quantity || 0,
              extras_sf: stageSetupData.extras_sf || false,
              extras_df: stageSetupData.extras_df || false,
              extras_djbooth: stageSetupData.extras_djbooth || false,
              extras_wired: stageSetupData.extras_wired || "",
              infra_cat6: stageSetupData.infra_cat6 || false,
              infra_cat6_quantity: stageSetupData.infra_cat6_quantity || 0,
              infra_hma: stageSetupData.infra_hma || false,
              infra_hma_quantity: stageSetupData.infra_hma_quantity || 0,
              infra_coax: stageSetupData.infra_coax || false,
              infra_coax_quantity: stageSetupData.infra_coax_quantity || 0,
              infra_opticalcon_duo: stageSetupData.infra_opticalcon_duo || false,
              infra_opticalcon_duo_quantity: stageSetupData.infra_opticalcon_duo_quantity || 0,
              infra_analog: stageSetupData.infra_analog || 0,
              other_infrastructure: stageSetupData.other_infrastructure || "",
              notes: stageSetupData.notes || ""
            });
          } else {
            // If no stage-specific setup, use global setup data
            setHasStageSpecificSetup(false);
            
            // Update form values with global data
            setSetup({
              max_stages: setupData.max_stages || 1,
              foh_consoles: setupData.foh_consoles || [],
              mon_consoles: setupData.mon_consoles || [],
              wireless_systems: setupData.wireless_systems || [],
              iem_systems: setupData.iem_systems || [],
              monitors_enabled: setupData.available_monitors > 0,
              monitors_quantity: setupData.available_monitors || 0,
              extras_sf: setupData.has_side_fills || false,
              extras_df: setupData.has_drum_fills || false,
              extras_djbooth: setupData.has_dj_booths || false,
              extras_wired: setupData.extras_wired || "",
              infra_cat6: setupData.available_cat6_runs > 0,
              infra_cat6_quantity: setupData.available_cat6_runs || 0,
              infra_hma: setupData.available_hma_runs > 0,
              infra_hma_quantity: setupData.available_hma_runs || 0,
              infra_coax: setupData.available_coax_runs > 0,
              infra_coax_quantity: setupData.available_coax_runs || 0,
              infra_opticalcon_duo: setupData.available_opticalcon_duo_runs > 0,
              infra_opticalcon_duo_quantity: setupData.available_opticalcon_duo_runs || 0,
              infra_analog: setupData.available_analog_runs || 0,
              other_infrastructure: setupData.other_infrastructure || "",
              notes: setupData.notes || ""
            });
          }
        }
      } catch (error) {
        console.error('Error fetching festival gear setup:', error);
        toast({
          title: "Error",
          description: "Failed to load gear setup.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId && selectedDate) {
      fetchExistingSetup();
    }
  }, [jobId, selectedDate, stageNumber, toast]);

  const handleChange = (changes: Partial<GearSetupFormData>) => {
    setSetup(prev => ({ ...prev, ...changes }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Saving setup with data:', setup);
      
      if (!jobId) throw new Error('No job ID provided');
      
      // STEP 1: Save or update the global festival gear setup
      // Only save non-stage-specific information to the global setup
      const setupPayload = {
        job_id: jobId,
        date: selectedDate,
        max_stages: Math.max(setup.max_stages, stageNumber || 1),
        has_side_fills: hasStageSpecificSetup ? gearSetup?.has_side_fills : setup.extras_sf,
        has_drum_fills: hasStageSpecificSetup ? gearSetup?.has_drum_fills : setup.extras_df,
        has_dj_booths: hasStageSpecificSetup ? gearSetup?.has_dj_booths : setup.extras_djbooth,
        extras_wired: hasStageSpecificSetup ? gearSetup?.extras_wired : setup.extras_wired,
        available_monitors: hasStageSpecificSetup ? gearSetup?.available_monitors : (setup.monitors_enabled ? setup.monitors_quantity : 0),
        available_cat6_runs: hasStageSpecificSetup ? gearSetup?.available_cat6_runs : (setup.infra_cat6 ? setup.infra_cat6_quantity : 0),
        available_hma_runs: hasStageSpecificSetup ? gearSetup?.available_hma_runs : (setup.infra_hma ? setup.infra_hma_quantity : 0),
        available_coax_runs: hasStageSpecificSetup ? gearSetup?.available_coax_runs : (setup.infra_coax ? setup.infra_coax_quantity : 0),
        available_opticalcon_duo_runs: hasStageSpecificSetup ? gearSetup?.available_opticalcon_duo_runs : (setup.infra_opticalcon_duo ? setup.infra_opticalcon_duo_quantity : 0),
        available_analog_runs: hasStageSpecificSetup ? gearSetup?.available_analog_runs : setup.infra_analog,
        other_infrastructure: hasStageSpecificSetup ? gearSetup?.other_infrastructure : setup.other_infrastructure,
        notes: hasStageSpecificSetup ? gearSetup?.notes : setup.notes
      };

      // Add the ID for updates if we have an existing setup
      if (existingSetupId) {
        setupPayload['id'] = existingSetupId;
      }

      // Only include console and wireless system data in global setup if not using stage-specific setup
      if (!hasStageSpecificSetup) {
        setupPayload['foh_consoles'] = setup.foh_consoles;
        setupPayload['mon_consoles'] = setup.mon_consoles;
        setupPayload['wireless_systems'] = setup.wireless_systems;
        setupPayload['iem_systems'] = setup.iem_systems;
      }

      console.log('Payload for global setup save:', setupPayload);

      // Upsert the global setup
      const { data: globalData, error: globalError } = await supabase
        .from('festival_gear_setups')
        .upsert(setupPayload, { 
          onConflict: 'job_id,date' 
        })
        .select();

      if (globalError) {
        console.error('Upsert error for global setup:', globalError);
        throw globalError;
      }

      console.log('Saved global setup response:', globalData);
      
      // Get the global setup ID for the stage setup relation
      const globalSetupId = globalData && globalData.length > 0 ? globalData[0].id : existingSetupId;
      if (!globalSetupId) throw new Error("Failed to get valid gear setup ID");
      
      // STEP 2: Now save the stage-specific setup if we're on a stage view
      if (stageNumber) {
        const stagePayload = {
          gear_setup_id: globalSetupId,
          stage_number: stageNumber,
          foh_consoles: setup.foh_consoles,
          mon_consoles: setup.mon_consoles,
          wireless_systems: setup.wireless_systems,
          iem_systems: setup.iem_systems,
          monitors_enabled: setup.monitors_enabled,
          monitors_quantity: setup.monitors_quantity,
          extras_sf: setup.extras_sf,
          extras_df: setup.extras_df,
          extras_djbooth: setup.extras_djbooth,
          extras_wired: setup.extras_wired,
          infra_cat6: setup.infra_cat6,
          infra_cat6_quantity: setup.infra_cat6_quantity,
          infra_hma: setup.infra_hma,
          infra_hma_quantity: setup.infra_hma_quantity,
          infra_coax: setup.infra_coax,
          infra_coax_quantity: setup.infra_coax_quantity,
          infra_opticalcon_duo: setup.infra_opticalcon_duo,
          infra_opticalcon_duo_quantity: setup.infra_opticalcon_duo_quantity,
          infra_analog: setup.infra_analog,
          other_infrastructure: setup.other_infrastructure,
          notes: setup.notes
        };
        
        // Add ID if we're updating an existing stage setup
        if (stageSetupId) {
          stagePayload['id'] = stageSetupId;
        }
        
        console.log('Payload for stage setup save:', stagePayload);
        
        // Upsert the stage setup
        const { data: stageData, error: stageError } = await supabase
          .from('festival_stage_gear_setups')
          .upsert(stagePayload)
          .select();
        
        if (stageError) {
          console.error('Upsert error for stage setup:', stageError);
          throw stageError;
        }
        
        console.log('Saved stage setup response:', stageData);
        
        // Update the stage setup ID state
        if (stageData && stageData.length > 0) {
          setStageSetupId(stageData[0].id);
          setHasStageSpecificSetup(true);
        }
      }
      
      // Update the existingSetupId with the new ID if this was a new record
      if (globalData && globalData.length > 0) {
        setExistingSetupId(globalData[0].id);
        setGearSetup(globalData[0]);
      }

      onSave?.();
      toast({
        title: "Success",
        description: "Festival gear setup has been saved.",
      });
    } catch (error) {
      console.error('Error saving festival gear setup:', error);
      toast({
        title: "Error",
        description: "Failed to save festival gear setup.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      {hasStageSpecificSetup && (
        <Alert variant="info" className="bg-blue-50 mb-4">
          <AlertDescription>
            This stage has a custom gear setup that differs from the global configuration.
          </AlertDescription>
        </Alert>
      )}
      
      <ConsoleSetupSection
        formData={setup}
        onChange={handleChange}
        gearSetup={gearSetup}
      />

      <WirelessSetupSection
        formData={setup}
        onChange={handleChange}
        gearSetup={gearSetup}
      />

      <MonitorSetupSection
        formData={setup}
        onChange={handleChange}
        gearSetup={gearSetup}
      />

      <ExtraRequirementsSection
        formData={setup}
        onChange={handleChange}
        gearSetup={gearSetup}
      />

      <InfrastructureSection
        formData={setup}
        onChange={handleChange}
        gearSetup={gearSetup}
      />

      <NotesSection
        formData={setup}
        onChange={handleChange}
      />

      <Button type="submit" disabled={isLoading} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {isLoading ? "Saving..." : hasStageSpecificSetup 
          ? "Update Stage Setup" 
          : stageSetupId 
            ? "Update Setup" 
            : "Save Setup"
        }
      </Button>
    </form>
  );
};
