import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '@/lib/supabase';
import { getFestivalIssuerMarkDataUrl } from '@/utils/pdf/festival-report';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

const COVER_GROUND = rgb(10 / 255, 10 / 255, 9 / 255);
const COVER_ACCENT = rgb(188 / 255, 58 / 255, 58 / 255);
const COVER_PAPER = rgb(1, 1, 1);
const COVER_SOFT = rgb(150 / 255, 144 / 255, 136 / 255);

export interface FestivalCoverStats {
  /** Revision letter. Every issue needs one; a set without it cannot be checked against the copy on the wall. */
  revision?: string;
  artistCount?: number;
  dayCount?: number;
  stageCount?: number;
}

/**
 * Draws the cover artwork: a stage-array line drawing that bleeds off the right
 * edge. It is generated from the set's own shape — one hang per stage — so the
 * mark describes the festival rather than decorating it.
 */
const drawCoverArtwork = (page: PDFPage, stageCount: number): void => {
  const hangs = Math.min(Math.max(stageCount, 2), 5);
  const baseX = PAGE_WIDTH - 96;
  const topY = PAGE_HEIGHT - 150;
  const cabinets = 14;

  for (let hang = 0; hang < hangs; hang += 1) {
    const x = baseX + hang * 54;
    const cabinetHeight = 15 - hang * 0.6;
    const halfWidth = 30 - hang * 2;

    for (let index = 0; index < cabinets; index += 1) {
      // Progressive splay: the lower cabinets widen, as a real hang does.
      const splay = (index / cabinets) ** 1.8 * 16;
      const y = topY - index * cabinetHeight;
      const width = halfWidth + splay;
      page.drawLine({
        start: { x: x - width / 2, y },
        end: { x: x + width / 2, y: y - splay * 0.32 },
        thickness: 0.7,
        color: COVER_ACCENT,
        opacity: 0.34,
      });
    }

    page.drawLine({
      start: { x, y: topY + 24 },
      end: { x, y: topY },
      thickness: 0.7,
      color: COVER_ACCENT,
      opacity: 0.34,
    });
  }
};

const wrapText = (text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] => {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, fontSize) <= maxWidth || !current) {
      current = trial;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const formatDateRange = (start?: string | null, end?: string | null): string => {
  if (!start) return '';
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : startDate;
  if (Number.isNaN(startDate.getTime())) return '';

  if (Number.isNaN(endDate.getTime()) || startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString('es-ES', options);
  }
  return `${startDate.toLocaleDateString('es-ES', options)} — ${endDate.toLocaleDateString('es-ES', options)}`;
};

const embedLogo = async (pdfDoc: PDFDocument, logoUrl: string) => {
  let response = await fetch(logoUrl);
  if (!response.ok && response.status === 401) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (token) {
      response = await fetch(logoUrl, { headers: { Authorization: `Bearer ${token}` } });
    }
  }
  if (!response.ok) throw new Error(`Logo fetch failed with status ${response.status}`);

  const bytes = await response.arrayBuffer();
  const head = new Uint8Array(bytes.slice(0, 8));
  const isPng = head.length >= 8 && head[0] === 0x89 && head[1] === 0x50;
  try {
    return isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  } catch {
    return isPng ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
  }
};

/**
 * Set cover. A document set gets a cover; a one-page report does not.
 *
 * Black ground, the festival's name set large, and a strip carrying the facts
 * that make the issue checkable: revision, days, stages, artists.
 */
export const generateCoverPage = async (
  jobId: string,
  jobTitle: string,
  logoUrl?: string,
  stats: FestivalCoverStats = {},
): Promise<Blob> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const display = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const body = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  const monoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COVER_GROUND });
  drawCoverArtwork(page, stats.stageCount ?? 2);

  const { data: jobData } = await supabase
    .from('jobs')
    .select('start_time, end_time')
    .eq('id', jobId)
    .maybeSingle();

  const dateRangeText = formatDateRange(jobData?.start_time, jobData?.end_time);

  // The issuer mark, recoloured for the black ground. Falls back to the
  // typographic wordmark when the artwork cannot be prepared.
  const issuerMark = await getFestivalIssuerMarkDataUrl('paper');
  let issuerDrawn = false;
  if (issuerMark) {
    try {
      const mark = await pdfDoc.embedPng(issuerMark);
      const width = 92;
      const height = (mark.height / mark.width) * width;
      page.drawImage(mark, { x: MARGIN, y: PAGE_HEIGHT - MARGIN - height, width, height });
      issuerDrawn = true;
    } catch (error) {
      console.warn('No se pudo añadir la marca de Sector-Pro a la portada:', error);
    }
  }
  if (!issuerDrawn) {
    page.drawText('SECTOR-PRO', {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - 8,
      size: 9,
      font: display,
      color: COVER_PAPER,
    });
  }
  page.drawText('DOCUMENTACIÓN TÉCNICA', {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 24,
    size: 7,
    font: mono,
    color: COVER_SOFT,
  });

  // Client mark: once, in its own colour, and nowhere else in the set.
  if (logoUrl) {
    try {
      const logo = await embedLogo(pdfDoc, logoUrl);
      const maxWidth = 116;
      const width = Math.min(maxWidth, logo.width);
      const height = (logo.height / logo.width) * width;
      page.drawImage(logo, {
        x: PAGE_WIDTH - MARGIN - width,
        y: PAGE_HEIGHT - MARGIN - height,
        width,
        height,
      });
    } catch (error) {
      console.warn('No se pudo añadir el logotipo a la portada:', error);
    }
  }

  const title = (jobTitle || 'Festival').trim();
  let titleSize = 52;
  let titleLines = wrapText(title, display, titleSize, PAGE_WIDTH - MARGIN * 2);
  while (titleLines.length > 3 && titleSize > 26) {
    titleSize -= 4;
    titleLines = wrapText(title, display, titleSize, PAGE_WIDTH - MARGIN * 2);
  }

  const titleBaseline = 300 + (titleLines.length - 1) * titleSize * 0.9;
  titleLines.forEach((line, index) => {
    page.drawText(line, {
      x: MARGIN,
      y: titleBaseline - index * titleSize * 0.9,
      size: titleSize,
      font: display,
      color: COVER_PAPER,
    });
  });

  let y = 300 - 34;
  if (dateRangeText) {
    page.drawText(dateRangeText, { x: MARGIN, y, size: 13, font: body, color: COVER_SOFT });
    y -= 22;
  }

  page.drawLine({
    start: { x: MARGIN, y: 148 },
    end: { x: PAGE_WIDTH - MARGIN, y: 148 },
    thickness: 0.6,
    color: COVER_ACCENT,
  });

  const strip: Array<[string, string]> = [
    ['REVISIÓN', (stats.revision ?? 'A').toUpperCase()],
    ['JORNADAS', stats.dayCount ? String(stats.dayCount) : '—'],
    ['ESCENARIOS', stats.stageCount ? String(stats.stageCount) : '—'],
    ['ARTISTAS', stats.artistCount ? String(stats.artistCount) : '—'],
  ];
  const cellWidth = (PAGE_WIDTH - MARGIN * 2) / strip.length;
  strip.forEach(([label, value], index) => {
    const x = MARGIN + cellWidth * index;
    page.drawText(label, { x, y: 130, size: 6.5, font: mono, color: COVER_SOFT });
    page.drawText(value, { x, y: 110, size: 14, font: monoBold, color: COVER_PAPER });
  });

  page.drawText(
    `Emitido ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}. Esta edición sustituye a todas las anteriores.`,
    { x: MARGIN, y: 62, size: 7.5, font: body, color: COVER_SOFT },
  );

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};
