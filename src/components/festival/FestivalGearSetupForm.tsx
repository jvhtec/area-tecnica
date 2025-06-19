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
  stageNumber?: number;
  onSave?: () => void;
}

export const FestivalGearSetupForm = ({
  jobId,
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
  const [globalSetup, setGlobalSetup] = useState(null);
  const [existingSetupId, setExistingSetupId] = useState<string | null>(null);
  const [stageSetupId, setStageSetupId] = useState<string | null>(null);
  const [hasStageSpecificSetup, setHasStageSpecificSetup] = useState(false);
  const isPrimaryStage = stageNumber === 1;

  useEffect(() => {
    const fetchExistingSetup = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the main gear setup (no date filter needed)
        const { data: setupData, error: setupError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (setupError) {
          // If the error is not a "not found" error, throw it
          if (setupError.code !== 'PGRST116') {
            throw setupError;
          }
          // If the setup doesn't exist, reset the form
          console.log('No existing setup found');
          setExistingSetupId(null);
          setGlobalSetup(null);
          setStageSetupId(null);
          setHasStageSpecificSetup(false);
          return;
        }
        
        if (setupData) {
          console.log('Found existing global setup:', setupData);
          // Store the gear setup for validation purposes
          setGlobalSetup(setupData);
          setExistingSetupId(setupData.id);
          
          // For non-primary stages, check for stage-specific setup
          if (!isPrimaryStage) {
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
              // For non-primary stage without stage-specific setup, use global setup data
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
          } else {
            // For primary stage (stage 1), always use global setup directly
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

    if (jobId) {
      fetchExistingSetup();
    }
  }, [jobId, stageNumber, toast, isPrimaryStage]);

  const handleChange = (changes: Partial<GearSetupFormData>) => {
    setSetup(prev => ({ ...prev, ...changes }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Saving setup with data:', setup);
      
      if (!jobId) throw new Error('No job ID provided');
      
      // STEP 1: For primary stage (stage 1), always update the global setup
      if (isPrimaryStage) {
        const setupPayload = {
          job_id: jobId,
          max_stages: setup.max_stages,
          foh_consoles: setup.foh_consoles,
          mon_consoles: setup.mon_consoles,
          wireless_systems: setup.wireless_systems,
          iem_systems: setup.iem_systems,
          has_side_fills: setup.extras_sf,
          has_drum_fills: setup.extras_df,
          has_dj_booths: setup.extras_djbooth,
          extras_wired: setup.extras_wired,
          available_monitors: setup.monitors_enabled ? setup.monitors_quantity : 0,
          available_cat6_runs: setup.infra_cat6 ? setup.infra_cat6_quantity : 0,
          available_hma_runs: setup.infra_hma ? setup.infra_hma_quantity : 0,
          available_coax_runs: setup.infra_coax ? setup.infra_coax_quantity : 0,
          available_opticalcon_duo_runs: setup.infra_opticalcon_duo ? setup.infra_opticalcon_duo_quantity : 0,
          available_analog_runs: setup.infra_analog,
          other_infrastructure: setup.other_infrastructure,
          notes: setup.notes
        };

        // Add the ID for updates if we have an existing setup
        if (existingSetupId) {
          setupPayload['id'] = existingSetupId;
        }

        console.log('Payload for global setup save:', setupPayload);

        // Upsert the global setup
        const { data: globalData, error: globalError } = await supabase
          .from('festival_gear_setups')
          .upsert(setupPayload, { 
            onConflict: 'job_id' 
          })
          .select();

        if (globalError) {
          console.error('Upsert error for global setup:', globalError);
          throw globalError;
        }

        console.log('Saved global setup response:', globalData);
        
        // Update the existingSetupId with the new ID if this was a new record
        if (globalData && globalData.length > 0) {
          setExistingSetupId(globalData[0].id);
          setGlobalSetup(globalData[0]);
        }
      } else {
        // For non-primary stages, we need to make sure the global setup exists first
        let globalSetupId = existingSetupId;
        
        if (!globalSetupId) {
          // Create a basic global setup if it doesn't exist
          const basicGlobalSetup = {
            job_id: jobId,
            max_stages: Math.max(setup.max_stages, stageNumber || 1)
          };
          
          const { data: newGlobalSetup, error: newGlobalError } = await supabase
            .from('festival_gear_setups')
            .upsert(basicGlobalSetup, { 
              onConflict: 'job_id' 
            })
            .select();
            
          if (newGlobalError) {
            console.error('Error creating global setup:', newGlobalError);
            throw newGlobalError;
          }
          
          globalSetupId = newGlobalSetup[0].id;
          setExistingSetupId(globalSetupId);
          setGlobalSetup(newGlobalSetup[0]);
        } else {
          // Update only the max_stages on the global setup if needed
          const { error: updateMaxStagesError } = await supabase
            .from('festival_gear_setups')
            .update({
              max_stages: Math.max(globalSetup?.max_stages || 1, stageNumber)
            })
            .eq('id', globalSetupId);
            
          if (updateMaxStagesError) {
            console.error('Error updating max stages:', updateMaxStagesError);
            // Non-critical error, continue with stage setup
          }
        }
        
        // STEP 2: For non-primary stages, create/update stage-specific setup
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

      onSave?.();
      toast({
        title: "Success",
        description: isPrimaryStage 
          ? "Global gear setup has been saved." 
          : `Stage ${stageNumber} setup has been saved.`,
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

  const alertText = isPrimaryStage 
    ? "You are editing the default stage setup. These settings will be used as defaults for all stages."
    : hasStageSpecificSetup 
      ? `This stage has a custom gear setup that differs from the global configuration.`
      : `This stage is currently using the global setup. Any changes will create a custom setup for Stage ${stageNumber}.`;

  const alertVariant = isPrimaryStage ? "default" : hasStageSpecificSetup ? "info" : "default";

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      <Alert variant={alertVariant} className={isPrimaryStage ? "bg-yellow-50" : hasStageSpecificSetup ? "bg-blue-50" : "bg-gray-50"}>
        <AlertDescription>
          {alertText}
        </AlertDescription>
      </Alert>
      
      <ConsoleSetupSection
        formData={setup}
        onChange={handleChange}
        gearSetup={globalSetup}
        stageNumber={stageNumber}
      />

      <WirelessSetupSection
        formData={setup}
        onChange={handleChange}
      />

      <MonitorSetupSection
        formData={setup}
        onChange={handleChange}
        gearSetup={globalSetup}
        stageNumber={stageNumber}
      />

      <ExtraRequirementsSection
        formData={setup}
        onChange={handleChange}
        gearSetup={globalSetup}
        stageNumber={stageNumber}
      />

      <InfrastructureSection
        formData={setup}
        onChange={handleChange}
        gearSetup={globalSetup}
        stageNumber={stageNumber}
      />

      <NotesSection
        formData={setup}
        onChange={handleChange}
      />

      <Button type="submit" disabled={isLoading} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {isLoading ? "Saving..." : (
          isPrimaryStage 
            ? "Save Global Setup" 
            : hasStageSpecificSetup 
              ? `Update Stage ${stageNumber} Setup` 
              : `Create Custom Setup for Stage ${stageNumber}`
        )}
      </Button>
    </form>
  );
};
