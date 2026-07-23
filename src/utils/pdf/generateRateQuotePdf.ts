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
  TimesheetLine,
  TourSummaryJob,
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
  }
): Promise<Blob | void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const tourIdFromQuotes = quotes.find((quote) => quote.tour_id)?.tour_id;
  const [headerLogo, companyLogo] = await Promise.all([
    resolveHeaderLogo({
      jobId: jobDetails.id,
      tourId: jobDetails.tour_id ?? tourIdFromQuotes,
    }),
    getCompanyLogo(),
  ]);
  const headerOptions: CorporateHeaderOptions = {
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
  const getPrepLines = (technicianId: string) => options?.prepTimesheetMap?.get(technicianId) || [];
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
    if (autonomoDiscount && autonomoDiscount > 0) {
      nameCellContent += `\n(Deducción IRPF ya aplicada: -${formatCurrency(autonomoDiscount)})`;
    }

    // Show override info if applicable
    if (quote.has_override && quote.override_amount_eur != null && quote.calculated_total_eur != null) {
      nameCellContent += `\n(!) OVERRIDE: ${formatCurrency(quote.override_amount_eur)} (calc: ${formatCurrency(quote.calculated_total_eur)})`;

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
        nameCellContent += `\n(⚠ ${vehicleNote})`;
      }
    }

    if (prepLines.length > 0) {
      const prepSummary = prepLines
        .map((line) => {
          const dateLabel = line.date ? format(new Date(line.date), 'P', { locale: es }) : '—';
          return `${dateLabel}: ${line.hours_rounded ?? 0}h = ${formatCurrency(line.total_eur ?? 0)}`;
        })
        .join(' · ');
      nameCellContent += `\nDía(s) preparación: ${prepSummary}`;
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
    ...corporateTableDefaults(doc, headerOptions, contentTop),
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      1: { cellWidth: 34 },
      2: { halign: 'right', cellWidth: 68 },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = getLastAutoTableY(doc, yPos) + 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const summaryWidth = pageWidth - 28;

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
      return quote.autonomo_discount_eur && quote.autonomo_discount_eur > 0;
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

  doc.setFillColor(...SUMMARY_BACKGROUND);
  doc.roundedRect(14, finalY, summaryWidth, anyPrepDay ? 38 : 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...CORPORATE_RED);
  doc.text('Resumen', 18, finalY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Total Base: ${formatCurrency(totalBase)}`, 18, finalY + 18);
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 18, finalY + 26);
  if (anyPrepDay) {
    doc.text(`Total Preparación: ${formatCurrency(totalPrepDays)}`, 18, finalY + 34);
  }

  const totalText = `Total General: ${formatCurrency(grandTotal)}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, 14 + summaryWidth - totalWidth - 6, finalY + (anyPrepDay ? 25 : 22));

  let disclaimerY = finalY + (anyPrepDay ? 44 : 38);
  if (anyDeductionApplied) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...CORPORATE_RED);
    doc.text(TOUR_DEDUCTION_DISCLAIMER_TEXT, 14, disclaimerY);
    disclaimerY += 6;
  }

  if (anyOverride) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...CORPORATE_RED);
    doc.text('AVISO: Hay overrides manuales de pago (excepción). Administración debe validar con Dirección.', 14, disclaimerY);
    disclaimerY += 6;
  }

  if (anyPrepDay) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...CORPORATE_RED);
    doc.text(PREP_DAY_DISCLAIMER_TEXT, 14, disclaimerY);
    disclaimerY += 6;
  }

  if (vehicleDisclaimerNotes.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...CORPORATE_RED);
    const maxWidth = pageWidth - 28;
    vehicleDisclaimerNotes.forEach((note) => {
      const lines = doc.splitTextToSize(`AVISO VEHÍCULO: ${note}`, maxWidth) as string[];
      doc.text(lines, 14, disclaimerY);
      disclaimerY += lines.length * 4 + 2;
    });
  }

  const footerLogo = companyLogo ?? headerLogo;
  drawCorporateFooter(doc, footerLogo);

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
