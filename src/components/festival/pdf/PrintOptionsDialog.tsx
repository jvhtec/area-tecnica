
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { exportMissingRiderReportPDF, MissingRiderReportData } from "@/utils/missingRiderReportPdfExport";
import { exportArtistTablePDF, ArtistTablePdfData } from "@/utils/artistTablePdfExport";
import { exportShiftsTablePDF, ShiftsTablePdfData } from "@/utils/shiftsTablePdfExport";
import { exportRfIemTablePDF, RfIemTablePdfData } from "@/utils/rfIemTablePdfExport";
import { exportInfrastructureTablePDF, InfrastructureTablePdfData } from "@/utils/infrastructureTablePdfExport";
import { exportWiredMicrophoneMatrixPDF, WiredMicrophoneMatrixData, organizeArtistsByDateAndStage } from "@/utils/wiredMicrophoneNeedsPdfExport";
import { generateStageGearPDF } from "@/utils/gearSetupPdfExport";
import { fetchLogoUrl } from "@/utils/pdf/logoUtils";
import { toast } from "sonner";

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
  includeWeatherPrediction: boolean;
  generateIndividualStagePDFs: boolean;
}

interface PrintOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: PrintOptions, filename: string) => void;
  maxStages: number;
  jobTitle: string;
  jobId?: string;
}

