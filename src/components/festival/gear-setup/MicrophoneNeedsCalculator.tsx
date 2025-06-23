import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { WiredMic } from "./WiredMicConfig";

interface MicrophoneNeed {
  model: string;
  maxQuantity: number;
  exclusiveQuantity: number;
  sharedQuantity: number;
  stages: Array<{
    stage: number;
    quantity: number;
    isExclusive: boolean;
    artists: string[];
  }>;
}

interface MicrophoneNeedsCalculatorProps {
  jobId: string;
}

export const MicrophoneNeedsCalculator = ({ jobId }: MicrophoneNeedsCalculatorProps) => {
  const [open, setOpen] = useState(false);
  const [calculatedNeeds, setCalculatedNeeds] = useState<MicrophoneNeed[]>([]);

  const { data: artists = [], isLoading } = useQuery({
    queryKey: ['festival-artists-mics', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_artists')
        .select('id, name, stage, date, show_start, show_end, wired_mics, mic_kit')
        .eq('job_id', jobId)
        .eq('mic_kit', 'festival')
        .not('wired_mics', 'is', null);
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!jobId
  });

  const calculateMicrophoneNeeds = () => {
    const microphoneMap = new Map<string, MicrophoneNeed>();

    // Group artists by stage and date
    const stageGroups = new Map<string, typeof artists>();
    
    artists.forEach(artist => {
      const key = `${artist.stage}-${artist.date}`;
      if (!stageGroups.has(key)) {
        stageGroups.set(key, []);
      }
      stageGroups.get(key)!.push(artist);
    });

    // Process each stage group
    stageGroups.forEach((stageArtists, stageKey) => {
      const [stage, date] = stageKey.split('-');
      
      // Sort artists by show time for consecutive show detection
      const sortedArtists = stageArtists.sort((a, b) => {
        return (a.show_start || '').localeCompare(b.show_start || '');
      });

      // Track microphone usage across the day
      const micUsageByTime = new Map<string, Array<{
        artist: string;
        mics: WiredMic[];
        startTime: string;
        endTime: string;
        exclusive: boolean;
      }>>();

      sortedArtists.forEach(artist => {
        if (!artist.wired_mics || !Array.isArray(artist.wired_mics)) return;

        const wiredMics = artist.wired_mics as WiredMic[];
        wiredMics.forEach(mic => {
          if (!mic.model || !mic.quantity) return;

          const usage = {
            artist: artist.name,
            mics: [mic],
            startTime: artist.show_start || '',
            endTime: artist.show_end || '',
            exclusive: mic.exclusive_use || false
          };

          if (!micUsageByTime.has(mic.model)) {
            micUsageByTime.set(mic.model, []);
          }
          micUsageByTime.get(mic.model)!.push(usage);
        });
      });

      // Calculate peak requirements for each microphone model
      micUsageByTime.forEach((usages, model) => {
        let maxQuantity = 0;
        let exclusiveQuantity = 0;
        let sharedQuantity = 0;

        // Check for overlapping and consecutive shows
        for (let i = 0; i < usages.length; i++) {
          let currentQuantity = 0;
          let currentExclusive = 0;
          let currentShared = 0;
          const artistsAtTime: string[] = [];

          for (let j = 0; j < usages.length; j++) {
            const usage = usages[j];
            const isOverlapping = i === j || isTimeOverlapping(
              usages[i].startTime, usages[i].endTime,
              usage.startTime, usage.endTime
            ) || isConsecutive(
              usages[i].startTime, usages[i].endTime,
              usage.startTime, usage.endTime
            );

            if (isOverlapping) {
              const micQuantity = usage.mics[0]?.quantity || 0;
              currentQuantity += micQuantity;
              artistsAtTime.push(usage.artist);

              if (usage.exclusive) {
                currentExclusive += micQuantity;
              } else {
                // For shared mics, they can't be shared if ANY show in the time window is exclusive
                // or if shows are consecutive (they need separate mic sets)
                const hasExclusiveInWindow = usages.some(u => u.exclusive && (
                  isTimeOverlapping(usage.startTime, usage.endTime, u.startTime, u.endTime) ||
                  isConsecutive(usage.startTime, usage.endTime, u.startTime, u.endTime)
                ));
                
                if (!hasExclusiveInWindow) {
                  currentShared = Math.max(currentShared, micQuantity);
                }
              }
            }
          }

          maxQuantity = Math.max(maxQuantity, currentExclusive + currentShared);
          exclusiveQuantity = Math.max(exclusiveQuantity, currentExclusive);
          sharedQuantity = Math.max(sharedQuantity, currentShared);
        }

        // Update or create microphone need entry
        if (!microphoneMap.has(model)) {
          microphoneMap.set(model, {
            model,
            maxQuantity: 0,
            exclusiveQuantity: 0,
            sharedQuantity: 0,
            stages: []
          });
        }

        const need = microphoneMap.get(model)!;
        need.maxQuantity = Math.max(need.maxQuantity, maxQuantity);
        need.exclusiveQuantity = Math.max(need.exclusiveQuantity, exclusiveQuantity);
        need.sharedQuantity = Math.max(need.sharedQuantity, sharedQuantity);
        
        need.stages.push({
          stage: parseInt(stage),
          quantity: maxQuantity,
          isExclusive: exclusiveQuantity > 0,
          artists: [...new Set(usages.map(u => u.artist))]
        });
      });
    });

    setCalculatedNeeds(Array.from(microphoneMap.values()));
  };

  const isTimeOverlapping = (start1: string, end1: string, start2: string, end2: string): boolean => {
    return start1 < end2 && start2 < end1;
  };

  const isConsecutive = (start1: string, end1: string, start2: string, end2: string): boolean => {
    // Consider shows consecutive if there's less than 30 minutes between them
    const end1Time = new Date(`2000-01-01T${end1}`);
    const start2Time = new Date(`2000-01-01T${start2}`);
    const diff = start2Time.getTime() - end1Time.getTime();
    return diff > 0 && diff <= 30 * 60 * 1000; // 30 minutes in milliseconds
  };

  const exportNeeds = () => {
    const exportData = calculatedNeeds.map(need => ({
      'Microphone Model': need.model,
      'Total Required': need.maxQuantity,
      'Exclusive Use': need.exclusiveQuantity,
      'Shared Use': need.sharedQuantity,
      'Stages': need.stages.map(s => `Stage ${s.stage} (${s.quantity})`).join(', ')
    }));

    const csv = [
      Object.keys(exportData[0] || {}).join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'microphone-needs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCalculate = () => {
    setOpen(true);
    if (artists.length > 0) {
      calculateMicrophoneNeeds();
    }
  };

  return (
    <>
      <Button
        onClick={handleCalculate}
        variant="outline"
        className="w-full"
      >
        <Calculator className="h-4 w-4 mr-2" />
        Calculate Microphone Needs
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Microphone Requirements Calculator</span>
              <div className="flex gap-2">
                {calculatedNeeds.length > 0 && (
                  <Button onClick={exportNeeds} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                )}
                <Button onClick={calculateMicrophoneNeeds} size="sm" disabled={isLoading}>
                  Recalculate
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-8">Loading artist data...</div>
          ) : calculatedNeeds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No microphone requirements found. Make sure artists have wired microphones configured with festival kit selected.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                This calculator analyzes all artists using festival microphone kits and determines peak requirements 
                based on show schedules, exclusive use flags, and prevents sharing between consecutive shows.
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Microphone Model</TableHead>
                    <TableHead>Total Required</TableHead>
                    <TableHead>Exclusive Use</TableHead>
                    <TableHead>Shared Use</TableHead>
                    <TableHead>Stage Breakdown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculatedNeeds.map((need) => (
                    <TableRow key={need.model}>
                      <TableCell className="font-medium">{need.model}</TableCell>
                      <TableCell>
                        <Badge variant="default">{need.maxQuantity}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{need.exclusiveQuantity}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{need.sharedQuantity}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {need.stages.map((stage, idx) => (
                            <div key={idx} className="text-xs">
                              <Badge variant="outline" className="mr-1">
                                Stage {stage.stage}: {stage.quantity}
                              </Badge>
                              {stage.isExclusive && (
                                <Badge variant="destructive" className="text-xs">
                                  Exclusive
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
