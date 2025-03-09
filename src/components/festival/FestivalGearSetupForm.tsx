
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
    foh_console: "",
    mon_console: "",
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
          .maybeSingle();

        if (setupError) throw setupError;
        
        if (setupData) {
          // Store the gear setup for validation purposes
          setGearSetup(setupData);
          
          // Update default values for the form
          setSetup(prev => ({
            ...prev,
            max_stages: setupData.max_stages || 1,
            monitors_enabled: setupData.has_side_fills || false,
            extras_sf: setupData.has_side_fills || false,
            extras_df: setupData.has_drum_fills || false,
            extras_djbooth: setupData.has_dj_booths || false,
          }));
        }
        
        // Now check if there are any stage-specific setups
        // This would be implemented when we add stage-specific storage
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
      // Update the global festival gear setup
      const globalSetupPayload = {
        job_id: jobId,
        date: selectedDate,
        max_stages: Math.max(setup.max_stages, stageNumber || 1),
        has_side_fills: setup.extras_sf,
        has_drum_fills: setup.extras_df,
        has_dj_booths: setup.extras_djbooth,
        available_monitors: setup.monitors_quantity,
        available_cat6_runs: setup.infra_cat6 ? setup.infra_cat6_quantity : 0,
        available_hma_runs: setup.infra_hma ? setup.infra_hma_quantity : 0,
        available_coax_runs: setup.infra_coax ? setup.infra_coax_quantity : 0,
        available_opticalcon_duo_runs: setup.infra_opticalcon_duo ? setup.infra_opticalcon_duo_quantity : 0,
        available_analog_runs: setup.infra_analog,
        // Add console and wireless info as JSON arrays
        foh_consoles: [{ model: setup.foh_console, quantity: 1 }],
        mon_consoles: [{ model: setup.mon_console, quantity: 1 }],
        wireless_systems: [{ model: setup.wireless_model, quantity: setup.wireless_quantity_hh + setup.wireless_quantity_bp, band: setup.wireless_band }],
        iem_systems: [{ model: setup.iem_model, quantity: setup.iem_quantity, band: setup.iem_band }],
        notes: setup.notes
      };

      await supabase
        .from('festival_gear_setups')
        .upsert(globalSetupPayload);

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
        {isLoading ? "Saving..." : "Save Setup"}
      </Button>
    </form>
  );
};
