import type { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import type {
  ArtistRiderFile,
  FestivalArchiveMode,
  FestivalArchiveResult,
  FestivalBackfillResult,
  FestivalJob,
  FestivalLocalFoldersResult,
  FestivalVenueData,
  FestivalWhatsappDepartment,
  JobDocumentEntry,
} from "@/features/festival-management/types";
import { supabase } from "@/integrations/supabase/client";
import { getStaticMapUrlForLocation } from "@/lib/mapbox/mapboxClient";
import type { CreateFoldersOptions } from "@/utils/flex-folders";
import { createAllFoldersForJob, openFlexElement } from "@/utils/flex-folders";
import { resolveJobDocLocation } from "@/utils/jobDocuments";
import { generateAndMergeFestivalPDFs, type FestivalPdfProgress } from "@/utils/pdf/festivalPdfGenerator";
import { generateIndividualStagePDFs } from "@/utils/pdf/individualStagePdfGenerator";
import { optimizeImageForUpload } from "@/utils/imageOptimization";
import { extractFunctionErrorMessage } from "@/utils/supabaseFunctionError";

export const getJobDocumentSignedUrl = async (docEntry: JobDocumentEntry) => {
  const { bucket, path } = resolveJobDocLocation(docEntry.file_path);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

  if (error) throw error;
  return data?.signedUrl ?? null;
};

export const downloadJobDocumentBlob = async (docEntry: JobDocumentEntry) => {
  const { bucket, path } = resolveJobDocLocation(docEntry.file_path);
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) throw error;
  return data;
};

export const getRiderSignedUrl = async (file: ArtistRiderFile) => {
  const { data, error } = await supabase.storage.from("festival_artist_files").createSignedUrl(file.file_path, 3600);

  if (error) throw error;
  return data?.signedUrl ?? null;
};

export const downloadRiderBlob = async (file: ArtistRiderFile) => {
  const { data, error } = await supabase.storage.from("festival_artist_files").download(file.file_path);

  if (error) throw error;
  return data;
};

export const downloadBlobInBrowser = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const downloadLink = window.document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = fileName;
  window.document.body.appendChild(downloadLink);
  downloadLink.click();
  window.document.body.removeChild(downloadLink);
  window.URL.revokeObjectURL(url);
};

export const uploadJobDocument = async ({ file, jobId }: { file: File; jobId: string }) => {
  const uploadFile = await optimizeImageForUpload(file, {
    maxWidth: 1800,
    maxHeight: 1800,
    quality: 0.82,
    outputFormat: "image/webp",
  });
  const filePath = `${jobId}/${uploadFile.name}`;
  const { error: uploadError } = await supabase.storage.from("job_documents").upload(filePath, uploadFile, {
    contentType: uploadFile.type || file.type,
  });

  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from("job_documents").insert({
    job_id: jobId,
    file_name: file.name,
    file_path: filePath,
  });

  if (dbError) {
    const { error: cleanupError } = await supabase.storage.from("job_documents").remove([filePath]);
    if (cleanupError) {
      console.error("Failed to remove uploaded job document after database insert error:", cleanupError);
    }
    throw dbError;
  }
};

export const loadStaticMapPreviewUrl = async (venueData: FestivalVenueData) => {
  if (!venueData.address && !venueData.coordinates) {
    return null;
  }

  return getStaticMapUrlForLocation({
    lat: venueData.coordinates?.lat,
    lng: venueData.coordinates?.lng,
    address: venueData.address || undefined,
    width: 400,
    height: 200,
    zoom: 13,
  });
};

export const ensureNoExistingFlexFolders = async (jobId: string) => {
  const { data, error } = await supabase.from("flex_folders").select("id").eq("job_id", jobId).limit(1);

  if (error) throw error;
  return !data || data.length === 0;
};

export const createFestivalFlexFolders = async ({
  documentNumber,
  endDate,
  job,
  options,
  startDate,
}: {
  documentNumber: string;
  endDate: string;
  job: FestivalJob;
  options?: CreateFoldersOptions;
  startDate: string;
}) => createAllFoldersForJob(job, startDate, endDate, documentNumber, options);

