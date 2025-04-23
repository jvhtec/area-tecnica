import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Save } from "lucide-react";
import { GearSetupFormData } from "@/types/festival-gear";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "./form/sections/WirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";

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
    wireless_model: "",
    wireless_quantity_hh: 0,
    wireless_quantity_bp: 0,
    wireless_band: "",
    iem_model: "",
    iem_quantity: 0,
    iem_band: "",
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
          return;
        }
        
        if (setupData) {
          console.log('Found existing setup:', setupData);
          // Store the gear setup for validation purposes
          setGearSetup(setupData);
          setExistingSetupId(setupData.id);
          
          // Update form values with existing data
          setSetup({
            max_stages: setupData.max_stages || 1,
            foh_consoles: setupData.foh_consoles || [],
            mon_consoles: setupData.mon_consoles || [],
            wireless_model: setupData.wireless_systems?.[0]?.model || "",
            wireless_band: setupData.wireless_systems?.[0]?.band || "",
            iem_model: setupData.iem_systems?.[0]?.model || "",
            iem_band: setupData.iem_systems?.[0]?.band || "",
            wireless_quantity_hh: setupData.wireless_systems?.[0]?.quantity_hh || 0,
            wireless_quantity_bp: setupData.wireless_systems?.[0]?.quantity_bp || 0,
            iem_quantity: setupData.iem_systems?.[0]?.quantity || 0,
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
      console.log('Existing setup ID:', existingSetupId);
      
      if (!jobId) throw new Error('No job ID provided');

      // Create wireless and IEM quantities with proper split between HH and BP
      const totalWirelessQuantity = setup.wireless_quantity_hh + setup.wireless_quantity_bp;

      // Prepare payload for upsert
      const setupPayload = {
        job_id: jobId,
        date: selectedDate,
        max_stages: Math.max(setup.max_stages, stageNumber || 1),
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
        // Add console and wireless info as JSON arrays
        foh_consoles: setup.foh_consoles,
        mon_consoles: setup.mon_consoles,
        wireless_systems: [{ 
          model: setup.wireless_model, 
          quantity: totalWirelessQuantity,
          quantity_hh: setup.wireless_quantity_hh,
          quantity_bp: setup.wireless_quantity_bp,
          band: setup.wireless_band 
        }],
        iem_systems: [{ 
          model: setup.iem_model, 
          quantity: setup.iem_quantity, 
          band: setup.iem_band 
        }],
        notes: setup.notes
      };

      // Add the ID for updates
      if (existingSetupId) {
        setupPayload['id'] = existingSetupId;
      }

      console.log('Payload for save:', setupPayload);

      let query = supabase
        .from('festival_gear_setups')
        .upsert(setupPayload, { 
          onConflict: 'job_id,date' 
        });
        
      // Get the result back
      const { data, error } = await query.select();

      if (error) {
        console.error('Upsert error:', error);
        throw error;
      }

      console.log('Saved setup response:', data);
      
      // Update the existingSetupId with the new ID if this was a new record
      if (data && data.length > 0) {
        setExistingSetupId(data[0].id);
        setGearSetup(data[0]);
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
        {isLoading ? "Saving..." : existingSetupId ? "Update Setup" : "Save Setup"}
      </Button>
    </form>
  );
};
