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
  const [headerLogo, companyLogo] = await Promise.all([
    resolveHeaderLogo({
      jobId: jobDetails.id,
      tourId: jobDetails.tour_id,
    }),
    getCompanyLogo(),
  ]);
  const headerOptions: CorporateHeaderOptions = {
    title: 'Informe de Pagos',
    subtitle: jobDetails.title,
    metadata: `Generado: ${format(new Date(), 'PPP', { locale: es })}`,
    logo: headerLogo,
  };
  const contentTop = drawCorporateHeader(doc, headerOptions);

  let yPos = contentTop;

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
  doc.text(`Fecha${sortedDates.length > 1 ? 's' : ''}: ${dateText}`, 14, yPos);
  yPos += 5;

  // Only show invoicing details for autonomo techs (excluding house techs)
  if (shouldShowInvoicing && jobDetails.invoicing_company) {
    const companyDetails = getInvoicingCompanyDetails(jobDetails.invoicing_company);
    if (companyDetails) {
      doc.text(`Empresa facturadora: ${companyDetails.legalName}`, 14, yPos);
      yPos += 5;
      doc.text(`CIF: ${companyDetails.cif}`, 14, yPos);
      yPos += 5;
      doc.text(`Dirección: ${companyDetails.address}`, 14, yPos);
      yPos += 5;
    } else {
      // Fallback to raw name if lookup fails
      doc.text(`Empresa facturadora: ${jobDetails.invoicing_company}`, 14, yPos);
      yPos += 5;
    }
  }

  if (shouldShowInvoicing && lpoNumber) {
    doc.text(`Nº Referencia (LPO): ${lpoNumber}`, 14, yPos);
    yPos += 5;
  }

  yPos += 5;

  doc.setTextColor(...TEXT_PRIMARY);

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
      const { autonomo } = getTechName(p.technician_id);
      return !autonomo;
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
    ...corporateTableDefaults(doc, headerOptions, contentTop),
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
  });

  let disclaimerY = getLastAutoTableY(doc, yPos) + 8;
  if (anyDeductionApplied) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(DEDUCTION_DISCLAIMER_TEXT, 14, disclaimerY);
      disclaimerY += 6;
  }

  if (anyOverride) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...CORPORATE_RED);
      doc.text('AVISO: Hay overrides manuales de pago (excepción). Administración debe validar con Dirección.', 14, disclaimerY);
      disclaimerY += 6;
  }

  if (anyEvento) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(EVENTO_DISCLAIMER_TEXT, 14, disclaimerY);
      disclaimerY += 6;
  }

  if (anyPrepDay) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(PREP_DAY_DISCLAIMER_TEXT, 14, disclaimerY);
      disclaimerY += 6;
  }

  if (anyHouseTechTravelRate) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(FIXED_TRAVEL_RATE_DISCLAIMER_TEXT, 14, disclaimerY);
      disclaimerY += 6;
  }

  let currentY = disclaimerY + 4;
  const pageHeight = doc.internal.pageSize.getHeight();

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
    if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 60)) {
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

      if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 40)) {
        doc.addPage();
        currentY = drawCorporateHeader(doc, headerOptions) + 2;
      }

      const { name: baseName, autonomo, is_house_tech } = getTechName(payout.technician_id);
      const headingName = appendAutonomoLabel(baseName, autonomo, { multiline: false, isHouseTech: is_house_tech });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(headingName, 14, currentY);
      currentY += 5;

      const tableRows = lines.map((ln) => [
        ln.date
          ? `${format(new Date(ln.date), 'P', { locale: es })}${ln.is_prep_day ? '\nDía preparación' : ''}`
          : (ln.is_prep_day ? 'Día preparación' : '—'),
        `${ln.hours_rounded ?? 0}h`,
        ln.is_prep_day
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
        head: [['Fecha', 'Horas', 'Base día', '+10–12', 'OT', 'Total Parte']],
        body: tableRows,
        ...corporateTableDefaults(doc, headerOptions, contentTop),
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' },
        },
      });

      currentY = getLastAutoTableY(doc, currentY) + 8;
    }
  }

  if (payoutsWithExtras.length > 0) {
    if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 60)) {
      doc.addPage();
      currentY = drawCorporateHeader(doc, headerOptions) + 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...CORPORATE_RED);
    doc.text('Desglose de Extras', 14, currentY);
    currentY += 7;

    payoutsWithExtras.forEach((payout) => {
      if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 40)) {
        doc.addPage();
        currentY = drawCorporateHeader(doc, headerOptions) + 2;
      }

      const { name: baseName, autonomo, is_house_tech } = getTechName(payout.technician_id);
      const headingName = appendAutonomoLabel(baseName, autonomo, { multiline: false, isHouseTech: is_house_tech });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(headingName, 14, currentY);
      currentY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MUTED);

      payout.extras_breakdown!.items!.forEach((item) => {
        const houseTechLabel = item.is_house_tech_rate ? ' (plantilla)' : '';
        const itemText = `• ${labelForJobExtraType(item.extra_type)}${houseTechLabel} × ${item.quantity} = ${formatCurrency(item.amount_eur)}`;
        doc.text(itemText, 18, currentY);
        currentY += 5;

        if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 20)) {
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

  // Expense breakdown section
  if (payoutsWithExpenses.length > 0) {
    if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 60)) {
      doc.addPage();
      currentY = drawCorporateHeader(doc, headerOptions) + 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...CORPORATE_RED);
    doc.text('Desglose de Gastos', 14, currentY);
    currentY += 7;

    payoutsWithExpenses.forEach((payout) => {
      if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 40)) {
        doc.addPage();
        currentY = drawCorporateHeader(doc, headerOptions) + 2;
      }

      const { name: baseName, autonomo, is_house_tech } = getTechName(payout.technician_id);
      const headingName = appendAutonomoLabel(baseName, autonomo, { multiline: false, isHouseTech: is_house_tech });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...CORPORATE_RED);
      doc.text(headingName, 14, currentY);
      currentY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MUTED);

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
          const label = categoryLabels[category.category_slug] || category.category_slug;
          const amount = category.approved_total_eur || 0;
          const itemText = `• ${label}: ${formatCurrency(amount)}`;
          doc.text(itemText, 18, currentY);
          currentY += 5;

          if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 20)) {
            doc.addPage();
            currentY = drawCorporateHeader(doc, headerOptions) + 2;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...TEXT_MUTED);
          }
        });
      }

      currentY += 4;
    });
  }

  if (currentY > pageHeight - (CORPORATE_FOOTER_RESERVED + 40)) {
    doc.addPage();
    currentY = drawCorporateHeader(doc, headerOptions) + 4;
  }

  const totalTimesheets = payouts.reduce((sum, payout) => sum + payout.timesheets_total_eur, 0);
  const totalExtras = payouts.reduce((sum, payout) => sum + payout.extras_total_eur, 0);
  const totalExpenses = payouts.reduce((sum, payout) => sum + (payout.expenses_total_eur || 0), 0);
  const grandTotal = payouts.reduce((sum, payout) => {
    const { autonomo, is_house_tech } = getTechName(payout.technician_id);
    const { deduction } = resolveIrpfDeduction(payout, { autonomo: !!autonomo, is_house_tech: !!is_house_tech });
    return sum + (payout.total_eur - deduction);
  }, 0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const summaryWidth = pageWidth - 28;

  const summaryHeight = totalExpenses > 0 ? 40 : 32;
  doc.setFillColor(...SUMMARY_BACKGROUND);
  doc.roundedRect(14, currentY, summaryWidth, summaryHeight, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...CORPORATE_RED);
  doc.text('Totales del Trabajo', 18, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Total Partes: ${formatCurrency(totalTimesheets)}`, 18, currentY + 18);
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 18, currentY + 26);

  let totalTextY = currentY + 22;
  if (totalExpenses > 0) {
    doc.text(`Total Gastos: ${formatCurrency(totalExpenses)}`, 18, currentY + 34);
    totalTextY = currentY + 30;
  }

  const totalText = `Total General: ${formatCurrency(grandTotal)}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...CORPORATE_RED);
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, 14 + summaryWidth - totalWidth - 6, totalTextY);

  const footerLogo = companyLogo ?? headerLogo;
  drawCorporateFooter(doc, footerLogo);

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