export const PrintOptionsDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  maxStages,
  jobTitle,
  jobId
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
    includeWeatherPrediction: true,
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
    if (options.includeWeatherPrediction) selectedSections.push('Weather');

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
      <div className="pl-4 sm:pl-6 space-y-2">
        <p className="text-xs sm:text-sm text-muted-foreground">Select stages:</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {Array.from({ length: maxStages }, (_, i) => i + 1).map((stageNum) => (
            <div key={stageNum} className="flex items-center space-x-2">
              <Checkbox
                id={`${section}-${stageNum}`}
                checked={options[section].includes(stageNum)}
                onCheckedChange={(checked) => 
                  handleStageChange(section, stageNum, checked as boolean)
                }
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
              />
              <Label 
                htmlFor={`${section}-${stageNum}`}
                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
              >
                Stage {stageNum}
              </Label>
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

  const handleDownloadMissingRiderReport = async () => {
    if (!jobId) {
      toast.error('Job ID is required to generate missing rider report');
      return;
    }

    try {
      console.log('Downloading Missing Rider Report for job:', jobId);
      
      // Fetch festival artists
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId);

      if (error) {
        console.error('Error fetching artists:', error);
        throw error;
      }

      // Filter artists with missing riders
      const missingRiderArtists = artists?.filter(artist => 
        Boolean(artist.rider_missing)
      ) || [];

      console.log(`Found ${missingRiderArtists.length} artists with missing riders out of ${artists?.length || 0} total artists`);

      // Fetch logo
      let logoUrl = '';
      try {
        const { data: logoData } = await supabase
          .from('festival_logos')
          .select('file_path')
          .eq('job_id', jobId)
          .maybeSingle();

        if (logoData?.file_path) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('festival-logos')
            .getPublicUrl(logoData.file_path);
          logoUrl = publicUrl;
        }
      } catch (err) {
        console.warn('Could not fetch logo:', err);
      }

      // Prepare data for PDF
      const missingRiderData: MissingRiderReportData = {
        jobTitle,
        logoUrl,
        artists: missingRiderArtists.map(artist => ({
          name: artist.name || 'Unnamed Artist',
          stage: artist.stage || 1,
          date: artist.date || '',
          showTime: {
            start: artist.show_start || '',
            end: artist.show_end || ''
          }
        }))
      };

      // Generate PDF
      const pdfBlob = await exportMissingRiderReportPDF(missingRiderData);
      
      // Download file
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Missing_Rider_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Missing Rider Report downloaded successfully');
    } catch (error: any) {
      console.error('Error generating Missing Rider Report:', error);
      toast.error(`Failed to generate Missing Rider Report: ${error.message}`);
    }
  };

  const handleDownloadGearSetup = async () => {
    if (!jobId) {
      toast.error('Job ID is required to generate gear setup report');
      return;
    }

    try {
      console.log('Downloading Gear Setup for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Generate gear setup PDF for selected stages
      const stagePromises = options.gearSetupStages.map(async (stageNumber) => {
        return await generateStageGearPDF(jobId, stageNumber, logoUrl);
      });

      const gearBlobs = await Promise.all(stagePromises);
      
      if (gearBlobs.length === 1) {
        // Single stage - download directly
        const url = URL.createObjectURL(gearBlobs[0]);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Stage${options.gearSetupStages[0]}_Gear_Setup.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Multiple stages - merge and download
        const { mergePDFs } = await import('@/utils/pdf/pdfMerge');
        const mergedBlob = await mergePDFs(gearBlobs);
        
        const url = URL.createObjectURL(mergedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Gear_Setup.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success('Gear Setup downloaded successfully');
    } catch (error: any) {
      console.error('Error generating Gear Setup:', error);
      toast.error(`Failed to generate Gear Setup: ${error.message}`);
    }
  };

  const handleDownloadShiftSchedules = async () => {
    if (!jobId) {
      toast.error('Job ID is required to generate shift schedules');
      return;
    }

    try {
      console.log('Downloading Shift Schedules for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch shifts data
      const { data: shifts, error } = await supabase
        .from('festival_shifts')
        .select(`
          *,
          festival_shift_assignments (
            technician_id,
            external_technician_name,
            role,
            profiles (first_name, last_name)
          )
        `)
        .eq('job_id', jobId)
        .in('stage', options.shiftScheduleStages)
        .order('date')
        .order('start_time');

      if (error) throw error;

      const shiftsData: ShiftsTablePdfData = {
        jobTitle,
        date: new Date().toISOString().split('T')[0], // Current date as fallback
        logoUrl,
        shifts: shifts || []
      };

      const pdfBlob = await exportShiftsTablePDF(shiftsData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Shift_Schedules.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Shift Schedules downloaded successfully');
    } catch (error: any) {
      console.error('Error generating Shift Schedules:', error);
      toast.error(`Failed to generate Shift Schedules: ${error.message}`);
    }
  };

  const handleDownloadArtistTables = async () => {
    if (!jobId) {
      toast.error('Job ID is required to generate artist tables');
      return;
    }

    try {
      console.log('Downloading Artist Tables for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.artistTableStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const artistData: ArtistTablePdfData = {
        jobTitle,
        date: new Date().toISOString().split('T')[0], // Current date as fallback
        logoUrl,
        artists: artists || []
      };

      const pdfBlob = await exportArtistTablePDF(artistData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Artist_Tables.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Artist Tables downloaded successfully');
    } catch (error: any) {
      console.error('Error generating Artist Tables:', error);
      toast.error(`Failed to generate Artist Tables: ${error.message}`);
    }
  };

  const handleDownloadRfIemTable = async () => {
    if (!jobId) {
      toast.error('Job ID is required to generate RF/IEM table');
      return;
    }

    try {
      console.log('Downloading RF/IEM Table for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.rfIemTableStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const rfIemData: RfIemTablePdfData = {
        jobTitle,
        logoUrl,
        artists: artists || []
      };

      const pdfBlob = await exportRfIemTablePDF(rfIemData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_RF_IEM_Table.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('RF/IEM Table downloaded successfully');
    } catch (error: any) {
      console.error('Error generating RF/IEM Table:', error);
      toast.error(`Failed to generate RF/IEM Table: ${error.message}`);
    }
  };

  const handleDownloadInfrastructureTable = async () => {
    if (!jobId) {
      toast.error('Job ID is required to generate infrastructure table');
      return;
    }

    try {
      console.log('Downloading Infrastructure Table for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.infrastructureTableStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const infraData: InfrastructureTablePdfData = {
        jobTitle,
        logoUrl,
        artists: artists || []
      };

      const pdfBlob = await exportInfrastructureTablePDF(infraData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Infrastructure_Table.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Infrastructure Table downloaded successfully');
    } catch (error: any) {
      console.error('Error generating Infrastructure Table:', error);
      toast.error(`Failed to generate Infrastructure Table: ${error.message}`);
    }
  };

  const handleDownloadWiredMicNeeds = async () => {
    if (!jobId) {
      toast.error('Job ID is required to generate wired microphone needs');
      return;
    }

    try {
      console.log('Downloading Wired Microphone Needs for job:', jobId);
      
      const logoUrl = await fetchLogoUrl(jobId);
      
      // Fetch artists data
      const { data: artists, error } = await supabase
        .from('festival_artists')
        .select('*')
        .eq('job_id', jobId)
        .in('stage', options.wiredMicNeedsStages)
        .order('date')
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const filteredArtists = artists?.filter(artist => 
        artist.mic_kit === 'festival' &&
        artist.wired_mics &&
        Array.isArray(artist.wired_mics) &&
        artist.wired_mics.length > 0
      ) || [];

      const organizedData = organizeArtistsByDateAndStage(filteredArtists);

      const wiredMicData: WiredMicrophoneMatrixData = {
        jobTitle,
        logoUrl,
        artistsByDateAndStage: organizedData
      };

      const pdfBlob = await exportWiredMicrophoneMatrixPDF(wiredMicData);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Wired_Microphone_Needs.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Wired Microphone Needs downloaded successfully');
    } catch (error: any) {
      console.error('Error generating Wired Microphone Needs:', error);
      toast.error(`Failed to generate Wired Microphone Needs: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] sm:max-w-2xl max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto w-full sm:w-auto overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Select Documents to Print</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="individual-stage-pdfs"
                checked={options.generateIndividualStagePDFs}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, generateIndividualStagePDFs: checked as boolean }))
                }
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
              />
              <Label 
                htmlFor="individual-stage-pdfs" 
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
              >
                Generate Individual Stage PDFs
              </Label>
            </div>
            <p className="text-sm text-muted-foreground pl-6 dark:text-gray-300">
              {options.generateIndividualStagePDFs 
                ? "Creates separate PDF documents for each stage containing the selected document types. Downloads as a ZIP file containing individual PDFs for each stage."
                : "Create a single combined PDF with the selected document types and stages. Use the stage selections below to choose which stages to include for each document type."
              }
            </p>
          </div>

          {maxStages > 1 && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3 dark:text-gray-200">Global Stage Controls</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSelectAllStages}
                  className="w-full sm:w-auto"
                >
                  Select All Stages
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDeselectAllStages}
                  className="w-full sm:w-auto"
                >
                  Deselect All Stages
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 dark:text-gray-400">
                {options.generateIndividualStagePDFs 
                  ? "These controls apply to all sections. Individual PDFs will be generated for stages that have content in each selected document type."
                  : "These controls apply to all sections that have stage selections."
                }
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gear-setup"
                    checked={options.includeGearSetup}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeGearSetup: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor="gear-setup"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Stage Equipment Setup
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadGearSetup}
                    className="h-8 px-2"
                    title="Download Gear Setup only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeGearSetup && maxStages > 1 && renderStageSelections('gearSetupStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shift-schedules"
                    checked={options.includeShiftSchedules}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeShiftSchedules: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor="shift-schedules"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Staff Shift Schedules
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadShiftSchedules}
                    className="h-8 px-2"
                    title="Download Shift Schedules only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeShiftSchedules && maxStages > 1 && renderStageSelections('shiftScheduleStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="artist-tables"
                    checked={options.includeArtistTables}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeArtistTables: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor="artist-tables"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Artist Schedule Tables
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadArtistTables}
                    className="h-8 px-2"
                    title="Download Artist Tables only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
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
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                />
                <Label 
                  htmlFor="artist-requirements"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                >
                  Individual Artist Requirements
                </Label>
              </div>
              {options.includeArtistRequirements && maxStages > 1 && renderStageSelections('artistRequirementStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rf-iem-table"
                    checked={options.includeRfIemTable}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeRfIemTable: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor="rf-iem-table"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Artist RF & IEM Overview
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadRfIemTable}
                    className="h-8 px-2"
                    title="Download RF/IEM Table only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeRfIemTable && maxStages > 1 && renderStageSelections('rfIemTableStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="infrastructure-table"
                    checked={options.includeInfrastructureTable}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeInfrastructureTable: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor="infrastructure-table"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Infrastructure Needs Overview
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadInfrastructureTable}
                    className="h-8 px-2"
                    title="Download Infrastructure Table only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeInfrastructureTable && maxStages > 1 && renderStageSelections('infrastructureTableStages')}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wired-mic-needs"
                    checked={options.includeWiredMicNeeds}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeWiredMicNeeds: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor="wired-mic-needs"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Wired Microphone Requirements
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadWiredMicNeeds}
                    className="h-8 px-2"
                    title="Download Wired Microphone Needs only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {options.includeWiredMicNeeds && maxStages > 1 && renderStageSelections('wiredMicNeedsStages')}
              <div className="pl-6 text-sm text-muted-foreground dark:text-gray-300">
                Detailed microphone inventory requirements and peak usage analysis
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="weather-prediction"
                  checked={options.includeWeatherPrediction}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeWeatherPrediction: checked as boolean }))
                  }
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                />
                <Label 
                  htmlFor="weather-prediction"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                >
                  Include Weather Prediction
                </Label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground dark:text-gray-300">
                Weather forecast for festival dates from Open-Meteo
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="missing-rider-report"
                    checked={options.includeMissingRiderReport}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeMissingRiderReport: checked as boolean }))
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor="missing-rider-report"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                  >
                    Missing Rider Report
                  </Label>
                </div>
                {jobId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadMissingRiderReport}
                    className="h-8 px-2"
                    title="Download Missing Rider Report only"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="pl-6 text-sm text-muted-foreground dark:text-gray-300">
                Summary of all artists with missing technical riders
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="bg-muted/50 p-3 rounded-md dark:bg-muted/20">
              <h4 className="text-xs sm:text-sm font-medium mb-1 dark:text-gray-200">Generated filename:</h4>
              <p className="text-xs sm:text-sm text-muted-foreground font-mono dark:text-gray-300 break-all">{generateFilename()}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            <span className="hidden sm:inline">Generate {options.generateIndividualStagePDFs ? 'Individual Stage PDFs' : 'PDF'}</span>
            <span className="sm:hidden">Generate</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
