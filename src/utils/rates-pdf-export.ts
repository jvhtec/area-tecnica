import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TourJobRateQuote } from '@/types/tourRates';
import { formatMultiplier, getPerJobMultiplier } from '@/lib/tourRateMath';
import { formatCurrency } from '@/lib/utils';
import { fetchJobLogo, fetchTourLogo, getCompanyLogo } from '@/utils/pdf/logoUtils';

export interface TechnicianProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  default_timesheet_category?: string | null;
  role?: string | null;
}

export interface JobDetails {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  tour_id?: string | null;
  job_type?: string | null;
}

interface TourSummaryJob {
  job: JobDetails;
  quotes: TourJobRateQuote[];
  lpoMap?: Map<string, string | null>;
}

interface PayoutData {
  job_id: string;
  technician_id: string;
  timesheets_total_eur: number;
  extras_total_eur: number;
  total_eur: number;
  extras_breakdown?: {
    items?: Array<{
      extra_type: string;
      quantity: number;
      unit_eur: number;
      amount_eur: number;
    }>;
  };
  vehicle_disclaimer?: boolean;
  vehicle_disclaimer_text?: string;
}

export interface TimesheetLine {
  date?: string | null;
  hours_rounded?: number;
  base_day_eur?: number;
  plus_10_12_hours?: number;
  plus_10_12_amount_eur?: number;
  overtime_hours?: number;
  overtime_hour_eur?: number;
  overtime_amount_eur?: number;
  total_eur?: number;
}

