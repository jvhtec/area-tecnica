
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export interface PrintOptions {
  includeGearSetup: boolean;
  gearSetupStages: number[];
  includeShiftSchedules: boolean;
  shiftScheduleStages: number[];
  includeArtistTables: boolean;
  artistTableStages: number[];
  includeArtistRequirements: boolean;
}

interface PrintOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: PrintOptions) => void;
  maxStages: number;
}

export const PrintOptionsDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  maxStages
}: PrintOptionsDialogProps) => {
  const [options, setOptions] = useState<PrintOptions>({
    includeGearSetup: true,
    gearSetupStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeShiftSchedules: true,
    shiftScheduleStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeArtistTables: true,
    artistTableStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeArtistRequirements: true
  });

  const handleStageChange = (section: keyof PrintOptions, stageNumber: number, checked: boolean) => {
    if (section.endsWith('Stages')) {
      setOptions(prev => ({
        ...prev,
        [section]: checked 
          ? [...prev[section], stageNumber].sort((a, b) => a - b)
          : prev[section].filter(s => s !== stageNumber)
      }));
    }
  };

  const renderStageSelections = (section: 'gearSetupStages' | 'shiftScheduleStages' | 'artistTableStages') => {
    return (
      <div className="pl-6 space-y-2">
        <p className="text-sm text-muted-foreground">Select stages:</p>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: maxStages }, (_, i) => i + 1).map((stageNum) => (
            <div key={stageNum} className="flex items-center space-x-2">
              <Checkbox
                id={`${section}-${stageNum}`}
                checked={options[section].includes(stageNum)}
                onCheckedChange={(checked) => 
                  handleStageChange(section, stageNum, checked as boolean)
                }
              />
              <Label htmlFor={`${section}-${stageNum}`}>Stage {stageNum}</Label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleConfirm = () => {
    onConfirm(options);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Documents to Print</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gear-setup"
                  checked={options.includeGearSetup}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeGearSetup: checked as boolean }))
                  }
                />
                <Label htmlFor="gear-setup">Stage Equipment Setup</Label>
              </div>
              {options.includeGearSetup && maxStages > 1 && renderStageSelections('gearSetupStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shift-schedules"
                  checked={options.includeShiftSchedules}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeShiftSchedules: checked as boolean }))
                  }
                />
                <Label htmlFor="shift-schedules">Staff Shift Schedules</Label>
              </div>
              {options.includeShiftSchedules && maxStages > 1 && renderStageSelections('shiftScheduleStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="artist-tables"
                  checked={options.includeArtistTables}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeArtistTables: checked as boolean }))
                  }
                />
                <Label htmlFor="artist-tables">Artist Schedule Tables</Label>
              </div>
              {options.includeArtistTables && maxStages > 1 && renderStageSelections('artistTableStages')}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="artist-requirements"
                checked={options.includeArtistRequirements}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeArtistRequirements: checked as boolean }))
                }
              />
              <Label htmlFor="artist-requirements">Individual Artist Requirements</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

