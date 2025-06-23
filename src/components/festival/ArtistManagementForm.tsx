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

export const ArtistManagementForm = ({
  artist,
  jobId,
  selectedDate,
  dayStartTime,
  onSubmit,
  isSubmitting
}: ArtistManagementFormProps) => {
  const { toast } = useToast();
  const { combinedSetup } = useCombinedGearSetup(jobId || '', 1);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (artist) {
      setFormData({
        name: artist.name || "",
        stage: artist.stage || 1,
        date: selectedDate,
        show_start: artist.show_start || "20:00",
        show_end: artist.show_end || "21:00",
        soundcheck: artist.soundcheck || false,
        soundcheck_start: artist.soundcheck_start || "18:00",
        soundcheck_end: artist.soundcheck_end || "19:00",
        foh_console: artist.foh_console || "",
        foh_console_provided_by: artist.foh_console_provided_by || "festival",
        mon_console: artist.mon_console || "",
        mon_console_provided_by: artist.mon_console_provided_by || "festival",
        wireless_systems: artist.wireless_systems || [],
        iem_systems: artist.iem_systems || [],
        wireless_provided_by: artist.wireless_provided_by || "festival",
        iem_provided_by: artist.iem_provided_by || "festival",
        monitors_enabled: artist.monitors_enabled || false,
        monitors_quantity: artist.monitors_quantity || 0,
        extras_sf: artist.extras_sf || false,
        extras_df: artist.extras_df || false,
        extras_djbooth: artist.extras_djbooth || false,
        extras_wired: artist.extras_wired || "",
        infra_cat6: artist.infra_cat6 || false,
        infra_cat6_quantity: artist.infra_cat6_quantity || 0,
        infra_hma: artist.infra_hma || false,
        infra_hma_quantity: artist.infra_hma_quantity || 0,
        infra_coax: artist.infra_coax || false,
        infra_coax_quantity: artist.infra_coax_quantity || 0,
        infra_opticalcon_duo: artist.infra_opticalcon_duo || false,
        infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity || 0,
        infra_analog: artist.infra_analog || 0,
        infrastructure_provided_by: artist.infrastructure_provided_by || "festival",
        other_infrastructure: artist.other_infrastructure || "",
        notes: artist.notes || "",
        foh_tech: artist.foh_tech || false,
        mon_tech: artist.mon_tech || false,
        rider_missing: artist.rider_missing || false,
        mic_kit: artist.mic_kit || "band",
        wired_mics: artist.wired_mics || []
      });
    }
  }, [artist, selectedDate]);

  const [formData, setFormData] = useState<ArtistFormData & { mic_kit: 'festival' | 'band'; wired_mics: WiredMic[] }>({
    name: artist?.name || "",
    stage: artist?.stage || 1,
    date: selectedDate,
    show_start: artist?.show_start || "20:00",
    show_end: artist?.show_end || "21:00",
    soundcheck: artist?.soundcheck || false,
    soundcheck_start: artist?.soundcheck_start || "18:00",
    soundcheck_end: artist?.soundcheck_end || "19:00",
    foh_console: artist?.foh_console || "",
    foh_console_provided_by: artist?.foh_console_provided_by || "festival",
    mon_console: artist?.mon_console || "",
    mon_console_provided_by: artist?.mon_console_provided_by || "festival",
    wireless_systems: artist?.wireless_systems || [],
    iem_systems: artist?.iem_systems || [],
    wireless_provided_by: artist?.wireless_provided_by || "festival",
    iem_provided_by: artist?.iem_provided_by || "festival",
    monitors_enabled: artist?.monitors_enabled || false,
    monitors_quantity: artist?.monitors_quantity || 0,
    extras_sf: artist?.extras_sf || false,
    extras_df: artist?.extras_df || false,
    extras_djbooth: artist?.extras_djbooth || false,
    extras_wired: artist?.extras_wired || "",
    infra_cat6: artist?.infra_cat6 || false,
    infra_cat6_quantity: artist?.infra_cat6_quantity || 0,
    infra_hma: artist?.infra_hma || false,
    infra_hma_quantity: artist?.infra_hma_quantity || 0,
    infra_coax: artist?.infra_coax || false,
    infra_coax_quantity: artist?.infra_coax_quantity || 0,
    infra_opticalcon_duo: artist?.infra_opticalcon_duo || false,
    infra_opticalcon_duo_quantity: artist?.infra_opticalcon_duo_quantity || 0,
    infra_analog: artist?.infra_analog || 0,
    infrastructure_provided_by: artist?.infrastructure_provided_by || "festival",
    other_infrastructure: artist?.other_infrastructure || "",
    notes: artist?.notes || "",
    foh_tech: artist?.foh_tech || false,
    mon_tech: artist?.mon_tech || false,
    rider_missing: artist?.rider_missing || false,
    mic_kit: artist?.mic_kit || "band",
    wired_mics: artist?.wired_mics || []
  });

  useEffect(() => {
    if (artist) {
      setIsLoading(true);
      supabase
        .from("festival_artists")
        .select("*")
        .eq("id", artist.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching artist:", error);
            toast({
              title: "Error",
              description: "Could not load artist details",
              variant: "destructive",
            });
          } else if (data) {
            setFormData({
              name: data.name || "",
              stage: data.stage || 1,
              date: selectedDate,
              show_start: data.show_start || "20:00",
              show_end: data.show_end || "21:00",
              soundcheck: data.soundcheck || false,
              soundcheck_start: data.soundcheck_start || "18:00",
              soundcheck_end: data.soundcheck_end || "19:00",
              foh_console: data.foh_console || "",
              foh_console_provided_by: data.foh_console_provided_by || "festival",
              mon_console: data.mon_console || "",
              mon_console_provided_by: data.mon_console_provided_by || "festival",
              wireless_systems: data.wireless_systems || [],
              iem_systems: data.iem_systems || [],
              wireless_provided_by: data.wireless_provided_by || "festival",
              iem_provided_by: data.iem_provided_by || "festival",
              monitors_enabled: data.monitors_enabled || false,
              monitors_quantity: data.monitors_quantity || 0,
              extras_sf: data.extras_sf || false,
              extras_df: data.extras_df || false,
              extras_djbooth: data.extras_djbooth || false,
              extras_wired: data.extras_wired || "",
              infra_cat6: data.infra_cat6 || false,
              infra_cat6_quantity: data.infra_cat6_quantity || 0,
              infra_hma: data.infra_hma || false,
              infra_hma_quantity: data.infra_hma_quantity || 0,
              infra_coax: data.infra_coax || false,
              infra_coax_quantity: data.infra_coax_quantity || 0,
              infra_opticalcon_duo: data.infra_opticalcon_duo || false,
              infra_opticalcon_duo_quantity: data.infra_opticalcon_duo_quantity || 0,
              infra_analog: data.infra_analog || 0,
              infrastructure_provided_by: data.infrastructure_provided_by || "festival",
              other_infrastructure: data.other_infrastructure || "",
              notes: data.notes || "",
              foh_tech: data.foh_tech || false,
              mon_tech: data.mon_tech || false,
              rider_missing: data.rider_missing || false,
              mic_kit: data.mic_kit || "band",
              wired_mics: data.wired_mics || []
            });
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [artist, selectedDate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const updateFormData = (changes: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...changes }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <BasicInfoSection 
        formData={formData} 
        onChange={updateFormData}
        dayStartTime={dayStartTime}
        gearSetup={combinedSetup}
      />

      <ConsoleSetupSection 
        formData={formData} 
        onChange={updateFormData}
        gearSetup={combinedSetup}
      />

      <WirelessSetupSection 
        formData={formData} 
        onChange={updateFormData}
        gearSetup={combinedSetup}
      />

      <MicKitSection
        micKit={formData.mic_kit}
        wiredMics={formData.wired_mics}
        onMicKitChange={(provider) => updateFormData({ mic_kit: provider })}
        onWiredMicsChange={(mics) => updateFormData({ wired_mics: mics })}
      />

      <MonitorSetupSection 
        formData={formData} 
        onChange={updateFormData}
        gearSetup={combinedSetup}
      />

      <ExtraRequirementsSection 
        formData={formData} 
        onChange={updateFormData}
        gearSetup={combinedSetup}
      />

      <InfrastructureSection 
        formData={formData} 
        onChange={updateFormData}
        gearSetup={combinedSetup}
      />

      <NotesSection 
        formData={formData} 
        onChange={updateFormData}
      />

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Saving..." : artist ? "Update Artist" : "Add Artist"}
      </Button>
    </form>
  );
};
