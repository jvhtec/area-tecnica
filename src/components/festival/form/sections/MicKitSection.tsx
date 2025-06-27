
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderSelector } from "../shared/ProviderSelector";
import { WiredMicConfig, WiredMic } from "../../gear-setup/WiredMicConfig";

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
          <WiredMicConfig
            mics={wiredMics}
            onChange={onWiredMicsChange}
            label={micKit === 'mixed' ? "Festival-Provided Wired Microphones" : "Required Wired Microphones"}
            showProvider={false}
          />
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
