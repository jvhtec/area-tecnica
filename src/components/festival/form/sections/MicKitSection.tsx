
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderSelector } from "../shared/ProviderSelector";
import { MicrophoneListBuilder, WiredMic } from "../../gear-setup/MicrophoneListBuilder";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

interface MicKitSectionProps {
  micKit: 'festival' | 'band' | 'mixed';
  wiredMics: WiredMic[];
  onMicKitChange: (provider: 'festival' | 'band' | 'mixed') => void;
  onWiredMicsChange: (mics: WiredMic[]) => void;
}

export const MicKitSection = ({
  micKit,
  wiredMics,
  onMicKitChange,
  onWiredMicsChange
}: MicKitSectionProps) => {
  const { models } = useEquipmentModels();

  // Get available wired microphone models
  const availableMics = models
    .filter(model => model.category === 'wired_mics')
    .map(model => model.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Microphone Kit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProviderSelector
          value={micKit}
          onChange={onMicKitChange}
          label="Microphone Kit Provider"
          id="mic-kit"
          showMixed={true}
        />

        {(micKit === 'festival' || micKit === 'mixed') && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold mb-2">
                {micKit === 'mixed' ? "Festival-Provided Wired Microphones" : "Required Wired Microphones"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {micKit === 'mixed'
                  ? "Select only the microphones that the festival will provide. The band will provide any additional microphones."
                  : "Select the wired microphones you need for your performance."
                }
              </p>
            </div>
            <MicrophoneListBuilder
              value={wiredMics}
              onChange={onWiredMicsChange}
              availableMics={availableMics}
              showExclusiveUse={true}
              showNotes={true}
            />
          </div>
        )}

        {micKit === 'band' && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              The band will provide their own microphone kit.
            </p>
          </div>
        )}

        {micKit === 'mixed' && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              Mixed microphone setup: Enter only the microphones that the festival will provide.
              The band will provide any additional microphones they need.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
