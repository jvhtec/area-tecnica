
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MicrophoneListBuilder, WiredMic } from "./MicrophoneListBuilder";
import { useState } from "react";
import { Calculator, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMicrophoneAnalysis } from "@/hooks/useMicrophoneAnalysis";
import { MicrophoneAnalysisPreview } from "./MicrophoneAnalysisPreview";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

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
  const { models } = useEquipmentModels();

  // Get available wired microphone models
  const availableMics = models
    .filter(model => model.category === 'wired_mics')
    .map(model => model.name);

  console.log('=== FESTIVAL MIC KIT CONFIG DEBUG ===');
  console.log('FestivalMicKitConfig render - wiredMics:', wiredMics);
  console.log('FestivalMicKitConfig render - wiredMics length:', wiredMics?.length || 0);
  console.log('FestivalMicKitConfig render - wiredMics type:', typeof wiredMics);
  console.log('FestivalMicKitConfig render - wiredMics serialized:', JSON.stringify(wiredMics, null, 2));

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
      console.log('=== LOADING REQUIREMENTS DEBUG ===');
      console.log('Analysis data peak requirements:', analysisData.peakRequirements);
      console.log('Existing wired mics:', wiredMics);
      
      // Ensure we're working with proper arrays
      const existingMics = Array.isArray(wiredMics) ? wiredMics : [];
      const newRequirements = Array.isArray(analysisData.peakRequirements) ? analysisData.peakRequirements : [];
      
      // Merge with existing mics, combining quantities for same models
      const existingMicsMap = new Map(existingMics.map(mic => [mic.model, mic]));
      
      newRequirements.forEach(newMic => {
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
      
      console.log('=== MERGED MICS DEBUG ===');
      console.log('Merged mics result:', mergedMics);
      console.log('Merged mics length:', mergedMics.length);
      console.log('Calling onChange with merged mics...');
      
      // Ensure the data is properly serializable
      const sanitizedMics = mergedMics.map(mic => ({
        model: mic.model || '',
        quantity: Number(mic.quantity) || 0,
        exclusive_use: Boolean(mic.exclusive_use),
        notes: mic.notes || ''
      }));
      
      console.log('Sanitized mics for onChange:', sanitizedMics);
      
      onChange(sanitizedMics);
      
      toast.success(`Loaded ${newRequirements.length} microphone types for Stage ${stageNumber}`);
      setAnalysisPreviewOpen(false);
    } catch (error) {
      console.error("Error loading requirements:", error);
      toast.error("Failed to load microphone requirements");
    } finally {
      setIsLoadingRequirements(false);
    }
  };

  const handleMicsChange = (newMics: WiredMic[]) => {
    console.log('=== MICS CHANGE DEBUG ===');
    console.log('FestivalMicKitConfig handleMicsChange called with:', newMics);
    console.log('New mics length:', newMics?.length || 0);
    console.log('New mics type:', typeof newMics);
    console.log('New mics serialized:', JSON.stringify(newMics, null, 2));
    
    // Ensure we always pass a proper array
    const sanitizedMics = Array.isArray(newMics) ? newMics : [];
    console.log('Calling parent onChange with sanitized mics:', sanitizedMics);
    
    onChange(sanitizedMics);
  };

  // Ensure wiredMics is always an array for rendering
  const safeWiredMics = Array.isArray(wiredMics) ? wiredMics : [];

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
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold mb-2">Available Wired Microphones</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure the microphones available for Stage {stageNumber}. Use the "Load from Artist Requirements"
              button to automatically calculate peak needs based on artist submissions.
            </p>
          </div>
          <MicrophoneListBuilder
            value={safeWiredMics}
            onChange={handleMicsChange}
            availableMics={availableMics}
            showExclusiveUse={true}
            showNotes={true}
          />
        </div>

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
