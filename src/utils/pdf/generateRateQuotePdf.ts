import {
  formatMultiplier,
  shouldDisplayMultiplier
} from '@/lib/tourRateMath';
import { formatCurrency } from '@/lib/utils';
import { TourJobRateQuote } from '@/types/tourRates';
import { appendAutonomoLabel } from '@/utils/autonomo';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  distributeColumnWidths,
  drawReportMasthead,
  ensureReportSpace,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportChrome,
  type ReportChromeOptions,
} from '@/utils/pdf/report-system';
import { drawReportNotes, drawReportTotals } from '@/utils/pdf/report-system/blocks';
import {
  buildPdfFilename,
  resolveHeaderLogo,
} from '@/utils/pdf/shared/pdfExportShared';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type {
  JobDetails,
  TechnicianProfile,
  TimesheetLine
} from "@/utils/pdf/ratesPdfSupport";
import {
  PREP_DAY_DISCLAIMER_TEXT,
  TOUR_DEDUCTION_DISCLAIMER_TEXT,
  computeEffectiveBase,
  formatJobDate,
  getTechNameFactory,
  normalizeVehicleDisclaimerText,
  resolveEffectiveTotal,
  withLpo
} from "@/utils/pdf/ratesPdfSupport";

export async function generateRateQuotePDF(
  quotes: TourJobRateQuote[],
  jobDetails: JobDetails,
  profiles: TechnicianProfile[],
  lpoMap?: Map<string, string | null>,
  options?: {
    download?: boolean;
    timesheetMap?: Map<string, Set<string>>;
    prepTimesheetMap?: Map<string, TimesheetLine[]>;
    hourlyTimesheetMap?: Map<string, TimesheetLine[]>;
  }
): Promise<Blob | void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const tourIdFromQuotes = quotes.find((quote) => quote.tour_id)?.tour_id;
  const [headerLogo] = await Promise.all([
    resolveHeaderLogo({
      jobId: jobDetails.id,
      tourId: jobDetails.tour_id ?? tourIdFromQuotes,
    }),
    loadReportIssuerMark(),
  ]);

  const issuedOn = new Date();
  const jobDateLabel = formatJobDate(jobDetails.start_time);
  const chrome: ReportChromeOptions = {
    kind: 'rates',
    kindLabel: 'Presupuesto de tarifas',
    eventTitle: jobDetails.title,
    contextLabel: jobDateLabel,
  };

  // The job the quote is for is the subject of the document, so it is the
  // title; what kind of document it is rides in the eyebrow and the running
  // head, where it does not compete with the name anyone is looking for.
  const { geo, y: contentTop } = drawReportMasthead(doc, {
    ...chrome,
    title: jobDetails.title?.trim() || 'Trabajo sin título',
    subtitle: `Presupuesto de tarifas · Emitido el ${format(issuedOn, 'PPP', { locale: es })}`,
    clientLogo: headerLogo,
    meta: [
      { label: 'Fecha del trabajo', value: jobDateLabel },
      { label: 'Técnicos', value: String(quotes.length) },
      { label: 'Emisión', value: format(issuedOn, 'dd/MM/yyyy') },
    ],
  });

  const yPos = contentTop;

  const getTechName = getTechNameFactory(profiles);
  const getPrepLines = (technicianId: string) => options?.prepTimesheetMap?.get(technicianId) || [];
  const getHourlyLines = (technicianId: string) => options?.hourlyTimesheetMap?.get(technicianId) || [];
  const getPrepTotal = (technicianId: string) => (
    getPrepLines(technicianId).reduce((sum, line) => sum + Number(line.total_eur ?? 0), 0)
  );

  const quotesWithComputed = quotes.map((quote) => ({
    quote,
    computed: computeEffectiveBase(quote),
  }));

  const tableData = quotesWithComputed.map(({ quote, computed }) => {
    const { name: baseName, autonomo, is_house_tech } = getTechName(quote.technician_id);
    const lpo = lpoMap?.get(quote.technician_id) ?? null;
    const nameWithStatus = appendAutonomoLabel(baseName, autonomo, { isHouseTech: is_house_tech });
    const { effectiveBase, extrasTotal, preMultiplierBase, rawMultiplier, usedFallbackBase } =
      computed;
    const hasError = quote.breakdown?.error;
    const displayMultiplier =
      !usedFallbackBase && rawMultiplier != null && shouldDisplayMultiplier(rawMultiplier);

    // For tour rate quotes, server already applies autonomo discount to base before multipliers.
    // Manual overrides are applied server-side (see v_tour_job_rate_quotes_2025).
    const effectiveTotal = resolveEffectiveTotal(quote, computed);
    const prepLines = getPrepLines(quote.technician_id);
    const hourlyLines = getHourlyLines(quote.technician_id);
    const hourlyDates = new Set(hourlyLines.map((line) => line.date).filter(Boolean));
    const separatelyDisplayedPrepLines = prepLines.filter((line) => !hourlyDates.has(line.date));
    const prepTotal = getPrepTotal(quote.technician_id);
    const effectiveTotalWithPrep = effectiveTotal + prepTotal;

    let baseCell: string;
    if (hasError) {
      // Show error indicator instead of calculation
      const errorMsg =
        quote.breakdown.error === 'category_missing' ? 'ERROR: Falta categoría' :
        quote.breakdown.error === 'house_rate_missing' ? 'ERROR: Falta tarifa' :
        quote.breakdown.error === 'tour_base_missing' ? 'ERROR: Falta tarifa base' :
        'ERROR: ' + quote.breakdown.error;
      baseCell = errorMsg;
    } else if (displayMultiplier && rawMultiplier != null) {
      baseCell = `${formatCurrency(preMultiplierBase)} ${formatMultiplier(rawMultiplier)} = ${formatCurrency(
          effectiveBase
        )}`;
    } else {
      baseCell = formatCurrency(effectiveBase);
    }

    // Show autonomo discount from server breakdown if applicable
    let nameCellContent = withLpo(nameWithStatus, lpo);
    const autonomoDiscount = quote.autonomo_discount_eur;
    if (!is_house_tech && autonomoDiscount && autonomoDiscount > 0) {
      nameCellContent += `\n(Deducción IRPF ya aplicada: -${formatCurrency(autonomoDiscount)})`;
    }

    // Show override info if applicable
    if (quote.has_override && quote.override_amount_eur != null && quote.calculated_total_eur != null) {
      nameCellContent += `\nExcepción de pago: ${formatCurrency(quote.override_amount_eur)} (calculado: ${formatCurrency(quote.calculated_total_eur)})`;

      const actor = quote.override_actor_name;
      const actorEmail = quote.override_actor_email;
      const at = quote.override_set_at;
      if (actor || actorEmail || at) {
        const who = `${actor || '—'}${actorEmail ? ` (${actorEmail})` : ''}`;
        const when = at ? format(new Date(at), 'PPP p', { locale: es }) : '';
        nameCellContent += `\n(Override por ${who}${when ? ` · ${when}` : ''})`;
      }
    }

    if (quote.vehicle_disclaimer && quote.vehicle_disclaimer_text) {
      const vehicleNote = normalizeVehicleDisclaimerText(quote.vehicle_disclaimer_text);
      if (vehicleNote) {
        // The warning sign is outside the PDF standard encoding and printed as
        // a replacement character; the word carries the same weight.
        nameCellContent += `\nAviso vehículo: ${vehicleNote}`;
      }
    }

    if (separatelyDisplayedPrepLines.length > 0) {
      const prepSummary = separatelyDisplayedPrepLines
        .map((line) => {
          const dateLabel = line.date ? format(new Date(line.date), 'P', { locale: es }) : '—';
          return `${dateLabel}: ${line.hours_rounded ?? 0}h = ${formatCurrency(line.total_eur ?? 0)}`;
        })
        .join(' · ');
      nameCellContent += `\nDía(s) preparación: ${prepSummary}`;
    }

    if (hourlyLines.length > 0) {
      const hourlySummary = hourlyLines
        .map((line) => {
          const dateLabel = line.date ? format(new Date(line.date), 'P', { locale: es }) : '—';
          const overtimeHours = Number(line.overtime_hours ?? 0);
          const overtimeRate = Number(line.overtime_hour_eur ?? 0);
          const overtimeAmount = Number(line.overtime_amount_eur ?? 0);
          const overtimeText = overtimeHours > 0
            ? ` · HE ${overtimeHours}h × ${formatCurrency(overtimeRate)} = ${formatCurrency(overtimeAmount)}`
            : '';
          return `${dateLabel}: ${line.hours_rounded ?? 0}h · base ${formatCurrency(line.base_day_eur ?? 0)}${overtimeText} · total ${formatCurrency(line.total_eur ?? 0)}`;
        })
        .join('\n');
      nameCellContent += `\nDesglose por horas:\n${hourlySummary}`;
    }

    return [
      nameCellContent,
      quote.is_house_tech ? 'Plantilla' : quote.category || '—',
      baseCell,
      hasError ? '—' : formatMultiplier(rawMultiplier),
      hasError ? '—' : formatCurrency(extrasTotal),
      hasError ? '€0.00' : formatCurrency(effectiveTotalWithPrep),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Categoría', 'Base (calc.)', 'Mult.', 'Extras', 'Total']],
    body: tableData,
    ...reportTableDefaults(geo, { fontSize: 7.2, numericColumns: [2, 3, 4, 5] }),
    columnStyles: distributeColumnWidths([34, 15, 22, 8, 9, 12], geo.contentWidth),
  });

  const finalY = getLastAutoTableY(doc, yPos) + 10;

  const totalBase = quotesWithComputed.reduce(
    (sum, { computed }) => sum + computed.effectiveBase,
    0
  );
  const totalPrepDays = quotesWithComputed.reduce(
    (sum, { quote }) => sum + getPrepTotal(quote.technician_id),
    0
  );
  const totalExtras = quotesWithComputed.reduce(
    (sum, { computed }) => sum + computed.extrasTotal,
    0
  );

  // Grand total
  // Use server totals when available so PDFs match the DB source-of-truth (incl. manual overrides).
  const grandTotal = quotesWithComputed.reduce((sum, { quote, computed }) => {
    const computedTotal = computed.effectiveBase + computed.extrasTotal;
    const serverTotal =
      quote.total_with_extras_eur != null
        ? Number(quote.total_with_extras_eur)
        : quote.total_eur != null
          ? Number(quote.total_eur)
          : null;
    const effectiveTotal =
      quote.has_override && quote.override_amount_eur != null
        ? Number(quote.override_amount_eur)
        : (serverTotal ?? computedTotal);

    return sum + effectiveTotal + getPrepTotal(quote.technician_id);
  }, 0);

  // Check if any quotes have autonomo discount applied by server
  const anyDeductionApplied = quotesWithComputed.some(({ quote }) => {
      const techInfo = getTechName(quote.technician_id);
      return !techInfo.is_house_tech
        && quote.autonomo_discount_eur
        && quote.autonomo_discount_eur > 0;
  });

  // Check if any quotes have manual override
  const anyOverride = quotes.some(quote => quote.has_override);
  const anyPrepDay = totalPrepDays > 0;
  const vehicleDisclaimerNotes = Array.from(
    new Set(
      quotesWithComputed
        .map(({ quote }) =>
          quote.vehicle_disclaimer && quote.vehicle_disclaimer_text
            ? normalizeVehicleDisclaimerText(quote.vehicle_disclaimer_text)
            : null
        )
        .filter((note): note is string => typeof note === 'string' && note.length > 0)
    )
  );

  const totalsLines = [
    { label: 'Total base', value: formatCurrency(totalBase) },
    { label: 'Total extras', value: formatCurrency(totalExtras) },
  ];
  if (anyPrepDay) {
    totalsLines.push({ label: 'Total preparación', value: formatCurrency(totalPrepDays) });
  }

  const notes = [
    anyDeductionApplied ? TOUR_DEDUCTION_DISCLAIMER_TEXT : '',
    anyOverride
      ? 'Hay overrides manuales de pago (excepción). Administración debe validar con Dirección.'
      : '',
    anyPrepDay ? PREP_DAY_DISCLAIMER_TEXT : '',
    ...vehicleDisclaimerNotes.map((note) => `Aviso vehículo: ${note}`),
  ].filter(Boolean);

  // The totals and the conditions that qualify them belong on the same page:
  // a grand total read without its override warning is the wrong number.
  const totalsHeight = 26 + totalsLines.length * 5;
  let summaryY = ensureReportSpace(doc, geo, finalY, totalsHeight);
  summaryY = drawReportTotals(doc, geo, summaryY, {
    heading: 'Resumen',
    lines: totalsLines,
    total: { label: 'Total general', value: formatCurrency(grandTotal) },
  });

  if (notes.length > 0) {
    summaryY = ensureReportSpace(doc, geo, summaryY, 6 + notes.length * 8);
    drawReportNotes(doc, geo, notes, summaryY);
  }

  stampReportChrome(doc, chrome);

  const filename = buildPdfFilename([
    'Presupuesto',
    jobDetails.title,
    format(new Date(), 'yyyy-MM-dd'),
  ]);
  if (options?.download === false) {
    return pdfToBlob(doc);
  }
  doc.save(filename);
}

// Generate PDF for entire tour (all dates)
