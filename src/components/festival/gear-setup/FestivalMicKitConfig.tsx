
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WiredMicConfig, WiredMic } from "./WiredMicConfig";
import { useState } from "react";
import { Calculator, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMicrophoneAnalysis } from "@/hooks/useMicrophoneAnalysis";
import { MicrophoneAnalysisPreview } from "./MicrophoneAnalysisPreview";

interface FestivalMicKitConfigProps {
  jobId: string;
  stageNumber: number;
  wiredMics: WiredMic[];
  onChange: (mics: WiredMic[]) => void;
}

export const FestivalMicKitConfig = ({ jobId, stageNumber, wiredMics, onChange }: FestivalMicKitConfigProps) => {
  const [analysisPreviewOpen, setAnalysisPreviewOpen] = useState(false);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false);
  
  const { data: analysisData, isLoading: isAnalyzing, refetch } = useMicrophoneAnalysis(jobId, stageNumber);

  const handleLoadFromAnalysis = async () => {
    if (!analysisData) {
      toast.error("No analysis data available");
      return;
    }

    if (analysisData.peakRequirements.length === 0) {
      toast.error(`No microphone requirements found for Stage ${stageNumber}`);
      return;
    }

    setAnalysisPreviewOpen(true);
  };

  const handleConfirmLoadRequirements = async () => {
    if (!analysisData) return;

    setIsLoadingRequirements(true);
    
    try {
      // Merge with existing mics, combining quantities for same models
      const existingMicsMap = new Map(wiredMics.map(mic => [mic.model, mic]));
      
      analysisData.peakRequirements.forEach(newMic => {
        if (existingMicsMap.has(newMic.model)) {
          const existing = existingMicsMap.get(newMic.model)!;
          // Take the higher quantity
          if (newMic.quantity > existing.quantity) {
            existing.quantity = newMic.quantity;
            existing.notes = newMic.notes;
          }
        } else {
          existingMicsMap.set(newMic.model, newMic);
        }
      });

      const mergedMics = Array.from(existingMicsMap.values());
      onChange(mergedMics);
      
      toast.success(`Loaded ${analysisData.peakRequirements.length} microphone types for Stage ${stageNumber}`);
      setAnalysisPreviewOpen(false);
    } catch (error) {
      toast.error("Failed to load microphone requirements");
      console.error("Error loading requirements:", error);
    } finally {
      setIsLoadingRequirements(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Stage {stageNumber} Microphone Kit</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLoadFromAnalysis}
              disabled={isAnalyzing}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {isAnalyzing ? "Analyzing..." : "Load from Artist Requirements"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <WiredMicConfig
          mics={wiredMics}
          onChange={onChange}
          label="Available Wired Microphones"
          showProvider={false}
        />
        
        {wiredMics.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mb-4">
              <Plus className="h-12 w-12 mx-auto opacity-50" />
            </div>
            <p className="mb-2">No microphones configured yet</p>
            <p className="text-sm">
              Load microphone requirements from Stage {stageNumber} artist analysis or add them manually
            </p>
          </div>
        )}

        <MicrophoneAnalysisPreview
          open={analysisPreviewOpen}
          onOpenChange={setAnalysisPreviewOpen}
          peakRequirements={analysisData?.peakRequirements || []}
          analysisDetails={analysisData?.analysisDetails || {
            totalArtists: 0,
            microphoneModels: [],
            peakCalculationMethod: '',
            stageNumber
          }}
          onConfirm={handleConfirmLoadRequirements}
          isLoading={isLoadingRequirements}
        />
      </CardContent>
    </Card>
  );
};
