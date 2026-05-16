import type { SupabaseClient } from "@supabase/supabase-js";

import type { TourDocument } from "@/hooks/useTourDocuments";
import type { JobDocument } from "@/types/job";
import { createSignedUrl } from "@/utils/jobDocuments";

import type { RiderFile } from "./types";

const appendAndClickDownload = (href: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const openJobDocument = async (supabase: SupabaseClient, doc: JobDocument) => {
  const url = await createSignedUrl(supabase, doc.file_path, 60);
  window.open(url, "_blank");
};

export const downloadJobDocument = async (supabase: SupabaseClient, doc: JobDocument) => {
  const url = await createSignedUrl(supabase, doc.file_path, 60);
  appendAndClickDownload(url, doc.file_name);
};

export const openTourDocument = async (supabase: SupabaseClient, doc: TourDocument) => {
  const { data, error } = await supabase.storage
    .from("tour-documents")
    .createSignedUrl(doc.file_path, 60);

  if (error || !data?.signedUrl) {
    throw error || new Error("No se pudo generar la URL");
  }

  window.open(data.signedUrl, "_blank");
};

export const downloadTourDocument = async (supabase: SupabaseClient, doc: TourDocument) => {
  const { data, error } = await supabase.storage
    .from("tour-documents")
    .createSignedUrl(doc.file_path, 60);

  if (error || !data?.signedUrl) {
    throw error || new Error("No se pudo generar la URL");
  }

  appendAndClickDownload(data.signedUrl, doc.file_name);
};

export const openRider = async (supabase: SupabaseClient, file: RiderFile) => {
  const { data, error } = await supabase.storage
    .from("festival_artist_files")
    .createSignedUrl(file.file_path, 60);

  if (error || !data?.signedUrl) {
    throw error || new Error("No se pudo generar la URL");
  }

  window.open(data.signedUrl, "_blank");
};

export const downloadRider = async (supabase: SupabaseClient, file: RiderFile) => {
  const { data, error } = await supabase.storage
    .from("festival_artist_files")
    .download(file.file_path);

  if (error || !data) {
    throw error || new Error("No se pudo descargar el archivo");
  }

  const url = window.URL.createObjectURL(data);
  appendAndClickDownload(url, file.file_name);
  window.URL.revokeObjectURL(url);
};
