import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import { BasicInfoSection } from "./form/sections/BasicInfoSection";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "./form/sections/WirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { MicKitSection } from "./form/sections/MicKitSection";
import { useCombinedGearSetup } from "@/hooks/useCombinedGearSetup";
import {
  toArtistFormValues,
  type ArtistFormValues,
  type ArtistRowInput,
} from "@/features/festival-artists/model";

interface ArtistManagementFormProps {
  artist?: any;
  jobId?: string;
  selectedDate: string;
  dayStartTime: string;
  onSubmit: (data: any) => Promise<void>;
  formId?: string;
}

export const ArtistManagementForm = ({
  artist,
  jobId,
  selectedDate,
  dayStartTime,
  onSubmit,
  formId
}: ArtistManagementFormProps) => {
  const { toast } = useToast();
  const { combinedSetup } = useCombinedGearSetup(jobId || '', selectedDate, 1);

  const [isLoading, setIsLoading] = useState(false);

  const createFormData = (artistData?: ArtistRowInput | null) =>
    toArtistFormValues(artistData, { selectedDate });

  const [formData, setFormData] = useState<ArtistFormValues>(createFormData(artist));

  // Reset/refetch only when the edited artist actually changes. Keying these
  // effects on the `artist` object or `combinedSetup` identity resets the form
  // mid-edit (e.g. right after the gear setup query resolves or the artist
  // list refetches), silently reverting quick changes like a provided-by
  // selection made with no systems added yet.
  useEffect(() => {
    if (!artist?.id) return;

    setFormData(createFormData(artist));
    setIsLoading(true);

    const fetchArtist = async () => {
      try {
        const { data, error } = await dataLayerClient.from("festival_artists")
          .select("*")
          .eq("id", artist.id)
          .single();

        if (error) {
          console.error("Error fetching artist:", error);
          toast({
            title: "Error",
            description: "No se pudieron cargar los detalles del artista",
            variant: "destructive",
          });
        } else if (data) {
          setFormData(createFormData(data));
        }
      } catch (error) {
        console.error("Error fetching artist:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los detalles del artista",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.id, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const updateFormData = (changes: Partial<ArtistFormValues>) => {
    setFormData(prev => ({ ...prev, ...changes }));
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4 pb-1">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="space-y-4">
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
          <MonitorSetupSection
            formData={formData as any}
            onChange={updateFormData}
            gearSetup={combinedSetup?.globalSetup || null}
          />
        </div>

        <div className="space-y-4">
          <InfrastructureSection
            formData={formData as any}
            onChange={updateFormData}
            gearSetup={combinedSetup?.globalSetup || null}
          />
          <NotesSection
            formData={formData as any}
            onChange={updateFormData}
          />
          <WirelessSetupSection
            formData={formData as any}
            onChange={updateFormData}
            gearSetup={combinedSetup?.globalSetup || null}
          />
        </div>

        <div className="space-y-4">
          <ExtraRequirementsSection
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
        </div>
      </div>
    </form>
  );
};
