import { PDFDocument, PDFImage } from "https://esm.sh/pdf-lib@1.17.1";
import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { fetchOptionalMemoriaLogo, SourceByteBudget } from "./memoriaInput.ts";
import { logEvent } from "./structuredLogger.ts";
import {
  drawMemoriaCover,
  drawMemoriaIndex,
  embedMemoriaFonts,
  MEMORIA_PAGE,
  type MemoriaBranding,
  type MemoriaSection,
} from "./memoriaCover.ts";

export { MEMORIA_PAGE } from "./memoriaCover.ts";
export type { MemoriaSection } from "./memoriaCover.ts";

/** Fixed application assets, read through the service client. */
const ISSUER_MARK_CANDIDATES = [
  { bucket: "public logos", path: "sectorpro.png" },
  { bucket: "company-assets", path: "sector-pro-logo.png" },
] as const;

const embedIssuerMark = async (
  pdf: PDFDocument,
  supabase: SupabaseClient,
): Promise<PDFImage | null> => {
  for (const candidate of ISSUER_MARK_CANDIDATES) {
    const { data, error } = await supabase.storage.from(candidate.bucket).download(candidate.path);
    if (error || !data) continue;
    try {
      return await pdf.embedPng(new Uint8Array(await data.arrayBuffer()));
    } catch {
      logEvent("warn", "memoria.issuer_mark_embed_failed", { bucket: candidate.bucket });
    }
  }
  return null;
};

/**
 * Loads the two marks the front matter can carry. Neither is required: the
 * cover falls back to the typographic wordmark, and a memoria without a client
 * logo is still complete.
 */
export const loadMemoriaBranding = async (
  pdf: PDFDocument,
  supabase: SupabaseClient,
  logoUrl: string | null | undefined,
  budget: SourceByteBudget,
): Promise<MemoriaBranding> => {
  let clientLogo: PDFImage | null = null;
  try {
    const logo = await fetchOptionalMemoriaLogo(logoUrl ?? null, budget);
    if (logo) {
      clientLogo = logo.format === "png"
        ? await pdf.embedPng(logo.bytes)
        : await pdf.embedJpg(logo.bytes);
    }
  } catch {
    // A memoria without the client's mark is still complete.
    logEvent("warn", "memoria.client_logo_omitted");
  }

  return { clientLogo, issuerMark: await embedIssuerMark(pdf, supabase) };
};

export interface MemoriaFrontMatterOptions {
  /** "Sonido", "Iluminación", "Vídeo". */
  department: string;
  projectName: string;
  branding: MemoriaBranding;
  /**
   * The documents about to be appended, in order. Omit for a set that is a
   * single pre-built document: it gets a cover and no index.
   */
  sections?: MemoriaSection[];
}

/**
 * Adds the cover and, when there is more than one document, the index — then
 * leaves the merge to append the sources.
 */
export const buildMemoriaFrontMatter = async (
  pdf: PDFDocument,
  options: MemoriaFrontMatterOptions,
): Promise<void> => {
  const fonts = await embedMemoriaFonts(pdf);
  const sections = options.sections ?? [];
  const hasIndex = sections.length > 0;

  const coverPage = pdf.addPage([MEMORIA_PAGE.width, MEMORIA_PAGE.height]);
  drawMemoriaCover(coverPage, fonts, {
    department: options.department,
    projectName: options.projectName,
    sectionCount: hasIndex ? sections.length : undefined,
    ...options.branding,
  });

  if (!hasIndex) return;

  const indexPage = pdf.addPage([MEMORIA_PAGE.width, MEMORIA_PAGE.height]);
  drawMemoriaIndex(indexPage, fonts, {
    department: options.department,
    sections,
    // Cover and index are pages 1 and 2, so the set starts on page 3.
    firstContentPage: 3,
    ...options.branding,
  });
};
