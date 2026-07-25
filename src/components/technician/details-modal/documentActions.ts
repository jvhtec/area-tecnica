import type { SupabaseClient } from "@supabase/supabase-js";

import type { TourDocument } from "@/hooks/useTourDocuments";
import type { JobDocument } from "@/types/job";
import { createSignedUrl, resolveJobDocLocation } from "@/utils/jobDocuments";
import type { RiderFile } from "@/components/technician/details-modal/types";

const appendAndClickDownload = (href: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadBlob = async (supabase: SupabaseClient, bucket: string, path: string, fileName: string) => {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw error || new Error("No se pudo descargar el archivo");
  }

  const url = window.URL.createObjectURL(data);
  appendAndClickDownload(url, fileName);
  window.URL.revokeObjectURL(url);
};

export const openJobDocument = async (supabase: SupabaseClient, doc: JobDocument) => {
  const url = await createSignedUrl(supabase, doc.file_path, 60);
  window.open(url, "_blank", "noopener,noreferrer");
};

export const downloadJobDocument = async (supabase: SupabaseClient, doc: JobDocument) => {
  // Fetch as a blob rather than assigning a signed (cross-origin) URL to an
  // anchor's `download` attribute: browsers ignore that attribute across
  // origins, so it would open/navigate instead of downloading.
  const { bucket, path } = resolveJobDocLocation(doc.file_path);
  await downloadBlob(supabase, bucket, path, doc.file_name);
};

export const openTourDocument = async (supabase: SupabaseClient, doc: TourDocument) => {
  const { data, error } = await supabase.storage
    .from("tour-documents")
    .createSignedUrl(doc.file_path, 60);

  if (error || !data?.signedUrl) {
    throw error || new Error("No se pudo generar la URL");
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};

export const downloadTourDocument = async (supabase: SupabaseClient, doc: TourDocument) => {
  await downloadBlob(supabase, "tour-documents", doc.file_path, doc.file_name);
};

export const openRider = async (supabase: SupabaseClient, file: RiderFile) => {
  const { data, error } = await supabase.storage
    .from("festival_artist_files")
    .createSignedUrl(file.file_path, 60);

  if (error || !data?.signedUrl) {
    throw error || new Error("No se pudo generar la URL");
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};

export const downloadRider = async (supabase: SupabaseClient, file: RiderFile) => {
  await downloadBlob(supabase, "festival_artist_files", file.file_path, file.file_name);
};
