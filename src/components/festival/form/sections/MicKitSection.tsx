
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderSelector } from "../shared/ProviderSelector";
import { WiredMicConfig, WiredMic } from "../../gear-setup/WiredMicConfig";
import { useEffect } from "react";

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
  // Auto-detect mixed providers for wired mics
  const detectWiredMicProvider = (mics: WiredMic[]) => {
    if (!mics || mics.length === 0) return "festival";
    
    const providers = mics.map(mic => mic.provided_by || "festival");
    const uniqueProviders = [...new Set(providers)];
    
    if (uniqueProviders.length > 1) {
      return "mixed";
    }
    
    return uniqueProviders[0] || "festival";
  };

  // Auto-update provider when wired mics change
  useEffect(() => {
    const detectedProvider = detectWiredMicProvider(wiredMics);
    
    if (detectedProvider !== micKit) {
      onMicKitChange(detectedProvider);
    }
  }, [wiredMics]);

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
            label="Required Wired Microphones"
            showProvider={micKit === 'mixed'}
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
              Mixed microphone setup: Some microphones provided by festival, others by band. 
              Individual provider settings are configured per microphone below.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
