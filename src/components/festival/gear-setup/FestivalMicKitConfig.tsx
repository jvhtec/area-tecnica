
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WiredMicConfig, WiredMic } from "./WiredMicConfig";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";

interface FestivalMicKitConfigProps {
  wiredMics: WiredMic[];
  onChange: (mics: WiredMic[]) => void;
}

export const FestivalMicKitConfig = ({ wiredMics, onChange }: FestivalMicKitConfigProps) => {
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [analysisText, setAnalysisText] = useState("");

  const parseMicrophoneAnalysis = (text: string): WiredMic[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const parsedMics: WiredMic[] = [];
    
    for (const line of lines) {
      // Try to match patterns like "4x Shure SM58" or "2 x Audio-Technica AT2020"
      const match = line.match(/(\d+)\s*x?\s*(.+)/i);
      if (match) {
        const quantity = parseInt(match[1]);
        const model = match[2].trim();
        
        if (quantity > 0 && model) {
          parsedMics.push({
            model,
            quantity,
            exclusive_use: false,
            notes: ''
          });
        }
      }
    }
    
    return parsedMics;
  };

  const handlePasteAnalysis = () => {
    if (!analysisText.trim()) {
      toast.error("Please paste some microphone analysis text");
      return;
    }

    const parsedMics = parseMicrophoneAnalysis(analysisText);
    
    if (parsedMics.length === 0) {
      toast.error("Could not parse any microphones from the text. Please check the format.");
      return;
    }

    // Merge with existing mics, combining quantities for same models
    const existingMicsMap = new Map(wiredMics.map(mic => [mic.model, mic]));
    
    parsedMics.forEach(newMic => {
      if (existingMicsMap.has(newMic.model)) {
        const existing = existingMicsMap.get(newMic.model)!;
        existing.quantity += newMic.quantity;
      } else {
        existingMicsMap.set(newMic.model, newMic);
      }
    });

    const mergedMics = Array.from(existingMicsMap.values());
    onChange(mergedMics);
    
    toast.success(`Added ${parsedMics.length} microphone types from analysis`);
    setPasteDialogOpen(false);
    setAnalysisText("");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Festival Microphone Kit</CardTitle>
          <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Paste from Analysis
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Import Microphone Analysis</DialogTitle>
                <DialogDescription>
                  Paste the results from your microphone requirements analysis. 
                  Format should be like "4x Shure SM58" or "2 x Audio-Technica AT2020", one per line.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="analysis-text">Analysis Results</Label>
                  <Textarea
                    id="analysis-text"
                    placeholder={`Example format:
4x Shure SM58
2x Audio-Technica AT2020
6x Sennheiser e935`}
                    value={analysisText}
                    onChange={(e) => setAnalysisText(e.target.value)}
                    rows={8}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPasteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handlePasteAnalysis}>
                    Import Microphones
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
              Add microphones manually or import from your microphone requirements analysis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