const CORPORATE_RED: [number, number, number] = [125, 1, 1];
const TEXT_PRIMARY: [number, number, number] = [31, 41, 55];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];
const TABLE_STRIPE_COLOR: [number, number, number] = [248, 248, 248];
const SUMMARY_BACKGROUND: [number, number, number] = [250, 250, 250];
const HEADER_HEIGHT = 44;
const HEADER_CONTENT_OFFSET = HEADER_HEIGHT + 18;
// Reserve space at the bottom for footer so tables/text never collide with it
const FOOTER_RESERVED = 38; // px, keep enough room for logo + page text
const loadImageSafely = (src: string, description: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load ${description} from`, src);
      resolve(null);
    };
    img.src = src;
  });
};

interface HeaderOptions {
  title: string;
  subtitle?: string;
  metadata?: string;
  logo?: HTMLImageElement | null;
}

const drawCorporateHeader = (doc: jsPDF, { title, subtitle, metadata, logo }: HeaderOptions) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...CORPORATE_RED);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  if (logo) {
    try {
      const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
      const logoHeight = 26;
      const logoWidth = logoHeight * ratio;
      doc.addImage(logo, 'PNG', 16, 9, logoWidth, logoHeight);
    } catch (error) {
      console.error('Error adding logo to PDF header:', error);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(subtitle, pageWidth / 2, 31, { align: 'center' });
  }

  if (metadata) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(metadata, pageWidth - 18, HEADER_HEIGHT - 10, { align: 'right' });
  }

  doc.setTextColor(...TEXT_PRIMARY);

  return HEADER_CONTENT_OFFSET;
};

const drawCorporateFooter = (doc: jsPDF, logo: HTMLImageElement | null) => {
  const pageCount = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    doc.setPage(pageNumber);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const footerY = pageHeight - 12;

    if (logo) {
      try {
        const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
        const logoHeight = 12;
        const logoWidth = logoHeight * ratio;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logo, 'PNG', logoX, footerY - logoHeight - 3, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error adding logo to PDF footer:', error);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);

    doc.text('Sector-Pro', 18, footerY);

    const pageText = `Página ${pageNumber} de ${pageCount}`;
    doc.text(pageText, pageWidth - 18, footerY, { align: 'right' });
  }

  doc.setTextColor(...TEXT_PRIMARY);
};

const resolveHeaderLogo = async ({
  jobId,
  tourId,
}: {
  jobId?: string;
  tourId?: string | null;
}): Promise<HTMLImageElement | null> => {
  const [tourLogoUrl, jobLogoUrl] = await Promise.all([
    tourId ? fetchTourLogo(tourId) : Promise.resolve(undefined),
    jobId ? fetchJobLogo(jobId) : Promise.resolve(undefined),
  ]);

  const brandingUrl = tourLogoUrl || jobLogoUrl;
  if (!brandingUrl) {
    return null;
  }

  return loadImageSafely(brandingUrl, 'tour or job logo');
};

const getTechNameFactory = (profiles: TechnicianProfile[]) => {
  return (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return 'Unknown';
    const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
    return name || 'Unknown';
  };
};

const formatJobDate = (date: string) => format(new Date(date), 'PPP', { locale: es });

const BASE_VALUE_EPSILON = 0.5; // tolerate rounding differences when comparing backend totals
const MULTIPLIER_DISPLAY_EPSILON = 0.0001;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const computeEffectiveBase = (quote: TourJobRateQuote) => {
  const rawMultiplier = getPerJobMultiplier(quote);
  const appliedMultiplier = rawMultiplier ?? 1;

  const breakdownBase =
    quote.breakdown?.after_discount ?? quote.breakdown?.base_calculation ?? undefined;
  const backendBase = Number(quote.base_day_eur ?? 0);
  const preMultiplierBase = Number(breakdownBase ?? backendBase);
  const recalculated = roundCurrency(preMultiplierBase * appliedMultiplier);
  const extrasTotal = Number(quote.extras_total_eur ?? 0);

  const usedFallbackBase = breakdownBase == null;

  let effectiveBase = recalculated;

  if (usedFallbackBase || rawMultiplier == null) {
    // Without explicit multiplier data we trust the backend value to avoid double application.
    effectiveBase = backendBase;
  } else if (Math.abs(recalculated - backendBase) <= BASE_VALUE_EPSILON) {
    // Treat small differences as rounding noise and align with backend totals.
    effectiveBase = backendBase;
  }

  return {
    effectiveBase,
    extrasTotal,
    preMultiplierBase,
    rawMultiplier,
    usedFallbackBase,
  };
};

const withLpo = (name: string, lpo?: string | null) => (lpo ? `${name}\nLPO: ${lpo}` : name);

// Generate PDF for individual rate quote (single job date)
export async function generateRateQuotePDF(
  quotes: TourJobRateQuote[],
  jobDetails: JobDetails,
  profiles: TechnicianProfile[],
  lpoMap?: Map<string, string | null>,
  options?: { download?: boolean }
): Promise<Blob | void> {
  const doc = new jsPDF();
  const tourIdFromQuotes = quotes.find((quote) => quote.tour_id)?.tour_id;
  const [headerLogo, companyLogo] = await Promise.all([
    resolveHeaderLogo({
      jobId: jobDetails.id,
      tourId: jobDetails.tour_id ?? tourIdFromQuotes,
    }),
    getCompanyLogo(),
  ]);
  const headerOptions: HeaderOptions = {
    title: 'Presupuesto de Tarifas',
    subtitle: jobDetails.title,
    metadata: `Generado: ${format(new Date(), 'PPP', { locale: es })}`,
    logo: headerLogo,
  };
  const contentTop = drawCorporateHeader(doc, headerOptions);

  let yPos = contentTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  doc.text('Detalles del Trabajo', 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Nombre: ${jobDetails.title}`, 14, yPos);
  yPos += 5;
  doc.text(`Fecha: ${formatJobDate(jobDetails.start_time)}`, 14, yPos);
  yPos += 10;

  doc.setTextColor(...TEXT_PRIMARY);

  const getTechName = getTechNameFactory(profiles);

  const quotesWithComputed = quotes.map((quote) => ({
    quote,
    computed: computeEffectiveBase(quote),
  }));

  const tableData = quotesWithComputed.map(({ quote, computed }) => {
    const name = getTechName(quote.technician_id);
    const lpo = lpoMap?.get(quote.technician_id) ?? null;
    const { effectiveBase, extrasTotal, rawMultiplier } = computed;
    return [
      withLpo(name, lpo),
      quote.is_house_tech ? 'Plantilla' : quote.category || '—',
      formatCurrency(effectiveBase),
      formatMultiplier(rawMultiplier),
      formatCurrency(extrasTotal),
      formatCurrency(effectiveBase + extrasTotal),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Categoría', 'Base', 'Mult.', 'Extras', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: CORPORATE_RED, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: contentTop, bottom: FOOTER_RESERVED },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawCorporateHeader(doc, headerOptions);
      }
    },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY ?? yPos) + 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const summaryWidth = pageWidth - 28;

  const totalBase = quotesWithComputed.reduce(
    (sum, { computed }) => sum + computed.effectiveBase,
    0
  );
  const totalExtras = quotesWithComputed.reduce(
    (sum, { computed }) => sum + computed.extrasTotal,
    0
  );
  const grandTotal = quotesWithComputed.reduce(
    (sum, { computed }) => sum + computed.effectiveBase + computed.extrasTotal,
    0
  );

  doc.setFillColor(...SUMMARY_BACKGROUND);
  doc.roundedRect(14, finalY, summaryWidth, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...CORPORATE_RED);
  doc.text('Resumen', 18, finalY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Total Base: ${formatCurrency(totalBase)}`, 18, finalY + 18);
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 18, finalY + 26);

  const totalText = `Total General: ${formatCurrency(grandTotal)}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, 14 + summaryWidth - totalWidth - 6, finalY + 22);

  const footerLogo = companyLogo ?? headerLogo;
  drawCorporateFooter(doc, footerLogo);

  const filename = `presupuesto_${jobDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(
    new Date(),
    'yyyy-MM-dd'
  )}.pdf`;
  if (options?.download === false) {
    const blob = doc.output('blob') as Blob;
    return blob;
  }
  doc.save(filename);
}

