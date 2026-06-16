import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { fetchTourLogo } from '@/utils/pdf/logoUtils';
import { buildReadableFilename } from '@/utils/fileName';
import { MADRID_TIMEZONE } from '@/utils/timezoneUtils';
import {
  PACKAGE_DEPARTMENTS,
  getDepartmentPackageSize,
  getPackageBadgeLabel,
  type TourPackageSize,
} from '@/utils/tourPackages';
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
  sound_package_size?: TourPackageSize | null;
  lights_package_size?: TourPackageSize | null;
  video_package_size?: TourPackageSize | null;
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
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
  );

const tableRowsForTour = (tour: TourScheduleExport) =>
  sortedTourDates(tour).map((date) => [
    format(parseISO(date.date), 'dd/MM/yyyy'),
    format(parseISO(date.date), 'EEEE'),
    date.location?.name || 'TBC',
    PACKAGE_DEPARTMENTS
      .map((department) => {
        const packageSize = getDepartmentPackageSize(date, department);
        return packageSize ? getPackageBadgeLabel({ department, packageSize }) : null;
      })
      .filter(Boolean)
      .join(' · ') || 'Unassigned',
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
  pdf.text(
    `Generated on ${formatInTimeZone(new Date(), MADRID_TIMEZONE, 'dd/MM/yyyy HH:mm')}`,
    10,
    finalY + 20,
  );

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
