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
  // Edge/Chromium may still be processing the download when click() returns.
  // Keep the blob URL alive until the browser has consumed the navigation.
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
    anchor.remove();
  }, 60_000);
};
