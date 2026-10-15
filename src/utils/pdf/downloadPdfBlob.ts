/**
 * Download generated PDF content without navigating the SPA.
 *
 * Chromium/Edge dispatches downloads asynchronously. Revoking a blob URL in
 * the same stack as anchor.click() can invalidate it before the download
 * handler consumes it. Keep only the URL alive temporarily; remove the anchor
 * immediately so it cannot interfere with subsequent UI interaction.
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Keep the URL available for the browser's asynchronous download.
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }
}
