import { format } from 'date-fns';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Title box, centered at the top.
  const title = layout.title.trim() || 'DISTRIBUCIÓN DE AMPLIFICADORES';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  const titleBoxHeight = 11;
  const titleBoxWidth = Math.min(
    Math.max(doc.getTextWidth(title) + 16, 70),
    pageWidth - 2 * margin,
  );
  doc.rect((pageWidth - titleBoxWidth) / 2, margin, titleBoxWidth, titleBoxHeight);
  doc.text(title, pageWidth / 2, margin + titleBoxHeight / 2 + 2, { align: 'center' });

  const blocks = layout.blocks.filter((block) => block.amps.length > 0);
  if (blocks.length > 0) {
    const headerHeight = includeRackLabels ? BLOCK_HEADER_HEIGHT : 0;
    const blockHeight = (ampCount: number) => headerHeight + ampCount * AMP_CELL_HEIGHT;

    const minX = Math.min(...blocks.map((block) => block.x));
    const minY = Math.min(...blocks.map((block) => block.y));
    const maxX = Math.max(...blocks.map((block) => block.x + BLOCK_WIDTH));
    const maxY = Math.max(...blocks.map((block) => block.y + blockHeight(block.amps.length)));

    const contentTop = margin + titleBoxHeight + 8;
    const contentBottom = pageHeight - 16;
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

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy')}`, margin, pageHeight - 6);

  return new Promise((resolve) => {
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
    logo.onload = () => {
      try {
        const logoWidth = 30;
        const logoHeight = logoWidth * (logo.height / logo.width);
        doc.addImage(logo, 'PNG', pageWidth - margin - logoWidth, pageHeight - logoHeight - 4, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding logo to rack layout PDF:', error);
      }
      resolve(doc.output('blob'));
    };
    logo.onerror = () => {
      console.error('Failed to load logo for rack layout PDF');
      resolve(doc.output('blob'));
    };
  });
};
