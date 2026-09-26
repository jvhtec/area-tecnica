export type HojaDeRutaAttachmentSource = "job_documents" | "tour_documents";

export type HojaDeRutaAttachmentRow = {
  id: string;
  job_id?: string | null;
  file_name: string | null;
  file_path: string | null;
  file_type?: string | null;
  uploaded_at?: string | null;
  document_kind?: string | null;
};

export type HojaDeRutaAttachmentDoc = HojaDeRutaAttachmentRow & {
  source: HojaDeRutaAttachmentSource;
};
