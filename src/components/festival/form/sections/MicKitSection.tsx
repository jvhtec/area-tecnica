
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderSelector } from "../shared/ProviderSelector";
import { WiredMicConfig, WiredMic } from "../../gear-setup/WiredMicConfig";

interface MicKitSectionProps {
  micKit: 'festival' | 'band';
  wiredMics: WiredMic[];
  onMicKitChange: (provider: 'festival' | 'band') => void;
  onWiredMicsChange: (mics: WiredMic[]) => void;
}

export const MicKitSection = ({
  micKit,
  wiredMics,
  onMicKitChange,
  onWiredMicsChange
}: MicKitSectionProps) => {
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
        />

        {micKit === 'festival' && (
          <WiredMicConfig
            mics={wiredMics}
            onChange={onWiredMicsChange}
            label="Required Wired Microphones"
          />
        )}

        {micKit === 'band' && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              The band will provide their own microphone kit.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