export const broadcastFlexFoldersCreated = async (jobId: string) => {
  try {
    const { error } = await supabase.functions.invoke("push", {
      body: { action: "broadcast", type: "flex.folders.created", job_id: jobId },
    });

    if (error) {
      console.error("Error sending Flex folders push notification:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Flex folders push notification:", error);
    return false;
  }
};

export const openFestivalFlexElement = async ({
  elementId,
  onError,
  onWarning,
}: {
  elementId: string;
  onError: (error: Error) => void;
  onWarning: (message: string) => void;
}) => {
  await openFlexElement({ elementId, onError, onWarning });
};

export const generateFestivalDocumentation = async ({
  filename,
  jobId,
  jobTitle,
  maxStages,
  onProgress,
  options,
}: {
  filename: string;
  jobId: string;
  jobTitle: string;
  maxStages: number;
  onProgress?: (progress: FestivalPdfProgress) => void;
  options: PrintOptions;
}) => {
  if (options.generateIndividualStagePDFs) {
    return generateIndividualStagePDFs(jobId, jobTitle, options, maxStages);
  }

  return generateAndMergeFestivalPDFs(jobId, jobTitle, options, filename, { onProgress });
};

export const createLocalFolders = async (jobId: string) => {
  const { data, error } = await supabase.functions.invoke("create-local-folders", {
    body: { job_id: jobId },
  });

  if (error) throw error;
  return data as FestivalLocalFoldersResult;
};

export const archiveDocumentsToFlex = async ({
  dryRun,
  includeTemplates,
  jobId,
  mode,
}: {
  dryRun: boolean;
  includeTemplates: boolean;
  jobId?: string;
  mode: FestivalArchiveMode;
}) => {
  const { data, error } = await supabase.functions.invoke("archive-to-flex", {
    body: {
      job_id: jobId,
      mode,
      include_templates: includeTemplates,
      dry_run: dryRun,
    },
  });

  if (error) throw error;
  return data as FestivalArchiveResult;
};

export const backfillFlexDocTecnica = async ({
  departments,
  jobId,
  manual,
}: {
  departments: string[];
  jobId?: string;
  manual: Array<{ dept: string; element_id: string }>;
}) => {
  const body: {
    departments?: string[];
    job_id?: string;
    manual?: Array<{ dept: string; element_id: string }>;
  } = { job_id: jobId };

  if (departments.length) body.departments = departments;
  if (manual.length) body.manual = manual;

  const { data, error } = await supabase.functions.invoke("backfill-flex-doc-tecnica", { body });

  if (error) throw error;
  return data as FestivalBackfillResult;
};

export const createWhatsappGroup = async ({
  department,
  jobId,
  stageNumber,
}: {
  department: FestivalWhatsappDepartment;
  jobId?: string;
  stageNumber: number;
}) => {
  const { error } = await supabase.functions.invoke("create-whatsapp-group", {
    body: { job_id: jobId, department, stage_number: stageNumber },
  });

  if (error) throw new Error(await extractFunctionErrorMessage(error));
};

export const clearWhatsappGroupRequest = async ({
  department,
  jobId,
  stageNumber,
}: {
  department: FestivalWhatsappDepartment;
  jobId: string;
  stageNumber: number;
}) => {
  const { data, error } = await supabase.rpc("clear_whatsapp_group_request", {
    p_job_id: jobId,
    p_department: department,
    p_stage_number: stageNumber,
  });

  if (error) throw error;
  return data as { can_retry?: boolean; error?: string; message?: string; success?: boolean };
};

export const sendWarehouseMessage = async ({
  highlight,
  jobId,
  message,
}: {
  highlight: boolean;
  jobId?: string;
  message: string;
}) => {
  const { error } = await supabase.functions.invoke("send-warehouse-message", {
    body: { message, job_id: jobId, highlight },
  });

  if (error) throw error;
};

export const deleteFestivalJob = async (jobId: string) => {
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);

  if (error) throw error;
};
