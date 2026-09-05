import { formatCurrency } from '@/lib/utils';
import { labelForJobExtraType } from '@/types/jobExtras';
import { appendAutonomoLabel } from '@/utils/autonomo';
import { getInvoicingCompanyDetails } from '@/utils/invoicing-company-data';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  distributeColumnWidths,
  drawReportMasthead,
  drawReportRunningHead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  reportTableDefaults,
  stampReportChrome,
  type ReportChromeOptions,
  type ReportGeometry,
} from '@/utils/pdf/report-system';
import {
  drawReportEntryHeading,
  drawReportItemLine,
  drawReportNotes,
  drawReportTotals,
} from '@/utils/pdf/report-system/blocks';
import {
  buildPdfFilename,
  resolveHeaderLogo,
} from '@/utils/pdf/shared/pdfExportShared';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type {
  JobDetails,
  PayoutData,
  TechnicianProfile,
  TimesheetLine
} from "@/utils/pdf/ratesPdfSupport";
import {
  DEDUCTION_DISCLAIMER_TEXT,
  EVENTO_DISCLAIMER_TEXT,
  FIXED_TRAVEL_RATE_DISCLAIMER_TEXT,
  NON_AUTONOMO_DEDUCTION_EUR,
  PREP_DAY_DISCLAIMER_TEXT,
  formatJobDate,
  getTechNameFactory,
  withLpo
} from "@/utils/pdf/ratesPdfSupport";

