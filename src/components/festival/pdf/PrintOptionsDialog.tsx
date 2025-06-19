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
  artistRequirementStages: number[];
  includeRfIemTable: boolean;
  rfIemTableStages: number[];
  includeInfrastructureTable: boolean;
  infrastructureTableStages: number[];
  includeMissingRiderReport: boolean;
}

interface PrintOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: PrintOptions, filename: string) => void;
  maxStages: number;
  jobTitle: string;
}

export const PrintOptionsDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  maxStages,
  jobTitle
}: PrintOptionsDialogProps) => {
  const [options, setOptions] = useState<PrintOptions>({
    includeGearSetup: true,
    gearSetupStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeShiftSchedules: true,
    shiftScheduleStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeArtistTables: true,
    artistTableStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeArtistRequirements: true,
    artistRequirementStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeRfIemTable: true,
    rfIemTableStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeInfrastructureTable: true,
    infrastructureTableStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    includeMissingRiderReport: true
  });

  const handleStageChange = (section: keyof PrintOptions, stageNumber: number, checked: boolean) => {
    if (section === 'gearSetupStages' || section === 'shiftScheduleStages' || 
        section === 'artistTableStages' || section === 'artistRequirementStages' || 
        section === 'rfIemTableStages' || section === 'infrastructureTableStages') {
      setOptions(prev => ({
        ...prev,
        [section]: checked 
          ? [...prev[section], stageNumber].sort((a, b) => a - b)
          : prev[section].filter(s => s !== stageNumber)
      }));
    }
  };

  const handleSelectAllStages = () => {
    const allStages = Array.from({ length: maxStages }, (_, i) => i + 1);
    setOptions(prev => ({
      ...prev,
      gearSetupStages: allStages,
      shiftScheduleStages: allStages,
      artistTableStages: allStages,
      artistRequirementStages: allStages,
      rfIemTableStages: allStages,
      infrastructureTableStages: allStages
    }));
  };

  const handleDeselectAllStages = () => {
    setOptions(prev => ({
      ...prev,
      gearSetupStages: [],
      shiftScheduleStages: [],
      artistTableStages: [],
      artistRequirementStages: [],
      rfIemTableStages: [],
      infrastructureTableStages: []
    }));
  };

  const generateFilename = (): string => {
    const baseTitle = jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    
    const selectedSections = [];
    if (options.includeShiftSchedules) selectedSections.push('Shifts');
    if (options.includeGearSetup) selectedSections.push('Equipment');
    if (options.includeArtistTables) selectedSections.push('Artist_Schedules');
    if (options.includeRfIemTable) selectedSections.push('RF_IEM');
    if (options.includeInfrastructureTable) selectedSections.push('Infrastructure');
    if (options.includeMissingRiderReport) selectedSections.push('Missing_Riders');
    if (options.includeArtistRequirements) selectedSections.push('Technical_Requirements');

    // Enhanced filename generation for comprehensive documentation
    if (selectedSections.length >= 4) {
      // Get unique stages across all selected sections
      const allSelectedStages = new Set([
        ...(options.includeGearSetup ? options.gearSetupStages : []),
        ...(options.includeShiftSchedules ? options.shiftScheduleStages : []),
        ...(options.includeArtistTables ? options.artistTableStages : []),
        ...(options.includeArtistRequirements ? options.artistRequirementStages : []),
        ...(options.includeRfIemTable ? options.rfIemTableStages : []),
        ...(options.includeInfrastructureTable ? options.infrastructureTableStages : [])
      ]);
      
      const sortedStages = Array.from(allSelectedStages).sort((a, b) => a - b);
      
      if (sortedStages.length < maxStages && sortedStages.length > 0) {
        const stageString = sortedStages.length === 1 
          ? `Stage${sortedStages[0]}`
          : `Stages${sortedStages.join('_')}`;
        return `${baseTitle}_${stageString}_Complete_Festival_Documentation.pdf`;
      }
      
      return `${baseTitle}_Complete_Festival_Documentation.pdf`;
    }

    // If only one section is selected, make it more specific
    if (selectedSections.length === 1) {
      const section = selectedSections[0];
      
      // Get unique stages for the specific section
      let sectionStages: number[] = [];
      if (section === 'Shifts') sectionStages = options.shiftScheduleStages;
      else if (section === 'Equipment') sectionStages = options.gearSetupStages;
      else if (section === 'Artist_Schedules') sectionStages = options.artistTableStages;
      else if (section === 'RF_IEM') sectionStages = options.rfIemTableStages;
      else if (section === 'Infrastructure') sectionStages = options.infrastructureTableStages;
      else if (section === 'Technical_Requirements') sectionStages = options.artistRequirementStages;
      
      if (sectionStages.length < maxStages && sectionStages.length > 0) {
        const stageString = sectionStages.length === 1 
          ? `Stage${sectionStages[0]}`
          : `Stages${sectionStages.join('_')}`;
        return `${baseTitle}_${stageString}_${section}.pdf`;
      }
      
      return `${baseTitle}_${section}.pdf`;
    }

    return `${baseTitle}_Festival_Documentation.pdf`;
  };

  const renderStageSelections = (section: 'gearSetupStages' | 'shiftScheduleStages' | 'artistTableStages' | 'artistRequirementStages' | 'rfIemTableStages' | 'infrastructureTableStages') => {
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
    const filename = generateFilename();
    onConfirm(options, filename);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Festival Documentation</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Enhanced Documentation:</strong> All documents will be generated with proper chronological ordering across all festival dates, including setup and build days.
            </p>
          </div>

          {maxStages > 1 && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">Global Stage Controls</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSelectAllStages}
                >
                  Select All Stages
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDeselectAllStages}
                >
                  Deselect All Stages
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These controls apply to all sections that have stage selections.
              </p>
            </div>
          )}

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
              <div className="pl-6 text-sm text-muted-foreground">
                Includes all festival days: setup, build, rehearsal, and show days
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
              <div className="pl-6 text-sm text-muted-foreground">
                Chronologically ordered across all festival dates
              </div>
              {options.includeArtistTables && maxStages > 1 && renderStageSelections('artistTableStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="artist-requirements"
                  checked={options.includeArtistRequirements}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeArtistRequirements: checked as boolean }))
                  }
                />
                <Label htmlFor="artist-requirements">Individual Artist Technical Requirements</Label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                One page per artist, sorted chronologically by performance time
              </div>
              {options.includeArtistRequirements && maxStages > 1 && renderStageSelections('artistRequirementStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rf-iem-table"
                  checked={options.includeRfIemTable}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeRfIemTable: checked as boolean }))
                  }
                />
                <Label htmlFor="rf-iem-table">Artist RF & IEM Overview</Label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                Chronologically sorted wireless and IEM requirements
              </div>
              {options.includeRfIemTable && maxStages > 1 && renderStageSelections('rfIemTableStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="infrastructure-table"
                  checked={options.includeInfrastructureTable}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeInfrastructureTable: checked as boolean }))
                  }
                />
                <Label htmlFor="infrastructure-table">Infrastructure Needs Overview</Label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                Chronologically sorted infrastructure requirements
              </div>
              {options.includeInfrastructureTable && maxStages > 1 && renderStageSelections('infrastructureTableStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="missing-rider-report"
                  checked={options.includeMissingRiderReport}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeMissingRiderReport: checked as boolean }))
                  }
                />
                <Label htmlFor="missing-rider-report">Missing Rider Report</Label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                Chronologically sorted list of artists with missing technical riders
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="bg-muted/50 p-3 rounded-md">
              <h4 className="text-sm font-medium mb-1">Generated filename:</h4>
              <p className="text-sm text-muted-foreground font-mono">{generateFilename()}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Generate Comprehensive PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