// Generate PDF for entire tour (all dates)
export async function generateTourRatesSummaryPDF(
  tourName: string,
  jobsWithQuotes: TourSummaryJob[],
  profiles: TechnicianProfile[]
) {
  const doc = new jsPDF();
  const tourId = jobsWithQuotes.find((job) => job.quotes.length)?.quotes[0]?.tour_id;
  const [headerLogo, companyLogo] = await Promise.all([
    resolveHeaderLogo({ tourId }),
    getCompanyLogo(),
  ]);
  const headerOptions: HeaderOptions = {
    title: 'Resumen de Tarifas',
    subtitle: tourName,
    metadata: `Generado: ${format(new Date(), 'PPP', { locale: es })}`,
    logo: headerLogo,
  };
  const contentTop = drawCorporateHeader(doc, headerOptions);

  const getTechName = getTechNameFactory(profiles);
  const sortedJobs = [...jobsWithQuotes].sort(
    (a, b) => new Date(a.job.start_time).getTime() - new Date(b.job.start_time).getTime()
  );

  let yPos = contentTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...CORPORATE_RED);
  doc.text(`Total de fechas: ${sortedJobs.length}`, 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Resumen general por técnico', 14, yPos);
  yPos += 6;

  doc.setTextColor(...TEXT_PRIMARY);

  const techTotals = new Map<string, { name: string; dates: number; total: number; lpos: Set<string> }>();

  sortedJobs.forEach(({ quotes, lpoMap }) => {
    quotes.forEach((quote) => {
      const techId = quote.technician_id;
      if (!techId) return;

      const { effectiveBase, extrasTotal } = computeEffectiveBase(quote);
      const effectiveTotal = effectiveBase + extrasTotal;
      const existing =
        techTotals.get(techId) || {
          name: getTechName(techId),
          dates: 0,
          total: 0,
          lpos: new Set<string>(),
        };

      existing.dates += 1;
      existing.total += effectiveTotal;

      const lpo = lpoMap?.get(techId);
      if (lpo) existing.lpos.add(lpo);

      techTotals.set(techId, existing);
    });
  });

  const summaryRows = Array.from(techTotals.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => [
      item.name,
      item.dates.toString(),
      item.lpos.size ? Array.from(item.lpos).join(', ') : '—',
      formatCurrency(item.total),
    ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Fechas', 'LPOs', 'Total Gira']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: CORPORATE_RED, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'left' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: contentTop, bottom: FOOTER_RESERVED },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawCorporateHeader(doc, headerOptions);
      }
    },
  });

  const summaryFinalY = ((doc as any).lastAutoTable?.finalY ?? yPos) + 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - 28;
  const tourGrandTotal = Array.from(techTotals.values()).reduce((sum, item) => sum + item.total, 0);

  doc.setFillColor(...SUMMARY_BACKGROUND);
  doc.roundedRect(14, summaryFinalY, boxWidth, 26, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  doc.text(`Total General de Gira: ${formatCurrency(tourGrandTotal)}`, 18, summaryFinalY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Total de técnicos: ${techTotals.size}`, 18, summaryFinalY + 22);

  doc.addPage();
  let headerOffset = drawCorporateHeader(doc, headerOptions);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...CORPORATE_RED);
  doc.text('Desglose por Fecha', 14, headerOffset);

  let breakdownY = headerOffset + 8;
  const pageHeight = doc.internal.pageSize.getHeight();

  sortedJobs.forEach((item, index) => {
    if (!item.quotes.length) return;

    if (breakdownY > pageHeight - (FOOTER_RESERVED + 60)) {
      doc.addPage();
      headerOffset = drawCorporateHeader(doc, headerOptions);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...CORPORATE_RED);
      doc.text('Desglose por Fecha (cont.)', 14, headerOffset);
      breakdownY = headerOffset + 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...CORPORATE_RED);
    doc.text(`${formatJobDate(item.job.start_time)} • ${item.job.title}`, 14, breakdownY);
    breakdownY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${item.quotes.length} asignaciones`, 14, breakdownY);
    breakdownY += 4;

    const jobTableRows = item.quotes.map((quote) => {
      const name = getTechName(quote.technician_id);
      const lpo = item.lpoMap?.get(quote.technician_id) ?? null;
      const {
        effectiveBase,
        extrasTotal,
        preMultiplierBase,
        rawMultiplier,
        usedFallbackBase,
      } = computeEffectiveBase(quote);

      const shouldDisplayMultiplier =
        !usedFallbackBase && rawMultiplier != null && Math.abs(rawMultiplier - 1) >= MULTIPLIER_DISPLAY_EPSILON;
      const baseText = shouldDisplayMultiplier
        ? `${formatCurrency(preMultiplierBase)} ${formatMultiplier(rawMultiplier)} = ${formatCurrency(effectiveBase)}`
        : formatCurrency(effectiveBase);

      let nameCell = withLpo(name, lpo);
      const hrs = Number(
        (quote.breakdown && (quote.breakdown.single_hours_total ?? quote.breakdown.hours_rounded ?? quote.breakdown.worked_hours_rounded)) || 0
      );
      const plus = Number(quote.breakdown?.single_plus_10_12_total_eur ?? 0);
      const otH = Number(quote.breakdown?.single_overtime_hours_total ?? 0);
      const otAmt = Number(quote.breakdown?.single_overtime_amount_total_eur ?? 0);
      const parts: string[] = [];
      if (hrs > 0) parts.push(`Horas: ${hrs}h`);
      if (plus > 0) parts.push(`+10–12: ${formatCurrency(plus)}`);
      if (otH > 0) parts.push(`HE: ${otH}h = ${formatCurrency(otAmt)}`);
      if (parts.length) {
        nameCell = `${nameCell}\n${parts.join(' · ')}`;
      }

      return [
        nameCell,
        quote.is_house_tech ? 'Plantilla' : quote.category || '—',
        baseText,
        formatCurrency(extrasTotal),
        formatCurrency(effectiveBase + extrasTotal),
      ];
    });

    autoTable(doc, {
      startY: breakdownY,
      head: [['Técnico', 'Categoría', 'Base', 'Extras', 'Total']],
      body: jobTableRows,
      theme: 'grid',
      headStyles: { fillColor: CORPORATE_RED, textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, top: headerOffset, bottom: FOOTER_RESERVED },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawCorporateHeader(doc, headerOptions);
        }
      },
    });

    breakdownY = ((doc as any).lastAutoTable?.finalY ?? breakdownY) + 6;

    const { jobBaseTotal, jobExtrasTotal, jobGrandTotal } = item.quotes.reduce(
      (acc, quote) => {
        const { effectiveBase, extrasTotal } = computeEffectiveBase(quote);
        acc.jobBaseTotal += effectiveBase;
        acc.jobExtrasTotal += extrasTotal;
        acc.jobGrandTotal += effectiveBase + extrasTotal;
        return acc;
      },
      { jobBaseTotal: 0, jobExtrasTotal: 0, jobGrandTotal: 0 }
    );

    // If there isn't enough room for the totals line, continue on a new page
    if (breakdownY > pageHeight - (FOOTER_RESERVED + 16)) {
      doc.addPage();
      headerOffset = drawCorporateHeader(doc, headerOptions);
      breakdownY = headerOffset + 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...CORPORATE_RED);
    doc.text(
      `Totales — Base: ${formatCurrency(jobBaseTotal)} · Extras: ${formatCurrency(jobExtrasTotal)} · General: ${formatCurrency(jobGrandTotal)}`,
      18,
      breakdownY
    );

    breakdownY += 10;
    doc.setTextColor(...TEXT_PRIMARY);
  });

  const footerLogo = companyLogo ?? headerLogo;
  drawCorporateFooter(doc, footerLogo);

  const filename = `resumen_gira_${tourName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(
    new Date(),
    'yyyy-MM-dd'
  )}.pdf`;
  doc.save(filename);
}

