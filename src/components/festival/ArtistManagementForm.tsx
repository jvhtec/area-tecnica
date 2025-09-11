import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { BasicInfoSection } from "./form/sections/BasicInfoSection";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "./form/sections/WirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { MicKitSection } from "./form/sections/MicKitSection";
import { WiredMic } from "./gear-setup/WiredMicConfig";
import { ArtistFormData, WirelessSetup } from "@/types/festival";
import { useCombinedGearSetup } from "@/hooks/useCombinedGearSetup";

interface ArtistManagementFormProps {
  artist?: any;
  jobId?: string;
  selectedDate: string;
  dayStartTime: string;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}

// Define the correct form data type for this component
interface ArtistManagementFormData {
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  foh_console: string;
  foh_console_provided_by: string;
  mon_console: string;
  mon_console_provided_by: string;
  wireless_systems: any[];
  iem_systems: any[];
  wireless_provided_by: string;
  iem_provided_by: string;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  extras_wired: string;
  infra_cat6: boolean;
  infra_cat6_quantity: number;
  infra_hma: boolean;
  infra_hma_quantity: number;
  infra_coax: boolean;
  infra_coax_quantity: number;
  infra_opticalcon_duo: boolean;
  infra_opticalcon_duo_quantity: number;
  infra_analog: number;
  infrastructure_provided_by: string;
  other_infrastructure: string;
  notes: string;
  foh_tech?: boolean;
  mon_tech?: boolean;
  rider_missing?: boolean;
  isaftermidnight?: boolean;
  mic_kit: 'festival' | 'band' | 'mixed';
  wired_mics: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
}

export const ArtistManagementForm = ({
  artist,
  jobId,
  selectedDate,
  dayStartTime = "07:00",
  onSubmit,
  isSubmitting
}: ArtistManagementFormProps) => {
  const { toast } = useToast();
  const { combinedSetup } = useCombinedGearSetup(jobId || '', selectedDate, 1);

  const [isLoading, setIsLoading] = useState(false);

  // Create form data without problematic compatibility fields
  const createFormData = (artistData?: any): ArtistManagementFormData => ({
    name: artistData?.name || "",
    stage: artistData?.stage || 1,
    date: selectedDate,
    show_start: artistData?.show_start || "20:00",
    show_end: artistData?.show_end || "21:00",
    soundcheck: artistData?.soundcheck || false,
    soundcheck_start: artistData?.soundcheck_start || "18:00",
    soundcheck_end: artistData?.soundcheck_end || "19:00",
    foh_console: artistData?.foh_console || "",
    foh_console_provided_by: artistData?.foh_console_provided_by || "festival",
    mon_console: artistData?.mon_console || "",
    mon_console_provided_by: artistData?.mon_console_provided_by || "festival",
    wireless_systems: artistData?.wireless_systems || [],
    iem_systems: artistData?.iem_systems || [],
    wireless_provided_by: artistData?.wireless_provided_by || "festival",
    iem_provided_by: artistData?.iem_provided_by || "festival",
    monitors_enabled: artistData?.monitors_enabled || false,
    monitors_quantity: artistData?.monitors_quantity || 0,
    extras_sf: artistData?.extras_sf || false,
    extras_df: artistData?.extras_df || false,
    extras_djbooth: artistData?.extras_djbooth || false,
    extras_wired: artistData?.extras_wired || "",
    infra_cat6: artistData?.infra_cat6 || false,
    infra_cat6_quantity: artistData?.infra_cat6_quantity || 0,
    infra_hma: artistData?.infra_hma || false,
    infra_hma_quantity: artistData?.infra_hma_quantity || 0,
    infra_coax: artistData?.infra_coax || false,
    infra_coax_quantity: artistData?.infra_coax_quantity || 0,
    infra_opticalcon_duo: artistData?.infra_opticalcon_duo || false,
    infra_opticalcon_duo_quantity: artistData?.infra_opticalcon_duo_quantity || 0,
    infra_analog: artistData?.infra_analog || 0,
    infrastructure_provided_by: artistData?.infrastructure_provided_by || "festival",
    other_infrastructure: artistData?.other_infrastructure || "",
    notes: artistData?.notes || "",
    foh_tech: artistData?.foh_tech || false,
    mon_tech: artistData?.mon_tech || false,
    rider_missing: artistData?.rider_missing || false,
    isaftermidnight: artistData?.isaftermidnight || false,
    mic_kit: artistData?.mic_kit || "band",
    wired_mics: artistData?.wired_mics || []
  });

  const [formData, setFormData] = useState<ArtistManagementFormData>(createFormData(artist));

  useEffect(() => {
    if (artist) {
      setFormData(createFormData(artist));
    }
  }, [artist, selectedDate, combinedSetup]);

  useEffect(() => {
    if (artist) {
      setIsLoading(true);
      const fetchArtist = async () => {
        try {
          const { data, error } = await supabase
            .from("festival_artists")
            .select("*")
            .eq("id", artist.id)
            .single();
          
          if (error) {
            console.error("Error fetching artist:", error);
            toast({
              title: "Error",
              description: "Could not load artist details",
              variant: "destructive",
            });
          } else if (data) {
            setFormData(createFormData(data));
          }
        } catch (error) {
          console.error("Error fetching artist:", error);
          toast({
            title: "Error",
            description: "Could not load artist details",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      };

      fetchArtist();
    }
  }, [artist, selectedDate, toast, combinedSetup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const updateFormData = (changes: Partial<ArtistManagementFormData>) => {
    setFormData(prev => ({ ...prev, ...changes }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <BasicInfoSection 
        formData={formData as any} 
        onChange={updateFormData}
        gearSetup={combinedSetup?.globalSetup || null}
      />

      <ConsoleSetupSection 
        formData={formData as any} 
        onChange={updateFormData}
        gearSetup={combinedSetup?.globalSetup || null}
      />

      <WirelessSetupSection 
        formData={formData as any} 
        onChange={updateFormData}
        gearSetup={combinedSetup?.globalSetup || null}
      />

      <MicKitSection
        micKit={formData.mic_kit}
        wiredMics={formData.wired_mics}
        onMicKitChange={(provider) => updateFormData({ mic_kit: provider })}
        onWiredMicsChange={(mics) => updateFormData({ wired_mics: mics })}
      />

      <MonitorSetupSection 
        formData={formData as any} 
        onChange={updateFormData}
        gearSetup={combinedSetup?.globalSetup || null}
      />

      <ExtraRequirementsSection 
        formData={formData as any} 
        onChange={updateFormData}
        gearSetup={combinedSetup?.globalSetup || null}
      />

      <InfrastructureSection 
        formData={formData as any} 
        onChange={updateFormData}
        gearSetup={combinedSetup?.globalSetup || null}
      />

      <NotesSection 
        formData={formData as any} 
        onChange={updateFormData}
      />

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Saving..." : artist ? "Update Artist" : "Add Artist"}
      </Button>
    </form>
  );
};
