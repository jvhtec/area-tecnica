import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
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
  pdfToBlob,
  type AutoTableFn,
  type AutoTablePdfDocument,
} from '@/utils/pdf/exportHelpers';
import {
  distributeColumnWidths,
  drawReportMasthead,
  drawReportRunningHead,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportFolios,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';
import { resolveHeaderLogo } from '@/utils/pdf/shared/pdfExportShared';

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
    format(parseISO(date.date), 'EEEE', { locale: es }),
    date.location?.name || 'Por confirmar',
    PACKAGE_DEPARTMENTS
      .map((department) => {
        const packageSize = getDepartmentPackageSize(date, department);
        return packageSize ? getPackageBadgeLabel({ department, packageSize }) : null;
      })
      .filter(Boolean)
      .join(' · ') || 'Sin asignar',
  ]);

const drawTourScheduleTable = (
  pdf: AutoTablePdfDocument,
  autoTable: AutoTableFn,
  tour: TourScheduleExport,
  geo: ReportGeometry,
  chrome: ReportChromeOptions,
  startY: number,
) => {
  autoTable(pdf, {
    head: [['Fecha', 'Día', 'Recinto', 'Montaje']],
    body: tableRowsForTour(tour),
    startY,
    ...reportTableDefaults(geo, { fontSize: 7.6, numericColumns: [0] }),
    columnStyles: distributeColumnWidths([22, 22, 62, 34], geo.contentWidth),
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) drawReportRunningHead(pdf, chrome);
    },
  });
};

const buildTourSchedulePdf = async (tour: TourScheduleExport): Promise<AutoTablePdfDocument> => {
  const { pdf, autoTable } = await createPdfExportDocument();
  const [clientLogo] = await Promise.all([
    resolveHeaderLogo({ tourId: tour.id }),
    loadReportIssuerMark(),
  ]);

  const dates = sortedTourDates(tour);
  const period = dates.length
    ? `${format(parseISO(dates[0].date), 'dd/MM/yyyy')} – ${format(
        parseISO(dates[dates.length - 1].date),
        'dd/MM/yyyy',
      )}`
    : 'Sin fechas';
  const chrome: ReportChromeOptions = {
    kind: 'tour',
    kindLabel: 'Calendario de gira',
    eventTitle: tour.name,
    contextLabel: period,
  };

  const { geo, y: contentTop } = drawReportMasthead(pdf, {
    ...chrome,
    title: tour.name,
    subtitle: `Calendario de gira · ${period}`,
    clientLogo,
    meta: [
      { label: 'Fechas', value: String(dates.length) },
      { label: 'Periodo', value: period },
      {
        label: 'Emisión',
        value: formatInTimeZone(new Date(), MADRID_TIMEZONE, 'dd/MM/yyyy HH:mm'),
      },
    ],
  });

  drawTourScheduleTable(pdf, autoTable, tour, geo, chrome, contentTop);
  stampReportFolios(pdf);
  return pdf;
};

export const exportTourPDF = async (tour: TourScheduleExport) => {
  const pdf = await buildTourSchedulePdf(tour);
  pdf.save(buildReadableFilename([tour.name, 'calendario']));
};

export const buildTourSchedulePdfBlob = async (tour: TourScheduleExport): Promise<Blob> => {
  const pdf = await buildTourSchedulePdf(tour);
  return pdfToBlob(pdf);
};
