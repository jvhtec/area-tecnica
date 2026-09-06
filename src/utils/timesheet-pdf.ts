import { Timesheet } from '@/types/timesheet';
import { JobWithLocationAndDocs } from '@/types/job';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchJobLogo } from '@/utils/pdf/logoUtils';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  distributeColumnWidths,
  drawReportMasthead,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportChrome,
  type ReportChromeOptions,
} from '@/utils/pdf/report-system';
import { isPrepDayTimesheet } from '@/utils/timesheetPrepDays';
import type { CellHookData } from 'jspdf-autotable';

interface GenerateTimesheetPDFOptions {
  /**
   * The job the parte belongs to. `JobWithLocationAndDocs` rather than `Job`
   * because the sheet states where the work happened, and the location only
   * exists on the enriched shape the dialogs already hold.
   */
  job: JobWithLocationAndDocs;
  timesheets: Timesheet[];
  date: string;
}

// Helper function to load signature images as promises
const loadSignatureImage = (signatureData: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error('Error loading signature image:', error);
      reject(error);
    };
    img.src = signatureData;
  });
};

// Helper function to format time display
const formatTime = (time: string | null | undefined): string => {
  if (!time) return '--';
  // Handle both "HH:MM:SS" and "HH:MM" formats
  return time.substring(0, 5); // "09:00:00" -> "09:00"
};

// Helper function to format overtime
const formatOvertime = (overtimeHours: number | null | undefined): string => {
  if (!overtimeHours) return '—';
  return `${overtimeHours} h`;
};

// Helper function to safely load images with timeout
const loadImageSafely = (src: string, description: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn(`Timeout loading ${description}`);
      resolve(null);
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      console.log(`Successfully loaded ${description}`);
      resolve(img);
    };

    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error(`Error loading ${description}:`, error);
      resolve(null);
    };

    img.src = src;
  });
};

