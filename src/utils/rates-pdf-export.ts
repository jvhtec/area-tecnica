import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TourJobRateQuote } from '@/types/tourRates';
import { formatCurrency } from '@/lib/utils';

interface TechnicianProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  default_timesheet_category?: string | null;
  role?: string | null;
}

interface JobDetails {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
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

const ACCENT_COLOR: [number, number, number] = [16, 36, 94];
const MUTED_TEXT_COLOR: [number, number, number] = [71, 85, 105];
const LIGHT_BACKGROUND: [number, number, number] = [241, 245, 249];
const TABLE_STRIPE_COLOR: [number, number, number] = [248, 250, 252];
const HEADER_HEIGHT = 42;
const HEADER_CONTENT_OFFSET = HEADER_HEIGHT + 12;
const FOOTER_HEIGHT = 24;
const COMPANY_LOGO_PATHS = [
  '/sector pro logo.png',
  './sector pro logo.png',
  'sector pro logo.png',
  '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png',
];

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

let cachedCompanyLogoPromise: Promise<HTMLImageElement | null> | null = null;

async function getCompanyLogo(): Promise<HTMLImageElement | null> {
  if (!cachedCompanyLogoPromise) {
    cachedCompanyLogoPromise = (async () => {
      for (const path of COMPANY_LOGO_PATHS) {
        const img = await loadImageSafely(path, 'Sector Pro logo');
        if (img) return img;
      }
      return null;
    })();
  }

  return cachedCompanyLogoPromise;
}

function addHeaderWithBranding(doc: jsPDF, title: string, logo: HTMLImageElement | null) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');

  let textX = 18;

  if (logo) {
    const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
    const logoHeight = Math.min(24, logo.height || 24);
    const logoWidth = logoHeight * ratio;
    doc.addImage(logo, 'PNG', 14, 9, logoWidth, logoHeight);
    textX = 14 + logoWidth + 10;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, textX, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generado: ${format(new Date(), 'PPP', { locale: es })}`, textX, 32);

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(...ACCENT_COLOR);
  doc.setLineWidth(0.6);
  doc.line(14, HEADER_HEIGHT, pageWidth - 14, HEADER_HEIGHT);

  return HEADER_CONTENT_OFFSET;
}

function addFooter(doc: jsPDF, logo: HTMLImageElement | null) {
  const pageCount = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    doc.setPage(pageNumber);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(...LIGHT_BACKGROUND);
    doc.rect(0, pageHeight - FOOTER_HEIGHT, pageWidth, FOOTER_HEIGHT, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_TEXT_COLOR);

    const footerY = pageHeight - 8;
    doc.text('Sector-Pro', 14, footerY);

    const pageText = `Página ${pageNumber} de ${pageCount}`;
    const textWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - 14 - textWidth, footerY);

    if (logo) {
      const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
      const logoHeight = 12;
      const logoWidth = logoHeight * ratio;
      const logoX = (pageWidth - logoWidth) / 2;
      const logoY = pageHeight - FOOTER_HEIGHT + (FOOTER_HEIGHT - logoHeight) / 2;
      doc.addImage(logo, 'PNG', logoX, logoY, logoWidth, logoHeight);
    }
  }

  doc.setTextColor(0, 0, 0);
}

const getTechNameFactory = (profiles: TechnicianProfile[]) => {
  return (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return 'Unknown';
    const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
    return name || 'Unknown';
  };
};

const formatJobDate = (date: string) => format(new Date(date), 'PPP', { locale: es });

const withLpo = (name: string, lpo?: string | null) => (lpo ? `${name}\nLPO: ${lpo}` : name);

// Generate PDF for individual rate quote (single job date)
export async function generateRateQuotePDF(
  quotes: TourJobRateQuote[],
  jobDetails: JobDetails,
  profiles: TechnicianProfile[],
  lpoMap?: Map<string, string | null>
) {
  const doc = new jsPDF();
  const companyLogo = await getCompanyLogo();
  const headerTitle = 'Presupuesto de Tarifas - Fecha de Gira';
  const contentTop = addHeaderWithBranding(doc, headerTitle, companyLogo);

  let yPos = contentTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text('Detalles del Trabajo', 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT_COLOR);
  doc.text(`Nombre: ${jobDetails.title}`, 14, yPos);
  yPos += 5;
  doc.text(`Fecha: ${formatJobDate(jobDetails.start_time)}`, 14, yPos);
  yPos += 10;

  const getTechName = getTechNameFactory(profiles);

  const tableData = quotes.map((quote) => {
    const name = getTechName(quote.technician_id);
    const lpo = lpoMap?.get(quote.technician_id) ?? null;
    return [
      withLpo(name, lpo),
      quote.is_house_tech ? 'Plantilla' : quote.category || '—',
      formatCurrency(quote.base_day_eur),
      quote.multiplier > 1 ? `×${quote.multiplier}` : '—',
      formatCurrency(quote.extras_total_eur || 0),
      formatCurrency(quote.total_with_extras_eur || quote.total_eur || 0),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Categoría', 'Base', 'Mult.', 'Extras', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: ACCENT_COLOR as number[], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR as number[] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: contentTop },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addHeaderWithBranding(doc, headerTitle, companyLogo);
      }
    },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY ?? yPos) + 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const summaryWidth = pageWidth - 28;

  const totalBase = quotes.reduce((sum, quote) => sum + quote.base_day_eur * (quote.multiplier || 1), 0);
  const totalExtras = quotes.reduce((sum, quote) => sum + (quote.extras_total_eur || 0), 0);
  const grandTotal = quotes.reduce(
    (sum, quote) => sum + (quote.total_with_extras_eur || quote.total_eur || 0),
    0
  );

  doc.setFillColor(...LIGHT_BACKGROUND);
  doc.roundedRect(14, finalY, summaryWidth, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text('Resumen', 18, finalY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT_COLOR);
  doc.text(`Total Base: ${formatCurrency(totalBase)}`, 18, finalY + 18);
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 18, finalY + 26);

  const totalText = `Total General: ${formatCurrency(grandTotal)}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT_COLOR);
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, 14 + summaryWidth - totalWidth - 6, finalY + 22);

  addFooter(doc, companyLogo);

  const filename = `presupuesto_${jobDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(
    new Date(),
    'yyyy-MM-dd'
  )}.pdf`;
  doc.save(filename);
}

