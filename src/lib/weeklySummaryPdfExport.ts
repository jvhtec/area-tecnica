import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { categoryLabels } from '@/types/equipment';
import { getLastAutoTableY } from '@/utils/pdf/exportHelpers';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  REPORT_ACCENT,
  distributeColumnWidths,
  drawReportConstantsLine,
  drawReportMasthead,
  drawReportRunningHead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportFolios,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';
import { drawReportEntryHeading } from '@/utils/pdf/report-system/blocks';

interface DailyUsage {
  used: number;
  remaining: number;
  date: Date;
  boost?: number;
  presets?: { name: string; qty: number }[];
  rentals?: { qty: number; notes?: string | null }[];
}

interface WeeklySummaryRow {
  name: string;
  category: string;
  stock: number;
  dailyUsage: DailyUsage[];
  available: number;
}

/** Zero use reads as a middot: present, and visibly nothing. */
const MATRIX_ZERO = '·';

const categoryLabel = (category: string): string =>
  categoryLabels[category as keyof typeof categoryLabels] ?? category;

export const exportWeeklySummaryPDF = async (
  weekStart: Date,
  rows: WeeklySummaryRow[],
  selectedCategories: string[],
  shortagesOnly: boolean = false
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'landscape' });
  await loadReportIssuerMark();

  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const dateRange = `${format(weekStart, "d 'de' MMMM", { locale: es })} – ${format(weekEnd, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  const title = shortagesOnly
    ? 'Faltas de equipamiento'
    : 'Resumen semanal de equipamiento';
  const categoriesText = selectedCategories.length > 0
    ? selectedCategories.map(categoryLabel).join(', ')
    : 'Todas';

  const chrome: ReportChromeOptions = {
    kind: 'equipment',
    kindLabel: title,
    eventTitle: title,
    contextLabel: dateRange,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title,
    subtitle: dateRange,
    meta: [
      { label: 'Categorías', value: categoriesText },
      { label: 'Referencias', value: String(rows.length) },
      { label: 'Emisión', value: new Date().toLocaleDateString('es-ES') },
    ],
  });

  const days = rows[0]?.dailyUsage ?? [];
  const dayCount = days.length;

  const tableHead = [[
    'Equipo',
    'Categoría',
    'Stock',
    ...days.map((day) => format(day.date, 'EEE d', { locale: es })),
    'Disponible',
  ]];

  const tableBody = rows.map((row) => [
    row.name,
    categoryLabel(row.category),
    row.stock.toString(),
    ...row.dailyUsage.map((usage) => {
      const idle = usage.used === 0 && !usage.boost;
      if (idle) return MATRIX_ZERO;
      const content = `${usage.used}${usage.boost && usage.boost > 0 ? ` (+${usage.boost})` : ''}`;
      // A day that oversubscribes the stock is the finding on this sheet, so
      // it is the one thing the accent marks.
      return usage.remaining < 0
        ? { content, styles: { textColor: REPORT_ACCENT as [number, number, number] } }
        : content;
    }),
    row.available < 0
      ? {
          content: row.available.toString(),
          styles: { textColor: REPORT_ACCENT as [number, number, number] },
        }
      : row.available.toString(),
  ]);

  // The day columns are figures and share one width; the two name columns take
  // whatever is left, so a long model name never breaks mid-word.
  const dayWeight = 9;
  const weights = [42, 20, 10, ...Array.from({ length: dayCount }, () => dayWeight), 14];

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: contentTop,
    ...reportTableDefaults(geo, {
      fontSize: 6.8,
      numericColumns: [2, ...days.map((_, index) => index + 3), dayCount + 3],
    }),
    columnStyles: distributeColumnWidths(weights, geo.contentWidth),
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawReportRunningHead(doc, chrome);
    },
  });

  let y = getLastAutoTableY(doc, contentTop) + 12;

  const ensureSpace = (needed: number): ReportGeometry => {
    if (y + needed <= geo.contentBottom) return geo;
    doc.addPage('a4', 'landscape');
    const pageGeo = drawReportRunningHead(doc, chrome);
    y = pageGeo.contentTop;
    return pageGeo;
  };

  ensureSpace(20);
  y = drawReportSectionHeading(doc, geo, 'Detalle por equipo y día', y, 2);

  rows.forEach((row) => {
    const active = row.dailyUsage.filter((day) => (day.used || 0) > 0 || (day.boost || 0) > 0);
    if (active.length === 0) return;

    ensureSpace(28);
    y = drawReportEntryHeading(doc, geo, row.name, y, categoryLabel(row.category).toUpperCase());

    const detailRows = active.map((day) => [
      format(day.date, "EEE d 'de' MMM", { locale: es }),
      `${day.used}${day.boost && day.boost > 0 ? ` (+${day.boost})` : ''}`,
      (day.rentals || []).map((rental) => `+${rental.qty}${rental.notes ? ` · ${rental.notes}` : ''}`).join('\n') || '—',
      (day.presets || []).map((preset) => `${preset.name}: ${preset.qty}`).join('\n') || '—',
    ]);

    autoTable(doc, {
      head: [['Fecha', 'Usado', 'Sub-rentas', 'Presets']],
      body: detailRows,
      startY: y,
      ...reportTableDefaults(geo, { fontSize: 6.8, numericColumns: [1] }),
      columnStyles: distributeColumnWidths([34, 18, 60, 68], geo.contentWidth),
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawReportRunningHead(doc, chrome);
      },
    });
    y = getLastAutoTableY(doc, y) + 8;
  });

  if (rows.length > 0) {
    ensureSpace(12);
    drawReportConstantsLine(
      doc,
      geo,
      [
        { label: 'Semana', value: dateRange },
        { label: 'Categorías', value: categoriesText },
        { label: MATRIX_ZERO, value: 'sin uso ese día' },
      ],
      y,
    );
  }

  stampReportFolios(doc);

  return doc.output('blob');
};
