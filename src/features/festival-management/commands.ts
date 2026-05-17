import type { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";
import { supabase } from "@/integrations/supabase/client";
import type { CreateFoldersOptions } from "@/utils/flex-folders";
import { createAllFoldersForJob, openFlexElement } from "@/utils/flex-folders";
import { resolveJobDocLocation } from "@/utils/jobDocuments";
import { generateIndividualStagePDFs } from "@/utils/pdf/individualStagePdfGenerator";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";

import type {
  FestivalArchiveMode,
  FestivalArchiveResult,
  FestivalBackfillResult,
  FestivalJob,
  FestivalLocalFoldersResult,
  FestivalVenueData,
  FestivalWhatsappDepartment,
  JobDocumentEntry,
  ArtistRiderFile,
} from "./types";

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
  const filePath = `${jobId}/${file.name}`;
  const { error: uploadError } = await supabase.storage.from("job_documents").upload(filePath, file);

  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from("job_documents").insert({
    job_id: jobId,
    file_name: file.name,
    file_path: filePath,
  });

  if (dbError) throw dbError;
};

export const loadStaticMapPreviewUrl = async (venueData: FestivalVenueData) => {
  if (!venueData.address && !venueData.coordinates) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke("get-google-maps-key");
  if (error || !data?.apiKey) {
    console.warn("Failed to load Google Maps API key");
    return null;
  }

  const apiKey = data.apiKey as string;
  const zoom = 13;
  const width = 400;
  const height = 200;
  const scale = 2;
  const center = venueData.coordinates
    ? `${venueData.coordinates.lat},${venueData.coordinates.lng}`
    : encodeURIComponent(venueData.address || "");
  const markers = venueData.coordinates
    ? `&markers=color:red|label:V|${venueData.coordinates.lat},${venueData.coordinates.lng}`
    : venueData.address
      ? `&markers=color:red|label:V|${encodeURIComponent(venueData.address)}`
      : "";

  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${width}x${height}&scale=${scale}${markers}&key=${encodeURIComponent(apiKey)}`;
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
  await supabase.functions.invoke("push", {
    body: { action: "broadcast", type: "flex.folders.created", job_id: jobId },
  });
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
  options,
}: {
  filename: string;
  jobId: string;
  jobTitle: string;
  maxStages: number;
  options: PrintOptions;
}) => {
  if (options.generateIndividualStagePDFs) {
    return generateIndividualStagePDFs(jobId, jobTitle, options, maxStages);
  }

  return generateAndMergeFestivalPDFs(jobId, jobTitle, options, filename);
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

  if (error) throw error;
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