export async function generateJobPayoutPDF(
  payouts: PayoutData[],
  jobDetails: JobDetails,
  profiles: TechnicianProfile[],
  lpoMap?: Map<string, string | null>,
  timesheetMap?: Map<string, TimesheetLine[]>,
  options?: { download?: boolean }
): Promise<Blob | void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const [headerLogo] = await Promise.all([
    resolveHeaderLogo({
      jobId: jobDetails.id,
      tourId: jobDetails.tour_id,
    }),
    loadReportIssuerMark(),
  ]);

  // Extract unique worked dates from timesheets for all technicians in this PDF
  const allWorkedDates = new Set<string>();
  payouts.forEach((payout) => {
    const lines = timesheetMap?.get(payout.technician_id) || [];
    lines.forEach((line) => {
      if (line.date) allWorkedDates.add(line.date);
    });
  });
  const sortedDates = Array.from(allWorkedDates).sort();

  // Format dates nicely
  let dateText: string;
  if (sortedDates.length === 0) {
    dateText = formatJobDate(jobDetails.start_time);
  } else if (sortedDates.length === 1) {
    dateText = format(new Date(sortedDates[0]), 'P', { locale: es });
  } else if (sortedDates.length === 2) {
    dateText = `${format(new Date(sortedDates[0]), 'P', { locale: es })} y ${format(new Date(sortedDates[1]), 'P', { locale: es })}`;
  } else {
    const firstDate = format(new Date(sortedDates[0]), 'P', { locale: es });
    const lastDate = format(new Date(sortedDates[sortedDates.length - 1]), 'P', { locale: es });
    dateText = `${firstDate} - ${lastDate} (${sortedDates.length} días)`;
  }

  // Get LPO number and tech info if this is a single-tech PDF
  const lpoNumber = payouts.length === 1 ? (lpoMap?.get(payouts[0].technician_id) ?? null) : null;
  const getTechName = getTechNameFactory(profiles);
  const singleTechInfo = payouts.length === 1 ? getTechName(payouts[0].technician_id) : null;
  const shouldShowInvoicing = singleTechInfo && singleTechInfo.autonomo && !singleTechInfo.is_house_tech;

  const issuedOn = new Date();
  const chrome: ReportChromeOptions = {
    kind: 'payout',
    kindLabel: 'Informe de pagos',
    eventTitle: jobDetails.title,
    contextLabel: dateText,
  };

  const { geo, y: mastheadBottom } = drawReportMasthead(doc, {
    ...chrome,
    title: jobDetails.title?.trim() || 'Trabajo sin título',
    subtitle: `Informe de pagos · Emitido el ${format(issuedOn, 'PPP', { locale: es })}`,
    clientLogo: headerLogo,
    meta: [
      { label: sortedDates.length > 1 ? 'Fechas' : 'Fecha', value: dateText },
      { label: 'Técnicos', value: String(payouts.length) },
      { label: 'Emisión', value: format(issuedOn, 'dd/MM/yyyy') },
    ],
  });

  let yPos = mastheadBottom;

  // Invoicing details are only meaningful for the self-employed technician the
  // document is addressed to, so they only appear on a single-technician sheet.
  if (shouldShowInvoicing) {
    const invoicingRows: Array<[string, string]> = [];
    if (jobDetails.invoicing_company) {
      const companyDetails = getInvoicingCompanyDetails(jobDetails.invoicing_company);
      if (companyDetails) {
        invoicingRows.push(['Empresa facturadora', companyDetails.legalName]);
        invoicingRows.push(['CIF', companyDetails.cif]);
        invoicingRows.push(['Dirección', companyDetails.address]);
      } else {
        invoicingRows.push(['Empresa facturadora', jobDetails.invoicing_company]);
      }
    }
    if (lpoNumber) invoicingRows.push(['Nº referencia (LPO)', lpoNumber]);

    if (invoicingRows.length > 0) {
      yPos = drawReportSectionHeading(doc, geo, 'Facturación', yPos, 1);
      invoicingRows.forEach(([label, value]) => {
        yPos = drawReportItemLine(doc, geo, label, value, yPos, { indent: 0 });
      });
      yPos += 4;
    }
  }

  yPos = drawReportSectionHeading(doc, geo, 'Totales por técnico', yPos, shouldShowInvoicing ? 2 : 1);

  const resolveIrpfDeduction = (
    payout: PayoutData,
    opts: { autonomo: boolean; is_house_tech: boolean }
  ) => {
    // Calculate deduction - only for non-autonomo contracted workers (not house techs)
    let deduction = 0;
    let daysCount = 0;
    const isNonAutonomoContracted = !opts.autonomo && !opts.is_house_tech;

    if (isNonAutonomoContracted) {
      // Count unique days from timesheets
      const lines = timesheetMap?.get(payout.technician_id) || [];
      if (lines.length > 0) {
        const uniqueDates = new Set(lines.map((l) => l.date).filter(Boolean));
        daysCount = uniqueDates.size > 0 ? uniqueDates.size : 1;
      } else if (payout.timesheets_total_eur > 0) {
        // Fallback if no details (should rarely happen)
        daysCount = 1;
      }
      deduction = daysCount * NON_AUTONOMO_DEDUCTION_EUR;
    }

    return { deduction, daysCount };
  };

  const tableData = payouts.map((payout) => {
    const { name: baseName, autonomo, is_house_tech } = getTechName(payout.technician_id);
    const lpo = lpoMap?.get(payout.technician_id) ?? null;
    const nameWithStatus = appendAutonomoLabel(baseName, autonomo, { isHouseTech: is_house_tech });

    const { deduction, daysCount } = resolveIrpfDeduction(payout, { autonomo: !!autonomo, is_house_tech: !!is_house_tech });
    const effectiveTotal = payout.total_eur - deduction;

    let nameCellContent = withLpo(nameWithStatus, lpo);
    if (deduction > 0) {
      nameCellContent += `\n(Deducción IRPF ${daysCount}d: -${formatCurrency(deduction)})`;
    }

    // Show override info if applicable
    if (payout.has_override && payout.override_amount_eur != null && payout.calculated_total_eur != null) {
      nameCellContent += `\n(!) OVERRIDE: ${formatCurrency(payout.override_amount_eur)} (calc: ${formatCurrency(payout.calculated_total_eur)})`;

      const actor = payout.override_actor_name;
      const actorEmail = payout.override_actor_email;
      const at = payout.override_set_at;
      if (actor || actorEmail || at) {
        const who = `${actor || '—'}${actorEmail ? ` (${actorEmail})` : ''}`;
        const when = at ? format(new Date(at), 'PPP p', { locale: es }) : '';
        nameCellContent += `\n(Override por ${who}${when ? ` · ${when}` : ''})`;
      }
    }

    return [
      nameCellContent,
      formatCurrency(payout.timesheets_total_eur),
      formatCurrency(payout.extras_total_eur),
      formatCurrency(payout.expenses_total_eur),
      formatCurrency(effectiveTotal),
    ];
  });

  const anyDeductionApplied = payouts.some(p => {
      const { autonomo, is_house_tech } = getTechName(p.technician_id);
      return !autonomo && !is_house_tech;
  });

  const anyOverride = payouts.some(p => p.has_override);

  // Check if any timesheet has is_evento flag
  const anyEvento = payouts.some(p => {
      const lines = timesheetMap?.get(p.technician_id) || [];
      return lines.some(l => l.is_evento === true);
  });

  const anyPrepDay = payouts.some(p => {
      const lines = timesheetMap?.get(p.technician_id) || [];
      return lines.some(l => l.is_prep_day === true);
  });

  // Check if any extras use house tech travel rate
  const anyHouseTechTravelRate = payouts.some(p => {
      const items = p.extras_breakdown?.items || [];
      return items.some((item) => item.is_house_tech_rate === true);
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Partes', 'Extras', 'Gastos', 'Total']],
    body: tableData,
    ...reportTableDefaults(geo, { fontSize: 7.6, numericColumns: [1, 2, 3, 4] }),
    columnStyles: distributeColumnWidths([40, 14, 14, 14, 16], geo.contentWidth),
  });

  const notes = [
    anyDeductionApplied ? DEDUCTION_DISCLAIMER_TEXT : '',
    anyOverride
      ? 'Hay overrides manuales de pago (excepción). Administración debe validar con Dirección.'
      : '',
    anyEvento ? EVENTO_DISCLAIMER_TEXT : '',
    anyPrepDay ? PREP_DAY_DISCLAIMER_TEXT : '',
    anyHouseTechTravelRate ? FIXED_TRAVEL_RATE_DISCLAIMER_TEXT : '',
  ].filter(Boolean);

  const disclaimerY = drawReportNotes(doc, geo, notes, getLastAutoTableY(doc, yPos) + 8);
  let currentY = disclaimerY + 4;
  let sectionNumber = shouldShowInvoicing ? 2 : 1;

  /**
   * Breaks to a new page when `needed` millimetres do not remain, redrawing the
   * running head so a continuation page still says which document it belongs to.
   */
  const breakIfShort = (y: number, needed: number): number => {
    if (y <= geo.contentBottom - needed) return y;
    doc.addPage();
    const pageGeo: ReportGeometry = drawReportRunningHead(doc, chrome);
    return pageGeo.contentTop;
  };

  const payoutsWithExtras = payouts.filter(
    (payout) => payout.extras_breakdown?.items && payout.extras_breakdown.items.length > 0
  );
  const payoutsWithExpenses = payouts.filter(
    (payout) => (payout.expenses_total_eur ?? 0) > 0 || (payout.expenses_breakdown?.length ?? 0) > 0
  );

  // Detailed timesheets breakdown section
  const techIdsWithTimesheets = Array.from(new Set((payouts || []).map(p => p.technician_id))).filter(
    (id) => (timesheetMap?.get(id) || []).length > 0
  );
  if (techIdsWithTimesheets.length > 0) {
    currentY = breakIfShort(currentY, 60);
    sectionNumber += 1;
    currentY = drawReportSectionHeading(doc, geo, 'Desglose de partes', currentY, sectionNumber);

    for (const payout of payouts) {
      const lines = timesheetMap?.get(payout.technician_id) || [];
      if (!lines.length) continue;

      currentY = breakIfShort(currentY, 40);

      const { name: baseName, autonomo, is_house_tech } = getTechName(payout.technician_id);
      const headingName = appendAutonomoLabel(baseName, autonomo, { multiline: false, isHouseTech: is_house_tech });
      currentY = drawReportEntryHeading(doc, geo, headingName, currentY);

      const tableRows = lines.map((ln) => [
        ln.date
          ? `${format(new Date(ln.date), 'P', { locale: es })}${ln.is_prep_day ? '\nDía preparación' : ''}`
          : (ln.is_prep_day ? 'Día preparación' : '—'),
        `${ln.hours_rounded ?? 0}h`,
        ln.is_prep_day && !ln.seasonal_overtime_only
          ? `${formatCurrency(ln.base_day_eur ?? 0)}\n${formatCurrency(ln.prep_day_hourly_rate_eur ?? 15)}/h`
          : formatCurrency(ln.base_day_eur ?? 0),
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
        head: [['Fecha', 'Horas', 'Base día', '+10–12', 'OT', 'Total parte']],
        body: tableRows,
        ...reportTableDefaults(geo, { fontSize: 7, numericColumns: [1, 2, 3, 4, 5] }),
        columnStyles: distributeColumnWidths([20, 9, 18, 16, 22, 14], geo.contentWidth),
      });

      currentY = getLastAutoTableY(doc, currentY) + 8;
    }
  }

  if (payoutsWithExtras.length > 0) {
    currentY = breakIfShort(currentY, 60);
    sectionNumber += 1;
    currentY = drawReportSectionHeading(doc, geo, 'Desglose de extras', currentY, sectionNumber);

    payoutsWithExtras.forEach((payout) => {
      currentY = breakIfShort(currentY, 40);

      const { name: baseName, autonomo, is_house_tech } = getTechName(payout.technician_id);
      const headingName = appendAutonomoLabel(baseName, autonomo, { multiline: false, isHouseTech: is_house_tech });
      currentY = drawReportEntryHeading(doc, geo, headingName, currentY);

      payout.extras_breakdown!.items!.forEach((item) => {
        currentY = breakIfShort(currentY, 20);
        const houseTechLabel = item.is_house_tech_rate ? ' (plantilla)' : '';
        currentY = drawReportItemLine(
          doc,
          geo,
          `${labelForJobExtraType(item.extra_type)}${houseTechLabel} × ${item.quantity}`,
          formatCurrency(item.amount_eur),
          currentY,
        );
      });

      currentY += 4;
    });
  }

  // Expense breakdown section
  if (payoutsWithExpenses.length > 0) {
    currentY = breakIfShort(currentY, 60);
    sectionNumber += 1;
    currentY = drawReportSectionHeading(doc, geo, 'Desglose de gastos', currentY, sectionNumber);

    payoutsWithExpenses.forEach((payout) => {
      currentY = breakIfShort(currentY, 40);

      const { name: baseName, autonomo, is_house_tech } = getTechName(payout.technician_id);
      const headingName = appendAutonomoLabel(baseName, autonomo, { multiline: false, isHouseTech: is_house_tech });
      currentY = drawReportEntryHeading(doc, geo, headingName, currentY);

      // Get category labels map
      const categoryLabels: Record<string, string> = {
        'dietas': 'Dietas',
        'transporte': 'Transporte',
        'alojamiento': 'Alojamiento',
        'material': 'Material',
        'otros': 'Otros',
      };

      if (payout.expenses_breakdown && payout.expenses_breakdown.length > 0) {
        payout.expenses_breakdown.forEach((category) => {
          currentY = breakIfShort(currentY, 20);
          const label = categoryLabels[category.category_slug] || category.category_slug;
          const amount = category.approved_total_eur || 0;
          currentY = drawReportItemLine(doc, geo, label, formatCurrency(amount), currentY);
        });
      }

      currentY += 4;
    });
  }

  currentY = breakIfShort(currentY, 44);

  const totalTimesheets = payouts.reduce((sum, payout) => sum + payout.timesheets_total_eur, 0);
  const totalExtras = payouts.reduce((sum, payout) => sum + payout.extras_total_eur, 0);
  const totalExpenses = payouts.reduce((sum, payout) => sum + (payout.expenses_total_eur || 0), 0);
  const grandTotal = payouts.reduce((sum, payout) => {
    const { autonomo, is_house_tech } = getTechName(payout.technician_id);
    const { deduction } = resolveIrpfDeduction(payout, { autonomo: !!autonomo, is_house_tech: !!is_house_tech });
    return sum + (payout.total_eur - deduction);
  }, 0);

  const totalsLines = [
    { label: 'Total partes', value: formatCurrency(totalTimesheets) },
    { label: 'Total extras', value: formatCurrency(totalExtras) },
  ];
  if (totalExpenses > 0) {
    totalsLines.push({ label: 'Total gastos', value: formatCurrency(totalExpenses) });
  }

  drawReportTotals(doc, geo, currentY, {
    heading: 'Totales del trabajo',
    lines: totalsLines,
    total: { label: 'Total general', value: formatCurrency(grandTotal) },
  });

  stampReportChrome(doc, chrome);

  const filename = buildPdfFilename([
    'Pago',
    jobDetails.title,
    format(new Date(), 'yyyy-MM-dd'),
  ]);
  if (options?.download === false) {
    return pdfToBlob(doc);
  }
  doc.save(filename);
}
