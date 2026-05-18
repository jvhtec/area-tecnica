import { format } from 'date-fns';
import { fetchTourLogo } from '@/utils/pdf/logoUtils';
import { buildReadableFilename } from '@/utils/fileName';
import {
  createPdfExportDocument,
  drawCorporatePdfHeader,
  getLastAutoTableY,
  loadCompanyLogoDataUrl,
  pdfToBlob,
  safeAddPdfImage,
  SECTOR_PRO_RED,
  type AutoTableFn,
  type AutoTablePdfDocument,
} from '@/utils/pdf/exportHelpers';

interface TourScheduleDate {
  date: string;
  is_tour_pack_only?: boolean | null;
  location?: {
    name?: string | null;
  } | null;
}

interface TourScheduleExport {
  id: string;
  name: string;
  tour_dates?: TourScheduleDate[] | null;
}

const sortedTourDates = (tour: TourScheduleExport): TourScheduleDate[] =>
  [...(tour.tour_dates ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

const tableRowsForTour = (tour: TourScheduleExport) =>
  sortedTourDates(tour).map((date) => [
    format(new Date(date.date), 'dd/MM/yyyy'),
    format(new Date(date.date), 'EEEE'),
    date.location?.name || 'TBC',
    date.is_tour_pack_only ? 'Tour Pack Only' : 'Full Setup',
  ]);

const drawTourScheduleHeader = async (
  pdf: AutoTablePdfDocument,
  tour: TourScheduleExport,
) => {
  let logoUrl: string | undefined;
  try {
    logoUrl = await fetchTourLogo(tour.id);
  } catch (error) {
    console.warn('Could not load tour logo:', error);
  }

  drawCorporatePdfHeader(pdf, {
    title: tour.name,
    subtitle: 'Tour Schedule',
    logo: logoUrl,
  });
};

const drawTourScheduleTable = (
  pdf: AutoTablePdfDocument,
  autoTable: AutoTableFn,
  tour: TourScheduleExport,
) => {
  autoTable(pdf, {
    head: [['Date', 'Day', 'Venue', 'Setup Type']],
    body: tableRowsForTour(tour),
    startY: 40,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 3,
      valign: 'top',
    },
    headStyles: {
      fillColor: SECTOR_PRO_RED,
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 40, halign: 'center' },
    },
    margin: { left: 10, right: 10 },
  });
};

const drawTourScheduleFooter = async (pdf: AutoTablePdfDocument) => {
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const finalY = getLastAutoTableY(pdf, 100);

  pdf.setFontSize(10);
  pdf.setTextColor(...SECTOR_PRO_RED);
  pdf.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 10, finalY + 20);

  const logo = await loadCompanyLogoDataUrl();
  if (!logo) {
    console.warn('Could not load Sector Pro logo from any fallback path');
    return;
  }

  const logoWidth = 40;
  const logoHeight = 15;
  safeAddPdfImage(
    pdf,
    logo,
    'PNG',
    (pageWidth - logoWidth) / 2,
    pageHeight - 30,
    logoWidth,
    logoHeight,
    'Error adding logo to PDF:',
  );
};

const buildTourSchedulePdf = async (tour: TourScheduleExport): Promise<AutoTablePdfDocument> => {
  const { pdf, autoTable } = await createPdfExportDocument();
  await drawTourScheduleHeader(pdf, tour);
  drawTourScheduleTable(pdf, autoTable, tour);
  await drawTourScheduleFooter(pdf);
  return pdf;
};

export const exportTourPDF = async (tour: TourScheduleExport) => {
  const pdf = await buildTourSchedulePdf(tour);
  pdf.save(buildReadableFilename([tour.name, 'schedule']));
};

export const buildTourSchedulePdfBlob = async (tour: TourScheduleExport): Promise<Blob> => {
  const pdf = await buildTourSchedulePdf(tour);
  return pdfToBlob(pdf);
};
