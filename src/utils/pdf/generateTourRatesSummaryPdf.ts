import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TourJobRateQuote } from '@/types/tourRates';
import {
  formatMultiplier,
  getPerJobMultiplier,
  shouldDisplayMultiplier,
} from '@/lib/tourRateMath';
import { formatCurrency } from '@/lib/utils';
import { getCompanyLogo } from '@/utils/pdf/logoUtils';
import { appendAutonomoLabel } from '@/utils/autonomo';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getInvoicingCompanyDetails } from '@/utils/invoicing-company-data';
import { labelForJobExtraType } from '@/types/jobExtras';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import {
  CORPORATE_RED,
  TEXT_PRIMARY,
  TEXT_MUTED,
  SUMMARY_BACKGROUND,
  CORPORATE_FOOTER_RESERVED,
  buildPdfFilename,
  corporateTableDefaults,
  drawCorporateFooter,
  drawCorporateHeader,
  resolveHeaderLogo,
  type CorporateHeaderOptions,
} from '@/utils/pdf/shared/pdfExportShared';

import {
  DEDUCTION_DISCLAIMER_TEXT,
  EVENTO_DISCLAIMER_TEXT,
  FIXED_TRAVEL_RATE_DISCLAIMER_TEXT,
  NON_AUTONOMO_DEDUCTION_EUR,
  PREP_DAY_DISCLAIMER_TEXT,
  TOUR_DEDUCTION_DISCLAIMER_TEXT,
  MULTIPLIER_DISPLAY_EPSILON,
  computeEffectiveBase,
  formatJobDate,
  getTechNameFactory,
  normalizeVehicleDisclaimerText,
  resolveEffectiveTotal,
  withLpo,
} from "@/utils/pdf/ratesPdfSupport";
import type {
  JobDetails,
  PayoutData,
  TechnicianProfile,
  TechnicianNameInfo,
  TimesheetLine,
  TourSummaryJob,
} from "@/utils/pdf/ratesPdfSupport";

export async function generateTourRatesSummaryPDF(
  tourName: string,
  jobsWithQuotes: TourSummaryJob[],
  profiles: TechnicianProfile[]
) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const tourId = jobsWithQuotes.find((job) => job.quotes.length)?.quotes[0]?.tour_id;
  const [headerLogo, companyLogo] = await Promise.all([
    resolveHeaderLogo({ tourId }),
    getCompanyLogo(),
  ]);
  const headerOptions: CorporateHeaderOptions = {
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

  const techTotals = new Map<
    string,
    { info: TechnicianNameInfo; dates: number; total: number; lpos: Set<string> }
  >();

  sortedJobs.forEach(({ quotes, lpoMap }) => {
    quotes.forEach((quote) => {
      const techId = quote.technician_id;
      if (!techId) return;

      // Skip quotes with errors from totals aggregation
      const hasError = quote.breakdown?.error;
      if (hasError) return;

      const computed = computeEffectiveBase(quote);
      const effectiveTotal = resolveEffectiveTotal(quote, computed);
      const info = getTechName(techId);
      const existing =
        techTotals.get(techId) || {
          info,
          dates: 0,
          total: 0,
          lpos: new Set<string>(),
        };

      existing.info = info;

      existing.dates += 1;
      existing.total += effectiveTotal;

      const lpo = lpoMap?.get(techId);
      if (lpo) existing.lpos.add(lpo);

      techTotals.set(techId, existing);
    });
  });

  const summaryRows = Array.from(techTotals.values())
    .sort((a, b) => a.info.name.localeCompare(b.info.name))
    .map((item) => [
      appendAutonomoLabel(item.info.name, item.info.autonomo, { multiline: false, isHouseTech: item.info.is_house_tech }),
      item.dates.toString(),
      item.lpos.size ? Array.from(item.lpos).join(', ') : '—',
      formatCurrency(item.total),
    ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Fechas', 'LPOs', 'Total Gira']],
    body: summaryRows,
    ...corporateTableDefaults(doc, headerOptions, contentTop),
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'left' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const summaryFinalY = getLastAutoTableY(doc, yPos) + 10;
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

    if (breakdownY > pageHeight - (CORPORATE_FOOTER_RESERVED + 60)) {
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
      const { name: baseName, autonomo, is_house_tech } = getTechName(quote.technician_id);
      const lpo = item.lpoMap?.get(quote.technician_id) ?? null;
      const nameWithStatus = appendAutonomoLabel(baseName, autonomo, { isHouseTech: is_house_tech });
      const hasError = quote.breakdown?.error;
      const computed = computeEffectiveBase(quote);
      const {
        effectiveBase,
        extrasTotal,
        preMultiplierBase,
        rawMultiplier,
        usedFallbackBase,
      } = computed;

      let baseText: string;
      if (hasError) {
        const errorMsg =
          quote.breakdown.error === 'category_missing' ? 'ERROR: Falta categoría' :
          quote.breakdown.error === 'house_rate_missing' ? 'ERROR: Falta tarifa' :
          quote.breakdown.error === 'tour_base_missing' ? 'ERROR: Falta tarifa base' :
          'ERROR: ' + quote.breakdown.error;
        baseText = errorMsg;
      } else {
        const shouldDisplayMultiplier =
          !usedFallbackBase && rawMultiplier != null && Math.abs(rawMultiplier - 1) >= MULTIPLIER_DISPLAY_EPSILON;
        baseText = shouldDisplayMultiplier
          ? `${formatCurrency(preMultiplierBase)} ${formatMultiplier(rawMultiplier)} = ${formatCurrency(effectiveBase)}`
          : formatCurrency(effectiveBase);
      }

      let nameCell = withLpo(nameWithStatus, lpo);
      if (!hasError) {
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
      }

      return [
        nameCell,
        quote.is_house_tech ? 'Plantilla' : quote.category || '—',
        baseText,
        hasError ? '—' : formatCurrency(extrasTotal),
        hasError ? '€0.00' : formatCurrency(resolveEffectiveTotal(quote, computed)),
      ];
    });

    autoTable(doc, {
      startY: breakdownY,
      head: [['Técnico', 'Categoría', 'Base', 'Extras', 'Total']],
      body: jobTableRows,
      ...corporateTableDefaults(doc, headerOptions, headerOffset),
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    });

    breakdownY = getLastAutoTableY(doc, breakdownY) + 6;

    const { jobBaseTotal, jobExtrasTotal, jobGrandTotal } = item.quotes.reduce(
      (acc, quote) => {
        const computed = computeEffectiveBase(quote);
        acc.jobBaseTotal += computed.effectiveBase;
        acc.jobExtrasTotal += computed.extrasTotal;
        acc.jobGrandTotal += resolveEffectiveTotal(quote, computed);
        return acc;
      },
      { jobBaseTotal: 0, jobExtrasTotal: 0, jobGrandTotal: 0 }
    );

    // If there isn't enough room for the totals line, continue on a new page
    if (breakdownY > pageHeight - (CORPORATE_FOOTER_RESERVED + 16)) {
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

  const filename = buildPdfFilename([
    'Resumen Gira',
    tourName,
    format(new Date(), 'yyyy-MM-dd'),
  ]);
  doc.save(filename);
}

// Generate PDF for job payout totals
