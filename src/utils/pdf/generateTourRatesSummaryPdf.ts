import {
  formatMultiplier,
  shouldDisplayMultiplier
} from '@/lib/tourRateMath';
import { formatCurrency } from '@/lib/utils';
import { appendAutonomoLabel } from '@/utils/autonomo';
import { getLastAutoTableY } from '@/utils/pdf/exportHelpers';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  distributeColumnWidths,
  drawReportMasthead,
  drawReportRunningHead,
  drawReportSectionHeading,
  ensureReportSpace,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportChrome,
  type ReportChromeOptions,
  type ReportGeometry,
  REPORT_INK,
  REPORT_SOFT,
  REPORT_TOTALS_WEIGHT,
  setReportMonoText,
} from '@/utils/pdf/report-system';
import { drawReportEntryHeading, drawReportTotals } from '@/utils/pdf/report-system/blocks';
import {
  buildPdfFilename,
  resolveHeaderLogo,
} from '@/utils/pdf/shared/pdfExportShared';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type {
  TechnicianNameInfo,
  TechnicianProfile,
  TourSummaryJob
} from "@/utils/pdf/ratesPdfSupport";
import {
  computeEffectiveBase,
  formatJobDate,
  getTechNameFactory,
  resolveEffectiveTotal,
  withLpo
} from "@/utils/pdf/ratesPdfSupport";

export async function generateTourRatesSummaryPDF(
  tourName: string,
  jobsWithQuotes: TourSummaryJob[],
  profiles: TechnicianProfile[]
) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const tourId = jobsWithQuotes.find((job) => job.quotes.length)?.quotes[0]?.tour_id;
  const [headerLogo] = await Promise.all([
    resolveHeaderLogo({ tourId }),
    loadReportIssuerMark(),
  ]);

  const getTechName = getTechNameFactory(profiles);
  const sortedJobs = [...jobsWithQuotes].sort(
    (a, b) => new Date(a.job.start_time).getTime() - new Date(b.job.start_time).getTime()
  );

  const issuedOn = new Date();
  const dateSpan = sortedJobs.length
    ? `${formatJobDate(sortedJobs[0].job.start_time)} – ${formatJobDate(sortedJobs[sortedJobs.length - 1].job.start_time)}`
    : 'Sin fechas';
  const chrome: ReportChromeOptions = {
    kind: 'rates',
    kindLabel: 'Resumen de tarifas',
    eventTitle: tourName,
    contextLabel: dateSpan,
  };

  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: tourName?.trim() || 'Gira sin título',
    subtitle: `Resumen de tarifas de gira · Emitido el ${format(issuedOn, 'PPP', { locale: es })}`,
    clientLogo: headerLogo,
    meta: [
      { label: 'Fechas', value: String(sortedJobs.length) },
      { label: 'Periodo', value: dateSpan },
      { label: 'Emisión', value: format(issuedOn, 'dd/MM/yyyy') },
    ],
  });

  const yPos = drawReportSectionHeading(doc, geo, 'Resumen por técnico', contentTop, 1);

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
    head: [['Técnico', 'Fechas', 'LPOs', 'Total gira']],
    body: summaryRows,
    ...reportTableDefaults(geo, { fontSize: 7.6, numericColumns: [1, 3] }),
    columnStyles: distributeColumnWidths([40, 10, 26, 16], geo.contentWidth),
  });

  const summaryFinalY = getLastAutoTableY(doc, yPos) + 10;
  const tourGrandTotal = Array.from(techTotals.values()).reduce((sum, item) => sum + item.total, 0);

  const totalsY = ensureReportSpace(doc, geo, summaryFinalY, 30);
  drawReportTotals(doc, geo, totalsY, {
    lines: [
      { label: 'Técnicos', value: String(techTotals.size) },
      { label: 'Fechas', value: String(sortedJobs.length) },
    ],
    total: { label: 'Total general de gira', value: formatCurrency(tourGrandTotal) },
  });

  // The per-date breakdown is a second act, not a continuation: it starts on
  // its own page so the tour total is the last thing read on the first one.
  doc.addPage();
  const startBreakdownPage = (continued: boolean): number => {
    const pageGeo: ReportGeometry = drawReportRunningHead(doc, chrome);
    return drawReportSectionHeading(
      doc,
      pageGeo,
      continued ? 'Desglose por fecha (cont.)' : 'Desglose por fecha',
      pageGeo.contentTop,
      2,
    );
  };
  let breakdownY = startBreakdownPage(false);

  sortedJobs.forEach((item) => {
    if (!item.quotes.length) return;

    if (breakdownY > geo.contentBottom - 60) {
      doc.addPage();
      breakdownY = startBreakdownPage(true);
    }

    breakdownY = drawReportEntryHeading(
      doc,
      geo,
      `${formatJobDate(item.job.start_time)}  ·  ${item.job.title}`,
      breakdownY,
      `${item.quotes.length} ${item.quotes.length === 1 ? 'asignación' : 'asignaciones'}`,
    );

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
        const displayMultiplier =
          !usedFallbackBase && shouldDisplayMultiplier(rawMultiplier);
        baseText = displayMultiplier
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
        const isHourly = Number(quote.breakdown?.hourly_days ?? 0) > 0 || quote.category === 'hourly';
        const parts: string[] = [];
        if (isHourly) {
          parts.push(`Por horas: ${hrs}h`);
        } else if (hrs > 0) {
          parts.push(`Horas: ${hrs}h`);
        }
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
      ...reportTableDefaults(geo, { fontSize: 7.2, numericColumns: [2, 3, 4] }),
      columnStyles: distributeColumnWidths([38, 14, 22, 10, 12], geo.contentWidth),
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
    if (breakdownY > geo.contentBottom - 16) {
      doc.addPage();
      breakdownY = startBreakdownPage(true);
    }

    doc.setDrawColor(...REPORT_INK);
    doc.setLineWidth(REPORT_TOTALS_WEIGHT * geo.mm);
    doc.line(geo.left, breakdownY - 3 * geo.mm, geo.right, breakdownY - 3 * geo.mm);
    setReportMonoText(doc, REPORT_SOFT, 6, 'bold');
    doc.text(
      `BASE ${formatCurrency(jobBaseTotal)}   ·   EXTRAS ${formatCurrency(jobExtrasTotal)}`,
      geo.left,
      breakdownY,
    );
    setReportMonoText(doc, REPORT_INK, 7.6, 'bold');
    doc.text(formatCurrency(jobGrandTotal), geo.right, breakdownY, { align: 'right' });

    breakdownY += 12;
  });

  stampReportChrome(doc, chrome);

  const filename = buildPdfFilename([
    'Resumen Gira',
    tourName,
    format(new Date(), 'yyyy-MM-dd'),
  ]);
  doc.save(filename);
}

// Generate PDF for job payout totals