// Generate PDF for job payout totals
export async function generateJobPayoutPDF(
  payouts: PayoutData[],
  jobDetails: JobDetails,
  profiles: TechnicianProfile[],
  lpoMap?: Map<string, string | null>,
  timesheetMap?: Map<string, TimesheetLine[]>,
  options?: { download?: boolean }
): Promise<Blob | void> {
  const doc = new jsPDF();
  const [headerLogo, companyLogo] = await Promise.all([
    resolveHeaderLogo({
      jobId: jobDetails.id,
      tourId: jobDetails.tour_id,
    }),
    getCompanyLogo(),
  ]);
  const headerOptions: HeaderOptions = {
    title: 'Informe de Pagos',
    subtitle: jobDetails.title,
    metadata: `Generado: ${format(new Date(), 'PPP', { locale: es })}`,
    logo: headerLogo,
  };
  const contentTop = drawCorporateHeader(doc, headerOptions);

  let yPos = contentTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  doc.text('Detalles del Trabajo', 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Nombre: ${jobDetails.title}`, 14, yPos);
  yPos += 5;
  doc.text(`Fecha: ${formatJobDate(jobDetails.start_time)}`, 14, yPos);
  yPos += 10;

  doc.setTextColor(...TEXT_PRIMARY);

  const getTechName = getTechNameFactory(profiles);

  const tableData = payouts.map((payout) => {
    const name = getTechName(payout.technician_id);
    const lpo = lpoMap?.get(payout.technician_id) ?? null;
    return [
      withLpo(name, lpo),
      formatCurrency(payout.timesheets_total_eur),
      formatCurrency(payout.extras_total_eur),
      formatCurrency(payout.total_eur),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Partes', 'Extras', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: CORPORATE_RED, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: contentTop, bottom: FOOTER_RESERVED },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawCorporateHeader(doc, headerOptions);
      }
    },
  });

  let currentY = ((doc as any).lastAutoTable?.finalY ?? yPos) + 12;
  const pageHeight = doc.internal.pageSize.getHeight();

  const payoutsWithExtras = payouts.filter(
    (payout) => payout.extras_breakdown?.items && payout.extras_breakdown.items.length > 0
  );

  // Detailed timesheets breakdown section
  const techIdsWithTimesheets = Array.from(new Set((payouts || []).map(p => p.technician_id))).filter(
    (id) => (timesheetMap?.get(id) || []).length > 0
  );
  if (techIdsWithTimesheets.length > 0) {
    if (currentY > pageHeight - (FOOTER_RESERVED + 60)) {
      doc.addPage();
      currentY = drawCorporateHeader(doc, headerOptions) + 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...CORPORATE_RED);
    doc.text('Desglose de Partes', 14, currentY);
    currentY += 7;

    for (const payout of payouts) {
      const lines = timesheetMap?.get(payout.technician_id) || [];
      if (!lines.length) continue;

      if (currentY > pageHeight - (FOOTER_RESERVED + 40)) {
        doc.addPage();
        currentY = drawCorporateHeader(doc, headerOptions) + 2;
      }

      const name = getTechName(payout.technician_id);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(name, 14, currentY);
      currentY += 5;

      const tableRows = lines.map((ln) => [
        ln.date ? format(new Date(ln.date), 'P', { locale: es }) : '—',
        `${ln.hours_rounded ?? 0}h`,
        formatCurrency(ln.base_day_eur ?? 0),
        ln.plus_10_12_amount_eur ? `${ln.plus_10_12_hours ?? 0}h = ${formatCurrency(ln.plus_10_12_amount_eur)}` : '—',
        (ln.overtime_hours ?? 0) > 0
          ? `${ln.overtime_hours}h × ${formatCurrency(ln.overtime_hour_eur ?? 0)} = ${formatCurrency(
              ln.overtime_amount_eur ?? 0
            )}`
          : '—',
        formatCurrency(ln.total_eur ?? 0),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Fecha', 'Horas', 'Base día', '+10–12', 'OT', 'Total Parte']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: CORPORATE_RED, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, top: contentTop, bottom: FOOTER_RESERVED },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            drawCorporateHeader(doc, headerOptions);
          }
        },
      });

      currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;
    }
  }

  if (payoutsWithExtras.length > 0) {
    if (currentY > pageHeight - (FOOTER_RESERVED + 60)) {
      doc.addPage();
      currentY = drawCorporateHeader(doc, headerOptions) + 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...CORPORATE_RED);
    doc.text('Desglose de Extras', 14, currentY);
    currentY += 7;

    payoutsWithExtras.forEach((payout) => {
      if (currentY > pageHeight - (FOOTER_RESERVED + 40)) {
        doc.addPage();
        currentY = drawCorporateHeader(doc, headerOptions) + 2;
      }

      const name = getTechName(payout.technician_id);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(name, 14, currentY);
      currentY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MUTED);

      payout.extras_breakdown!.items!.forEach((item) => {
        const itemText = `• ${item.extra_type.replace('_', ' ')} × ${item.quantity} = ${formatCurrency(item.amount_eur)}`;
        doc.text(itemText, 18, currentY);
        currentY += 5;

        if (currentY > pageHeight - (FOOTER_RESERVED + 20)) {
          doc.addPage();
          currentY = drawCorporateHeader(doc, headerOptions) + 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...TEXT_MUTED);
        }
      });

      currentY += 4;
    });
  }

  if (currentY > pageHeight - (FOOTER_RESERVED + 40)) {
    doc.addPage();
    currentY = drawCorporateHeader(doc, headerOptions) + 4;
  }

  const totalTimesheets = payouts.reduce((sum, payout) => sum + payout.timesheets_total_eur, 0);
  const totalExtras = payouts.reduce((sum, payout) => sum + payout.extras_total_eur, 0);
  const grandTotal = payouts.reduce((sum, payout) => sum + payout.total_eur, 0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const summaryWidth = pageWidth - 28;

  doc.setFillColor(...SUMMARY_BACKGROUND);
  doc.roundedRect(14, currentY, summaryWidth, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...CORPORATE_RED);
  doc.text('Totales del Trabajo', 18, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Total Partes: ${formatCurrency(totalTimesheets)}`, 18, currentY + 18);
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 18, currentY + 26);

  const totalText = `Total General: ${formatCurrency(grandTotal)}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, 14 + summaryWidth - totalWidth - 6, currentY + 22);

  const footerLogo = companyLogo ?? headerLogo;
  drawCorporateFooter(doc, footerLogo);

  const filename = `pago_${jobDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(
    new Date(),
    'yyyy-MM-dd'
  )}.pdf`;
  if (options?.download === false) {
    const blob = doc.output('blob') as Blob;
    return blob;
  }
  doc.save(filename);
}
