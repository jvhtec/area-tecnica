
import { supabase } from '@/lib/supabase';
import { generateAndMergeFestivalPDFs } from './festivalPdfGenerator';
import { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";

interface IndividualStagePDFResult {
  blob: Blob;
  filename: string;
}

export const generateIndividualStagePDFs = async (
  jobId: string,
  jobTitle: string,
  originalOptions: PrintOptions,
  maxStages: number
): Promise<IndividualStagePDFResult> => {
  console.log("Starting individual stage PDF generation");

  // Create a ZIP file to contain all individual stage PDFs
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Fetch stage names for better file naming
  const { data: stageNames, error: stageError } = await supabase
    .from("festival_stages")
    .select("number, name")
    .eq("job_id", jobId)
    .order("number");
  
  if (stageError) {
    console.error("Error fetching stage names:", stageError);
  }
  
  const getStageNameByNumber = (stageNumber: number): string => {
    const stage = stageNames?.find(s => s.number === stageNumber);
    return stage?.name || `Stage_${stageNumber}`;
  };

  // Generate individual PDFs for each stage
  for (let stageNum = 1; stageNum <= maxStages; stageNum++) {
    try {
      console.log(`Generating PDF for stage ${stageNum}`);
      
      // Create stage-specific options
      const stageOptions: PrintOptions = {
        ...originalOptions,
        generateIndividualStagePDFs: false, // Disable this flag for individual generation
        gearSetupStages: originalOptions.includeGearSetup ? [stageNum] : [],
        shiftScheduleStages: originalOptions.includeShiftSchedules ? [stageNum] : [],
        artistTableStages: originalOptions.includeArtistTables ? [stageNum] : [],
        artistRequirementStages: originalOptions.includeArtistRequirements ? [stageNum] : [],
        rfIemTableStages: originalOptions.includeRfIemTable ? [stageNum] : [],
        infrastructureTableStages: originalOptions.includeInfrastructureTable ? [stageNum] : [],
        wiredMicNeedsStages: originalOptions.includeWiredMicNeeds ? [stageNum] : []
      };

      const stageName = getStageNameByNumber(stageNum);
      const stageFilename = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_${stageName}_Documentation.pdf`;

      // Generate the stage-specific PDF
      const result = await generateAndMergeFestivalPDFs(
        jobId,
        jobTitle,
        stageOptions,
        stageFilename
      );

      // Add the PDF to the ZIP file
      zip.file(stageFilename, result.blob);
      console.log(`Added ${stageName} PDF to ZIP`);

    } catch (error) {
      console.error(`Error generating PDF for stage ${stageNum}:`, error);
      // Continue with other stages even if one fails
    }
  }

  // Generate the ZIP file
  console.log("Generating ZIP file with all stage PDFs");
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  const zipFilename = `${jobTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Individual_Stage_PDFs.zip`;

  return {
    blob: zipBlob,
    filename: zipFilename
  };
};