export const generateTimesheetPDF = async ({ job, timesheets, date }: GenerateTimesheetPDFOptions) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();

  // Load logos and signatures in parallel
  const [jobLogoUrl, loadedSignatures] = await Promise.all([
    fetchJobLogo(job.id),
    loadSignatures(timesheets),
    loadReportIssuerMark(),
  ]);

  const jobLogo = jobLogoUrl ? await loadImageSafely(jobLogoUrl, 'job logo') : null;

  // Create signature map
  const signatureMap = new Map<string, HTMLImageElement>();
  loadedSignatures.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      signatureMap.set(result.value.timesheetId, result.value.image);
    }
  });

  // Calculate actual date range from timesheets if showing all dates
  let dateText: string;
  if (date === 'all-dates' && timesheets.length > 0) {
    const dates = timesheets.map((t) => parseISO(t.date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    dateText =
      startDate.getTime() === endDate.getTime()
        ? format(startDate, "d 'de' MMMM 'de' yyyy", { locale: es })
        : `${format(startDate, 'd MMM', { locale: es })} – ${format(endDate, "d MMM yyyy", { locale: es })}`;
  } else if (date === 'all-dates') {
    dateText = 'Todas las fechas';
  } else {
    dateText = format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  }

  const location = job.location ?? job.locations;
  const locationText = location?.name || 'Por confirmar';

  const chrome: ReportChromeOptions = {
    kind: 'timesheet',
    kindLabel: 'Parte de horas',
    eventTitle: job.title,
    contextLabel: dateText,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: job.title?.trim() || 'Trabajo sin título',
    subtitle: location?.formatted_address
      ? `Parte de horas · ${location.formatted_address}`
      : 'Parte de horas',
    clientLogo: jobLogo,
    meta: [
      { label: 'Periodo', value: dateText },
      { label: 'Lugar', value: locationText },
      { label: 'Partes', value: String(timesheets.length) },
    ],
  });

  // Group timesheets by date and technician for better organization
  const groupedTimesheets = timesheets.reduce((acc, timesheet) => {
    const key = `${timesheet.date}-${timesheet.technician_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(timesheet);
    return acc;
  }, {} as Record<string, Timesheet[]>);

  const flattenedTimesheets = Object.values(groupedTimesheets).flat();

  // Prepare table data with date grouping
  const tableData = flattenedTimesheets.map((timesheet) => {
    const isPrepDay = isPrepDayTimesheet(timesheet);
    const technicianName = `${timesheet.technician?.first_name || ''} ${timesheet.technician?.last_name || ''}`.trim();
    const startTime = formatTime(timesheet.start_time);
    const endTime = formatTime(timesheet.end_time);
    const overtime = formatOvertime(timesheet.overtime_hours);

    // Calculate total hours
    let totalHours = '—';
    if (timesheet.start_time && timesheet.end_time) {
      const start = new Date(`2000-01-01T${timesheet.start_time}`);
      const end = new Date(`2000-01-01T${timesheet.end_time}`);
      let diffMs = end.getTime() - start.getTime();
      if (timesheet.ends_next_day || diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
      }
      const diffHours = diffMs / (1000 * 60 * 60);
      const breakHours = (timesheet.break_minutes || 0) / 60;
      const workHours = Math.max(0, diffHours - breakHours);
      totalHours = workHours.toFixed(2);
    }

    // The signature column carries the drawn signature where there is one; the
    // word only stands in for the states where no image exists, so "Firmado"
    // never appears next to a blank space.
    let signatureStatus = '—';
    if (signatureMap.has(timesheet.id)) {
      signatureStatus = '';
    } else if (timesheet.signature_data) {
      signatureStatus = 'Error';
    } else if (timesheet.status === 'approved') {
      signatureStatus = 'Pendiente';
    } else if (timesheet.status === 'rejected') {
      signatureStatus = 'Rechazado';
    }

    return [
      format(parseISO(timesheet.date), 'd MMM', { locale: es }),
      isPrepDay ? 'Preparación' : 'Trabajo',
      technicianName,
      startTime,
      endTime,
      totalHours,
      overtime,
      signatureStatus,
    ];
  });

  const SIGNATURE_COLUMN = 7;
  const tableDefaults = reportTableDefaults(geo, {
    fontSize: 7.2,
    numericColumns: [3, 4, 5, 6],
  });

  autoTable(doc, {
    startY: contentTop,
    head: [['Fecha', 'Tipo', 'Técnico', 'Entrada', 'Salida', 'Horas', 'Horas extra', 'Firma']],
    body: tableData,
    ...tableDefaults,
    columnStyles: distributeColumnWidths([14, 16, 32, 13, 13, 12, 16, 22], geo.contentWidth),
    didDrawCell: (data: CellHookData) => {
      tableDefaults.didDrawCell(data);

      if (data.column.index !== SIGNATURE_COLUMN || data.section !== 'body') return;

      const rowIndex = typeof data.row?.index === 'number' ? data.row.index : -1;
      if (rowIndex < 0 || rowIndex >= flattenedTimesheets.length) return;

      const timesheet = flattenedTimesheets[rowIndex];
      if (!timesheet?.id) return;

      const signatureImg = signatureMap.get(timesheet.id);
      if (!signatureImg) return;

      try {
        doc.addImage(
          signatureImg,
          'PNG',
          data.cell.x,
          data.cell.y + 1,
          Math.min(18, data.cell.width - 2),
          Math.max(1, data.cell.height - 2),
        );
      } catch (error) {
        console.error('Error adding signature to table cell:', error);
      }
    },
  });

  stampReportChrome(doc, chrome);

  return doc;
};

// Helper function to load all signatures
const loadSignatures = async (timesheets: Timesheet[]) => {
  const signaturePromises: Promise<{ timesheetId: string; image: HTMLImageElement } | null>[] = [];
  
  for (const timesheet of timesheets) {
    if (timesheet.signature_data) {
      signaturePromises.push(
        loadSignatureImage(timesheet.signature_data)
          .then((image): { timesheetId: string; image: HTMLImageElement } => ({ timesheetId: timesheet.id, image }))
          .catch((error): null => {
            console.error(`Failed to load signature for timesheet ${timesheet.id}:`, error);
            return null;
          })
      );
    }
  }

  return Promise.allSettled(signaturePromises);
};

export const downloadTimesheetPDF = async (options: GenerateTimesheetPDFOptions) => {
  const doc = await generateTimesheetPDF(options);
  
  // Update filename to reflect that it contains all dates
  const fileName = options.date === "all-dates"
    ? `parte-horas-${options.job.title.replace(/[^a-zA-Z0-9]/g, '_')}-todas-las-fechas.pdf`
    : `parte-horas-${options.job.title.replace(/[^a-zA-Z0-9]/g, '_')}-${options.date}.pdf`;
    
  doc.save(fileName);
};