// Generate PDF for entire tour (all dates)
export async function generateTourRatesSummaryPDF(
  tourName: string,
  jobsWithQuotes: TourSummaryJob[],
  profiles: TechnicianProfile[]
) {
  const doc = new jsPDF();
  const companyLogo = await getCompanyLogo();
  const headerTitle = `Resumen de Tarifas - ${tourName}`;
  const contentTop = addHeaderWithBranding(doc, headerTitle, companyLogo);

  const getTechName = getTechNameFactory(profiles);
  const sortedJobs = [...jobsWithQuotes].sort(
    (a, b) => new Date(a.job.start_time).getTime() - new Date(b.job.start_time).getTime()
  );

  let yPos = contentTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text(`Total de fechas: ${sortedJobs.length}`, 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT_COLOR);
  doc.text('Resumen general por técnico', 14, yPos);
  yPos += 6;

  const techTotals = new Map<string, { name: string; dates: number; total: number; lpos: Set<string> }>();

  sortedJobs.forEach(({ quotes, lpoMap }) => {
    quotes.forEach((quote) => {
      const techId = quote.technician_id;
      if (!techId) return;

      const existing =
        techTotals.get(techId) || {
          name: getTechName(techId),
          dates: 0,
          total: 0,
          lpos: new Set<string>(),
        };

      existing.dates += 1;
      existing.total += quote.total_with_extras_eur || quote.total_eur || 0;

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
    headStyles: { fillColor: ACCENT_COLOR as number[], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR as number[] },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'left' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: contentTop },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addHeaderWithBranding(doc, headerTitle, companyLogo);
      }
    },
  });

  const summaryFinalY = ((doc as any).lastAutoTable?.finalY ?? yPos) + 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - 28;
  const tourGrandTotal = Array.from(techTotals.values()).reduce((sum, item) => sum + item.total, 0);

  doc.setFillColor(...LIGHT_BACKGROUND);
  doc.roundedRect(14, summaryFinalY, boxWidth, 26, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text(`Total General de Gira: ${formatCurrency(tourGrandTotal)}`, 18, summaryFinalY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT_COLOR);
  doc.text(`Total de técnicos: ${techTotals.size}`, 18, summaryFinalY + 22);

  doc.addPage();
  let headerOffset = addHeaderWithBranding(doc, headerTitle, companyLogo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text('Desglose por Fecha', 14, headerOffset);

  let breakdownY = headerOffset + 8;
  const pageHeight = doc.internal.pageSize.getHeight();

  sortedJobs.forEach((item, index) => {
    if (!item.quotes.length) return;

    if (breakdownY > pageHeight - 60) {
      doc.addPage();
      headerOffset = addHeaderWithBranding(doc, headerTitle, companyLogo);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...ACCENT_COLOR);
      doc.text('Desglose por Fecha (cont.)', 14, headerOffset);
      breakdownY = headerOffset + 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT_COLOR);
    doc.text(`${formatJobDate(item.job.start_time)} • ${item.job.title}`, 14, breakdownY);
    breakdownY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_TEXT_COLOR);
    doc.text(`${item.quotes.length} asignaciones`, 14, breakdownY);
    breakdownY += 4;

    const jobTableRows = item.quotes.map((quote) => {
      const name = getTechName(quote.technician_id);
      const lpo = item.lpoMap?.get(quote.technician_id) ?? null;
      const baseText =
        quote.multiplier > 1
          ? `${formatCurrency(quote.base_day_eur)} ×${quote.multiplier}`
          : formatCurrency(quote.base_day_eur);
      return [
        withLpo(name, lpo),
        quote.is_house_tech ? 'Plantilla' : quote.category || '—',
        baseText,
        formatCurrency(quote.extras_total_eur || 0),
        formatCurrency(quote.total_with_extras_eur || quote.total_eur || 0),
      ];
    });

    autoTable(doc, {
      startY: breakdownY,
      head: [['Técnico', 'Categoría', 'Base', 'Extras', 'Total']],
      body: jobTableRows,
      theme: 'grid',
      headStyles: { fillColor: ACCENT_COLOR as number[], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR as number[] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, top: headerOffset },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          addHeaderWithBranding(doc, headerTitle, companyLogo);
        }
      },
    });

    breakdownY = ((doc as any).lastAutoTable?.finalY ?? breakdownY) + 6;

    const jobBaseTotal = item.quotes.reduce(
      (sum, quote) => sum + quote.base_day_eur * (quote.multiplier || 1),
      0
    );
    const jobExtrasTotal = item.quotes.reduce((sum, quote) => sum + (quote.extras_total_eur || 0), 0);
    const jobGrandTotal = item.quotes.reduce(
      (sum, quote) => sum + (quote.total_with_extras_eur || quote.total_eur || 0),
      0
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ACCENT_COLOR);
    doc.text(
      `Totales — Base: ${formatCurrency(jobBaseTotal)} · Extras: ${formatCurrency(jobExtrasTotal)} · General: ${formatCurrency(jobGrandTotal)}`,
      18,
      breakdownY
    );

    breakdownY += 10;
    doc.setTextColor(0, 0, 0);
  });

  addFooter(doc, companyLogo);

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
  lpoMap?: Map<string, string | null>
) {
  const doc = new jsPDF();
  const companyLogo = await getCompanyLogo();
  const headerTitle = 'Informe de Pagos - Trabajo';
  const contentTop = addHeaderWithBranding(doc, headerTitle, companyLogo);

  let yPos = contentTop;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text('Detalles del Trabajo', 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT_COLOR);
  doc.text(`Nombre: ${jobDetails.title}`, 14, yPos);
  yPos += 5;
  doc.text(`Fecha: ${formatJobDate(jobDetails.start_time)}`, 14, yPos);
  yPos += 10;

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
    headStyles: { fillColor: ACCENT_COLOR as number[], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    alternateRowStyles: { fillColor: TABLE_STRIPE_COLOR as number[] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, top: contentTop },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addHeaderWithBranding(doc, headerTitle, companyLogo);
      }
    },
  });

  let currentY = ((doc as any).lastAutoTable?.finalY ?? yPos) + 12;
  const pageHeight = doc.internal.pageSize.getHeight();

  const payoutsWithExtras = payouts.filter(
    (payout) => payout.extras_breakdown?.items && payout.extras_breakdown.items.length > 0
  );

  if (payoutsWithExtras.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = addHeaderWithBranding(doc, headerTitle, companyLogo) + 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT_COLOR);
    doc.text('Desglose de Extras', 14, currentY);
    currentY += 7;

    payoutsWithExtras.forEach((payout) => {
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = addHeaderWithBranding(doc, headerTitle, companyLogo) + 2;
      }

      const name = getTechName(payout.technician_id);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...ACCENT_COLOR);
      doc.text(name, 14, currentY);
      currentY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED_TEXT_COLOR);

      payout.extras_breakdown!.items!.forEach((item) => {
        const itemText = `• ${item.extra_type.replace('_', ' ')} × ${item.quantity} = ${formatCurrency(item.amount_eur)}`;
        doc.text(itemText, 18, currentY);
        currentY += 5;

        if (currentY > pageHeight - 20) {
          doc.addPage();
          currentY = addHeaderWithBranding(doc, headerTitle, companyLogo) + 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...MUTED_TEXT_COLOR);
        }
      });

      currentY += 4;
    });
  }

  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = addHeaderWithBranding(doc, headerTitle, companyLogo) + 4;
  }

  const totalTimesheets = payouts.reduce((sum, payout) => sum + payout.timesheets_total_eur, 0);
  const totalExtras = payouts.reduce((sum, payout) => sum + payout.extras_total_eur, 0);
  const grandTotal = payouts.reduce((sum, payout) => sum + payout.total_eur, 0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const summaryWidth = pageWidth - 28;

  doc.setFillColor(...LIGHT_BACKGROUND);
  doc.roundedRect(14, currentY, summaryWidth, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text('Totales del Trabajo', 18, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT_COLOR);
  doc.text(`Total Partes: ${formatCurrency(totalTimesheets)}`, 18, currentY + 18);
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 18, currentY + 26);

  const totalText = `Total General: ${formatCurrency(grandTotal)}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT_COLOR);
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, 14 + summaryWidth - totalWidth - 6, currentY + 22);

  addFooter(doc, companyLogo);

  const filename = `pago_${jobDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(
    new Date(),
    'yyyy-MM-dd'
  )}.pdf`;
  doc.save(filename);
}
