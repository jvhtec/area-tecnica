import { formatInTimeZone } from 'date-fns-tz';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  REPORT_INK,
  drawReportRunningHead,
  loadReportIssuerMark,
  reportGeometry,
  setReportText,
  stampReportFolios,
  type ReportChromeOptions,
} from '@/utils/pdf/report-system';
import type { RackDesignerLayout } from '@/components/sound/amplifier-tool/rack-designer/types';
import {
  AMP_CELL_HEIGHT,
  BLOCK_HEADER_HEIGHT,
  BLOCK_WIDTH,
} from '@/components/sound/amplifier-tool/rack-designer/layout-utils';

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return [209, 213, 219];
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
};

export interface AmpRackLayoutPdfOptions {
  includeRackLabels?: boolean;
}

/**
 * Draws the rack designer layout as a single landscape A4 page: title in a
 * bordered box at the top, then each rack as a stack of colored cells with the
 * preset name (bold) and its IP address, preserving the on-canvas positions.
 */
export const generateAmpRackLayoutPdf = async (
  layout: RackDesignerLayout,
  options: AmpRackLayoutPdfOptions = {},
): Promise<Blob> => {
  const { jsPDF } = await loadPdfLibs();
  const includeRackLabels = options.includeRackLabels ?? false;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await loadReportIssuerMark();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  const title = layout.title.trim() || 'Distribución de amplificadores';
  const chrome: ReportChromeOptions = {
    kind: 'amplifier',
    kindLabel: 'Distribución de amplificadores',
    eventTitle: title,
    contextLabel: formatInTimeZone(new Date(), 'Europe/Madrid', 'dd/MM/yyyy'),
  };

  // The running head names the drawing; the title sits over it in ink rather
  // than inside a keyline box, which was the only rectangle on the page that
  // did not represent a rack.
  const geo = drawReportRunningHead(doc, chrome);
  setReportText(doc, REPORT_INK, 15, 'bold');
  doc.text(title, geo.left, geo.contentTop - 2, { charSpace: -0.08 });

  const blocks = layout.blocks.filter((block) => block.amps.length > 0);
  if (blocks.length > 0) {
    const headerHeight = includeRackLabels ? BLOCK_HEADER_HEIGHT : 0;
    const blockHeight = (ampCount: number) => headerHeight + ampCount * AMP_CELL_HEIGHT;

    const minX = Math.min(...blocks.map((block) => block.x));
    const minY = Math.min(...blocks.map((block) => block.y));
    const maxX = Math.max(...blocks.map((block) => block.x + BLOCK_WIDTH));
    const maxY = Math.max(...blocks.map((block) => block.y + blockHeight(block.amps.length)));

    const contentTop = geo.contentTop + 4;
    const contentBottom = geo.contentBottom;
    const contentWidth = pageWidth - 2 * margin;
    const contentHeight = contentBottom - contentTop;
    const scale = Math.min(
      contentWidth / (maxX - minX),
      contentHeight / (maxY - minY),
      0.22,
    );
    const offsetX = margin + (contentWidth - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = contentTop + (contentHeight - (maxY - minY) * scale) / 2 - minY * scale;

    const cellWidth = BLOCK_WIDTH * scale;
    const cellHeight = AMP_CELL_HEIGHT * scale;
    const nameFontSize = Math.max(5, 38 * scale);
    const ipFontSize = Math.max(4.5, 32 * scale);

    doc.setLineWidth(0.3);
    for (const block of blocks) {
      const [r, g, b] = hexToRgb(block.color);
      const blockX = offsetX + block.x * scale;
      let cursorY = offsetY + block.y * scale;

      if (includeRackLabels) {
        const labelHeight = BLOCK_HEADER_HEIGHT * scale;
        doc.setFillColor(r, g, b);
        doc.rect(blockX, cursorY, cellWidth, labelHeight, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(nameFontSize);
        doc.text(block.label, blockX + cellWidth / 2, cursorY + labelHeight / 2 + nameFontSize * 0.15, {
          align: 'center',
          maxWidth: cellWidth - 2,
        });
        cursorY += labelHeight;
      }

      for (const amp of block.amps) {
        doc.setFillColor(r, g, b);
        doc.rect(blockX, cursorY, cellWidth, cellHeight, 'FD');
        const centerX = blockX + cellWidth / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(nameFontSize);
        doc.text(amp.presetName, centerX, cursorY + cellHeight * 0.42, {
          align: 'center',
          maxWidth: cellWidth - 2,
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(ipFontSize);
        doc.text(amp.ip, centerX, cursorY + cellHeight * 0.82, {
          align: 'center',
          maxWidth: cellWidth - 2,
        });
        cursorY += cellHeight;
      }
    }
  }

  stampReportFolios(doc);

  return doc.output('blob');
};
