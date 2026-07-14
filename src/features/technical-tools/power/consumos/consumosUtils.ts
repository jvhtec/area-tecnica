export type ConsumosJob = {
  id: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  date?: string;
  tour_date_id?: string | null;
  tour_date?: {
    date?: string;
    tour?: { name?: string } | null;
    location?: { name?: string } | null;
  } | null;
  location?: { name?: string } | null;
};

export const downloadPdfBlob = (pdfBlob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(pdfBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};
