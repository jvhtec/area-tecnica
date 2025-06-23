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
  includeWiredMicNeeds: boolean;
  wiredMicNeedsStages: number[];
  generateIndividualStagePDFs: boolean;
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
    includeMissingRiderReport: true,
    includeWiredMicNeeds: true,
    wiredMicNeedsStages: Array.from({ length: maxStages }, (_, i) => i + 1),
    generateIndividualStagePDFs: false
  });

  const handleStageChange = (section: keyof PrintOptions, stageNumber: number, checked: boolean) => {
    if (section === 'gearSetupStages' || section === 'shiftScheduleStages' || 
        section === 'artistTableStages' || section === 'artistRequirementStages' || 
        section === 'rfIemTableStages' || section === 'infrastructureTableStages' ||
        section === 'wiredMicNeedsStages') {
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
      infrastructureTableStages: allStages,
      wiredMicNeedsStages: allStages
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
      infrastructureTableStages: [],
      wiredMicNeedsStages: []
    }));
  };

  const generateFilename = (): string => {
    const baseTitle = jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    
    if (options.generateIndividualStagePDFs) {
      return `${baseTitle}_Individual_Stage_PDFs.zip`;
    }
    
    const selectedSections = [];
    if (options.includeShiftSchedules) selectedSections.push('Shifts');
    if (options.includeGearSetup) selectedSections.push('Equipment');
    if (options.includeArtistTables) selectedSections.push('Artist_Tables');
    if (options.includeRfIemTable) selectedSections.push('RF_IEM');
    if (options.includeInfrastructureTable) selectedSections.push('Infrastructure');
    if (options.includeMissingRiderReport) selectedSections.push('Missing_Riders');
    if (options.includeArtistRequirements) selectedSections.push('Artist_Requirements');
    if (options.includeWiredMicNeeds) selectedSections.push('Wired_Mics');

    // If only one section is selected, make it more specific
    if (selectedSections.length === 1) {
      const section = selectedSections[0];
      
      // Get unique stages across all selected sections
      const allSelectedStages = new Set([
        ...(options.includeGearSetup ? options.gearSetupStages : []),
        ...(options.includeShiftSchedules ? options.shiftScheduleStages : []),
        ...(options.includeArtistTables ? options.artistTableStages : []),
        ...(options.includeArtistRequirements ? options.artistRequirementStages : []),
        ...(options.includeRfIemTable ? options.rfIemTableStages : []),
        ...(options.includeInfrastructureTable ? options.infrastructureTableStages : []),
        ...(options.includeWiredMicNeeds ? options.wiredMicNeedsStages : [])
      ]);
      
      const sortedStages = Array.from(allSelectedStages).sort((a, b) => a - b);
      
      if (sortedStages.length < maxStages && sortedStages.length > 0) {
        const stageString = sortedStages.length === 1 
          ? `Stage${sortedStages[0]}`
          : `Stages${sortedStages.join('_')}`;
        return `${baseTitle}_${stageString}_${section}.pdf`;
      }
      
      return `${baseTitle}_${section}.pdf`;
    }

    // If multiple sections or all sections, check if specific stages are selected
    const allSelectedStages = new Set([
      ...(options.includeGearSetup ? options.gearSetupStages : []),
      ...(options.includeShiftSchedules ? options.shiftScheduleStages : []),
      ...(options.includeArtistTables ? options.artistTableStages : []),
      ...(options.includeArtistRequirements ? options.artistRequirementStages : []),
      ...(options.includeRfIemTable ? options.rfIemTableStages : []),
      ...(options.includeInfrastructureTable ? options.infrastructureTableStages : []),
      ...(options.includeWiredMicNeeds ? options.wiredMicNeedsStages : [])
    ]);
    
    const sortedStages = Array.from(allSelectedStages).sort((a, b) => a - b);
    
    if (sortedStages.length < maxStages && sortedStages.length > 0) {
      const stageString = sortedStages.length === 1 
        ? `Stage${sortedStages[0]}`
        : `Stages${sortedStages.join('_')}`;
      return `${baseTitle}_${stageString}_Documentation.pdf`;
    }

    return `${baseTitle}_Complete_Documentation.pdf`;
  };

  const renderStageSelections = (section: 'gearSetupStages' | 'shiftScheduleStages' | 'artistTableStages' | 'artistRequirementStages' | 'rfIemTableStages' | 'infrastructureTableStages' | 'wiredMicNeedsStages') => {
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
          <DialogTitle>Select Documents to Print</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="border rounded-lg p-4 bg-blue-50">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="individual-stage-pdfs"
                checked={options.generateIndividualStagePDFs}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, generateIndividualStagePDFs: checked as boolean }))
                }
              />
              <Label htmlFor="individual-stage-pdfs" className="font-medium">
                Generate Individual Stage PDFs
              </Label>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              {options.generateIndividualStagePDFs 
                ? "Creates separate PDF documents for each stage containing the selected document types. Downloads as a ZIP file containing individual PDFs for each stage."
                : "Create a single combined PDF with the selected document types and stages. Use the stage selections below to choose which stages to include for each document type."
              }
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
                {options.generateIndividualStagePDFs 
                  ? "These controls apply to all sections. Individual PDFs will be generated for stages that have content in each selected document type."
                  : "These controls apply to all sections that have stage selections."
                }
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

            <div>
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
              {options.includeInfrastructureTable && maxStages > 1 && renderStageSelections('infrastructureTableStages')}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wired-mic-needs"
                  checked={options.includeWiredMicNeeds}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeWiredMicNeeds: checked as boolean }))
                  }
                />
                <Label htmlFor="wired-mic-needs">Wired Microphone Requirements</Label>
              </div>
              {options.includeWiredMicNeeds && maxStages > 1 && renderStageSelections('wiredMicNeedsStages')}
              <div className="pl-6 text-sm text-muted-foreground">
                Detailed microphone inventory requirements and peak usage analysis
              </div>
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
                Summary of all artists with missing technical riders
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
            Generate {options.generateIndividualStagePDFs ? 'Individual Stage PDFs' : 'PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
