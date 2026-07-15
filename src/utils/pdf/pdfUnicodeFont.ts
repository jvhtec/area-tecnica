import type jsPDF from 'jspdf';

const FONT_FAMILY = 'NotoSansPdf';
const FONT_FILE = 'NotoSansPdf.ttf';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
};
/**
 * Registers a Unicode-capable font on one jsPDF document. The font is already
 * shipped by the app and jsPDF subsets it to the glyphs used by the report.
 * A null result lets callers fall back to words instead of emitting corrupted
 * electrical symbols when the asset cannot be loaded.
 */
export const registerPdfUnicodeFont = async (
  doc: jsPDF,
): Promise<string | null> => {
  try {
    const response = await fetch('/fonts/NotoSansPdf-Regular.ttf');
    if (!response.ok) return null;
    const fontData = arrayBufferToBase64(await response.arrayBuffer());
    doc.addFileToVFS(FONT_FILE, fontData);
    doc.addFont(FONT_FILE, FONT_FAMILY, 'normal');
    return FONT_FAMILY;
  } catch {
    return null;
  }
};
