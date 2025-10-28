import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TourJobRateQuote } from '@/types/tourRates';
import { formatCurrency } from '@/lib/utils';

interface TechnicianProfile {
  id: string;
  first_name: string;
  last_name: string;
}

interface JobDetails {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
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

// Add logo and header to PDF
function addHeaderWithLogo(doc: jsPDF, title: string) {
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);
  
  // Add generation date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${format(new Date(), 'PPP', { locale: es })}`, 14, 28);
  
  return 35; // Return Y position after header
}

// Add footer to all pages
function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageText = `Página ${i} de ${pageCount}`;
    const textWidth = doc.getTextWidth(pageText);
    doc.text(pageText, doc.internal.pageSize.width - textWidth - 14, doc.internal.pageSize.height - 10);
    doc.text('Sector-Pro', 14, doc.internal.pageSize.height - 10);
  }
}

// Generate PDF for individual rate quote (single job date)
export async function generateRateQuotePDF(
  quotes: TourJobRateQuote[],
  jobDetails: JobDetails,
  profiles: TechnicianProfile[],
  lpoMap?: Map<string, string | null>
) {
  const doc = new jsPDF();
  
  let yPos = addHeaderWithLogo(doc, 'Presupuesto de Tarifas - Fecha de Gira');
  
  // Job details section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalles del Trabajo', 14, yPos);
  yPos += 7;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${jobDetails.title}`, 14, yPos);
  yPos += 5;
  doc.text(`Fecha: ${format(new Date(jobDetails.start_time), 'PPP', { locale: es })}`, 14, yPos);
  yPos += 10;
  
  // Rates breakdown table
  const getTechName = (id: string) => {
    const p = profiles.find(x => x.id === id);
    return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown';
  };
  
  const tableData = quotes.map(q => {
    const name = getTechName(q.technician_id);
    const lpo = lpoMap?.get(q.technician_id);
    return [
      name + (lpo ? `\n(LPO: ${lpo})` : ''),
      q.is_house_tech ? 'Plantilla' : (q.category || '—'),
      formatCurrency(q.base_day_eur),
      q.multiplier > 1 ? `×${q.multiplier}` : '—',
      formatCurrency(q.extras_total_eur || 0),
      formatCurrency(q.total_with_extras_eur || q.total_eur)
    ];
  });
  
  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Categoría', 'Base', 'Mult.', 'Extras', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalBase = quotes.reduce((sum, q) => sum + (q.base_day_eur * (q.multiplier || 1)), 0);
  const totalExtras = quotes.reduce((sum, q) => sum + (q.extras_total_eur || 0), 0);
  const grandTotal = quotes.reduce((sum, q) => sum + (q.total_with_extras_eur || q.total_eur), 0);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen', 14, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Base: ${formatCurrency(totalBase)}`, 14, finalY + 7);
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 14, finalY + 14);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total General: ${formatCurrency(grandTotal)}`, 14, finalY + 23);
  
  addFooter(doc);
  
  const filename = `presupuesto_${jobDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

// Generate PDF for entire tour (all dates)
export async function generateTourRatesSummaryPDF(
  tourName: string,
  jobsWithQuotes: Array<{ job: JobDetails; quotes: TourJobRateQuote[] }>,
  profiles: TechnicianProfile[]
) {
  const doc = new jsPDF();
  
  let yPos = addHeaderWithLogo(doc, `Resumen de Tarifas - ${tourName}`);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total de fechas: ${jobsWithQuotes.length}`, 14, yPos);
  yPos += 10;
  
  const getTechName = (id: string) => {
    const p = profiles.find(x => x.id === id);
    return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown';
  };
  
  // Aggregated totals by technician
  const techTotals = new Map<string, { name: string; dates: number; total: number }>();
  
  jobsWithQuotes.forEach(({ quotes }) => {
    quotes.forEach(q => {
      const existing = techTotals.get(q.technician_id) || { 
        name: getTechName(q.technician_id), 
        dates: 0, 
        total: 0 
      };
      existing.dates += 1;
      existing.total += (q.total_with_extras_eur || q.total_eur);
      techTotals.set(q.technician_id, existing);
    });
  });
  
  const summaryData = Array.from(techTotals.values()).map(t => [
    t.name,
    t.dates.toString(),
    formatCurrency(t.total)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Fechas', 'Total Gira']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 10 },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // Grand total
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const tourGrandTotal = Array.from(techTotals.values()).reduce((sum, t) => sum + t.total, 0);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total General de Gira: ${formatCurrency(tourGrandTotal)}`, 14, finalY);
  
  // Detailed breakdown by date (new page)
  doc.addPage();
  yPos = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Desglose por Fecha', 14, yPos);
  yPos += 10;
  
  jobsWithQuotes.forEach(({ job, quotes }) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${format(new Date(job.start_time), 'PPP', { locale: es })} - ${job.title}`, 14, yPos);
    yPos += 7;
    
    const dateTableData = quotes.map(q => [
      getTechName(q.technician_id),
      q.is_house_tech ? 'Plantilla' : (q.category || '—'),
      formatCurrency(q.total_with_extras_eur || q.total_eur)
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Técnico', 'Categoría', 'Total']],
      body: dateTableData,
      theme: 'plain',
      headStyles: { fillColor: [229, 231, 235], textColor: 0 },
      styles: { fontSize: 9 },
      columnStyles: {
        2: { halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 20 }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 8;
  });
  
  addFooter(doc);
  
  const filename = `resumen_gira_${tourName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
  
  let yPos = addHeaderWithLogo(doc, 'Informe de Pagos - Trabajo');
  
  // Job details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalles del Trabajo', 14, yPos);
  yPos += 7;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${jobDetails.title}`, 14, yPos);
  yPos += 5;
  doc.text(`Fecha: ${format(new Date(jobDetails.start_time), 'PPP', { locale: es })}`, 14, yPos);
  yPos += 10;
  
  const getTechName = (id: string) => {
    const p = profiles.find(x => x.id === id);
    return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown';
  };
  
  // Payout breakdown table
  const tableData = payouts.map(p => {
    const name = getTechName(p.technician_id);
    const lpo = lpoMap?.get(p.technician_id);
    return [
      name + (lpo ? `\n(LPO: ${lpo})` : ''),
      formatCurrency(p.timesheets_total_eur),
      formatCurrency(p.extras_total_eur),
      formatCurrency(p.total_eur)
    ];
  });
  
  autoTable(doc, {
    startY: yPos,
    head: [['Técnico', 'Partes', 'Extras', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 10 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });
  
  let finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // Detailed extras breakdown (if any)
  const payoutsWithExtras = payouts.filter(p => p.extras_breakdown?.items && p.extras_breakdown.items.length > 0);
  if (payoutsWithExtras.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Desglose de Extras', 14, finalY);
    finalY += 7;
    
    payoutsWithExtras.forEach(p => {
      const name = getTechName(p.technician_id);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${name}:`, 14, finalY);
      finalY += 5;
      
      p.extras_breakdown!.items!.forEach(item => {
        const itemText = `  • ${item.extra_type.replace('_', ' ')} × ${item.quantity} = ${formatCurrency(item.amount_eur)}`;
        doc.text(itemText, 20, finalY);
        finalY += 5;
      });
      
      finalY += 3;
    });
  }
  
  // Grand totals
  const totalTimesheets = payouts.reduce((sum, p) => sum + p.timesheets_total_eur, 0);
  const totalExtras = payouts.reduce((sum, p) => sum + p.extras_total_eur, 0);
  const grandTotal = payouts.reduce((sum, p) => sum + p.total_eur, 0);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Totales del Trabajo', 14, finalY);
  finalY += 7;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Partes: ${formatCurrency(totalTimesheets)}`, 14, finalY);
  finalY += 5;
  doc.text(`Total Extras: ${formatCurrency(totalExtras)}`, 14, finalY);
  finalY += 7;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total General: ${formatCurrency(grandTotal)}`, 14, finalY);
  
  addFooter(doc);
  
  const filename = `pago_${jobDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
