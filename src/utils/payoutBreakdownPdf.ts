import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { fetchJobLogo, fetchTourLogo } from '@/utils/pdf/logoUtils';

type PayoutRow = {
  job_id: string;
  technician_id: string;
  timesheets_total_eur: number;
  extras_total_eur: number;
  total_eur: number;
  vehicle_disclaimer?: boolean;
  vehicle_disclaimer_text?: string | null;
};

const currency = (n: number) =>
  (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const loadImageSafely = (src?: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 5000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = src;
  });
};

export async function downloadJobPayoutBreakdownPDF(jobId: string) {
  // 1) Fetch job basics
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title, start_time')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error('Job not found');

  // 2) Fetch payout rows
  const { data: payouts, error: payoutsError } = await supabase
    .from('v_job_tech_payout_2025')
    .select('job_id, technician_id, timesheets_total_eur, extras_total_eur, total_eur, vehicle_disclaimer, vehicle_disclaimer_text')
    .eq('job_id', jobId);
  if (payoutsError) throw payoutsError;
  const payoutRows = (payouts || []) as PayoutRow[];

  // Early exit if nothing to print
  if (!payoutRows.length) {
    // Still create a minimal PDF indicating no data, for consistency
    await renderAndSavePDF(job.title, job.start_time, [], new Map(), new Map(), job.id);
    return;
  }

  // 3) Resolve technician names
  const techIds = Array.from(new Set(payoutRows.map((p) => p.technician_id))).filter(Boolean) as string[];
  let nameMap = new Map<string, string>();
  if (techIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', techIds);
    if (profilesError) throw profilesError;
    (profiles || []).forEach((p) => {
      const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Sin nombre';
      nameMap.set(p.id, name);
    });
  }

  // 4) Fetch LPO numbers (Flex work orders)
  const { data: lpoRows, error: lpoError } = await supabase
    .from('flex_work_orders')
    .select('technician_id, lpo_number')
    .eq('job_id', jobId);
  if (lpoError) throw lpoError;
  const lpoMap = new Map<string, string | null>();
  (lpoRows || []).forEach((r) => lpoMap.set(r.technician_id, r.lpo_number || null));

  await renderAndSavePDF(job.title, job.start_time, payoutRows, nameMap, lpoMap, job.id);
}

async function renderAndSavePDF(
  jobTitle: string,
  startTime: string | null,
  payouts: PayoutRow[],
  nameMap: Map<string, string>,
  lpoMap: Map<string, string | null>,
  jobId: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header background
  doc.setFillColor(125, 1, 1);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Header logos
  const [jobLogoUrl] = await Promise.all([
    fetchJobLogo(jobId)
  ]);
  const [jobLogo, companyLogo] = await Promise.all([
    loadImageSafely(jobLogoUrl || undefined),
    loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png')
  ]);

  if (jobLogo) {
    try { doc.addImage(jobLogo, 'PNG', 15, 8, 30, 24); } catch {}
  }

  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('DESGLOSE DE PAGOS', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(12);
  const dateStr = startTime ? new Date(startTime).toLocaleDateString('es-ES') : '';
  doc.text(`${jobTitle}${dateStr ? ` — ${dateStr}` : ''}`, pageWidth / 2, 30, { align: 'center' });

  // Body
  let y = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  // Build table rows
  const rows = payouts.map((p) => [
    nameMap.get(p.technician_id) || p.technician_id,
    lpoMap.get(p.technician_id) || '—',
    currency(p.timesheets_total_eur || 0),
    currency(p.extras_total_eur || 0),
    currency(p.total_eur || 0)
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Técnico', 'LPO Nº', 'Partes aprobados', 'Extras', 'Total']],
    body: rows.length ? rows : [['—', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 28 },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
  });

  const afterTableY = (doc as any).lastAutoTable?.finalY ?? y + 10;

  // Grand total summary
  const grandTimesheets = payouts.reduce((s, p) => s + (p.timesheets_total_eur || 0), 0);
  const grandExtras = payouts.reduce((s, p) => s + (p.extras_total_eur || 0), 0);
  const grandTotal = payouts.reduce((s, p) => s + (p.total_eur || 0), 0);

  const boxTop = afterTableY + 8;
  doc.setFillColor(245, 245, 245);
  doc.rect(14, boxTop - 6, pageWidth - 28, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(125, 1, 1);
  doc.text('Resumen', 16, boxTop);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  const rowY = boxTop + 8;
  doc.text(`Total Partes: ${currency(grandTimesheets)}`, 16, rowY);
  doc.text(`Total Extras: ${currency(grandExtras)}`, 80, rowY);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Trabajo: ${currency(grandTotal)}`, 150, rowY);

  // Disclaimers per technician (if any)
  const disclaimers = payouts
    .filter((p) => p.vehicle_disclaimer && p.vehicle_disclaimer_text)
    .map((p) => `${nameMap.get(p.technician_id) || p.technician_id}: ${p.vehicle_disclaimer_text}`);
  if (disclaimers.length) {
    const startY = rowY + 12;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 90, 0);
    const text = `Notas: ${disclaimers.join(' | ')}`;
    const split = doc.splitTextToSize(text, pageWidth - 28);
    doc.text(split, 14, startY);
  }

  // Footer with company logo and generated date
  const footerY = pageHeight - 20;
  if (companyLogo) {
    try {
      const logoW = 50;
      const logoH = logoW * (companyLogo.height / companyLogo.width);
      const x = (pageWidth - logoW) / 2;
      doc.addImage(companyLogo, 'PNG', x, footerY - logoH, logoW, logoH);
    } catch {}
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 12, pageHeight - 8, { align: 'right' });

  const safeName = (jobTitle || 'Trabajo').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeName}_Desglose_Pagos.pdf`);
}

// TOUR-LEVEL EXPORT
type Tour = { id: string; name: string; start_date: string | null; end_date: string | null };
type TourJob = { id: string; title: string; start_time: string | null };

export async function downloadTourPayoutBreakdownPDF(tourId: string) {
  // 1) Fetch tour
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('id, name, start_date, end_date')
    .eq('id', tourId)
    .maybeSingle();
  if (tourError) throw tourError;
  if (!tour) throw new Error('Tour not found');

  // 2) Fetch tour date jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, title, start_time')
    .eq('tour_id', tourId)
    .eq('job_type', 'tourdate')
    .order('start_time', { ascending: true });
  if (jobsError) throw jobsError;
  const tourJobs: TourJob[] = jobs || [];

  const jobIds = tourJobs.map((j) => j.id);

  // 3) Resolve job-specific assignments to limit quotes to technicians actually assigned per date
  const { data: jobAssignments, error: jaErr } = await supabase
    .from('job_assignments')
    .select('job_id, technician_id')
    .in('job_id', jobIds);
  if (jaErr) throw jaErr;
  const jobToTechs = new Map<string, string[]>();
  (jobAssignments || []).forEach((r: any) => {
    if (!r.job_id || !r.technician_id) return;
    const arr = jobToTechs.get(r.job_id) || [];
    arr.push(r.technician_id);
    jobToTechs.set(r.job_id, arr);
  });

  // 4) Compute payouts per job per technician via RPC (covers tourdate payouts)
  const allPayouts: PayoutRow[] = [];
  for (const job of tourJobs) {
    const techIdsForJob = Array.from(new Set(jobToTechs.get(job.id) || []));
    for (const techId of techIdsForJob) {
      const { data, error } = await supabase.rpc('compute_tour_job_rate_quote_2025', { _job_id: job.id, _tech_id: techId });
      if (error) {
        // Skip on error for this tech/job; continue with others
        continue;
      }
      const q = (data || {}) as any;
      // Map to payout row semantics used by PDF
      allPayouts.push({
        job_id: job.id,
        technician_id: techId,
        timesheets_total_eur: Number(q.total_eur || 0),
        extras_total_eur: Number(q.extras_total_eur || 0),
        total_eur: Number(q.total_with_extras_eur || (Number(q.total_eur || 0) + Number(q.extras_total_eur || 0))),
        vehicle_disclaimer: !!q.vehicle_disclaimer,
        vehicle_disclaimer_text: q.vehicle_disclaimer_text ?? null,
      });
    }
  }

  // 5) Names map
  const techIds = Array.from(new Set((jobAssignments || []).map((r: any) => r.technician_id).filter(Boolean)));
  const nameMap = new Map<string, string>();
  if (techIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', techIds);
    if (profilesError) throw profilesError;
    (profiles || []).forEach((p) => {
      const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Sin nombre';
      nameMap.set(p.id, name);
    });
  }

  // 6) LPO map (by job + tech)
  const lpoMap = new Map<string, string | null>();
  if (jobIds.length) {
    const { data: lpoRows, error: lpoError } = await supabase
      .from('flex_work_orders')
      .select('job_id, technician_id, lpo_number')
      .in('job_id', jobIds);
    if (lpoError) throw lpoError;
    (lpoRows || []).forEach((r) => {
      lpoMap.set(`${r.job_id}:${r.technician_id}`, r.lpo_number || null);
    });
  }

  await renderAndSaveTourPDF(tour, tourJobs, allPayouts, nameMap, lpoMap, tourId);
}

async function renderAndSaveTourPDF(
  tour: Tour,
  jobs: TourJob[],
  payouts: PayoutRow[],
  nameMap: Map<string, string>,
  lpoMap: Map<string, string | null>,
  tourId: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header background
  doc.setFillColor(125, 1, 1);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Header logos
  const [tourLogoUrl] = await Promise.all([
    fetchTourLogo(tourId)
  ]);
  const [tourLogo, companyLogo] = await Promise.all([
    loadImageSafely(tourLogoUrl || undefined),
    loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png')
  ]);
  if (tourLogo) {
    try { doc.addImage(tourLogo, 'PNG', 15, 8, 30, 24); } catch {}
  }

  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('DESGLOSE DE PAGOS — GIRA', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(12);
  const range = [tour.start_date, tour.end_date].filter(Boolean).map((d) => new Date(d as string).toLocaleDateString('es-ES')).join(' — ');
  doc.text(`${tour.name}${range ? ` — ${range}` : ''}`, pageWidth / 2, 30, { align: 'center' });

  let y = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  // Group payouts by job
  const byJob = new Map<string, PayoutRow[]>();
  payouts.forEach((p) => {
    const list = byJob.get(p.job_id) || [];
    list.push(p);
    byJob.set(p.job_id, list);
  });

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
  };

  const currencyES = (n: number) => (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  // Render each job section
  for (const job of jobs) {
    const list = byJob.get(job.id) || [];
    ensureSpace(26);
    doc.setFillColor(245, 245, 250);
    doc.rect(14, y - 6, pageWidth - 28, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(125, 1, 1);
    const jobDate = job.start_time ? new Date(job.start_time).toLocaleDateString('es-ES') : '';
    doc.text(`${job.title}${jobDate ? ` — ${jobDate}` : ''}`, 14, y);
    y += 10;

    const rows = list.map((p) => [
      nameMap.get(p.technician_id) || p.technician_id,
      lpoMap.get(`${p.job_id}:${p.technician_id}`) || '—',
      currencyES(p.timesheets_total_eur || 0),
      currencyES(p.extras_total_eur || 0),
      currencyES(p.total_eur || 0),
    ]);

    autoTable(doc, {
      head: [['Técnico', 'LPO Nº', 'Tarifa base', 'Extras', 'Total']],
      body: rows.length ? rows : [['—', '—', '—', '—', '—']],
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 28 },
        2: { cellWidth: 32, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 32, halign: 'right' },
      },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 10;

    // Job subtotal
    const t1 = list.reduce((s, p) => s + (p.timesheets_total_eur || 0), 0);
    const t2 = list.reduce((s, p) => s + (p.extras_total_eur || 0), 0);
    const t3 = list.reduce((s, p) => s + (p.total_eur || 0), 0);
    ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Subtotal partes: ${currencyES(t1)} — Subtotal extras: ${currencyES(t2)} — Subtotal fecha: ${currencyES(t3)}`, 14, y + 8);
    y += 16;
  }

  // Tour grand total
  const grandTimesheets = payouts.reduce((s, p) => s + (p.timesheets_total_eur || 0), 0);
  const grandExtras = payouts.reduce((s, p) => s + (p.extras_total_eur || 0), 0);
  const grandTotal = payouts.reduce((s, p) => s + (p.total_eur || 0), 0);

  ensureSpace(28);
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 6, pageWidth - 28, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(125, 1, 1);
  doc.text('Resumen de Gira', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  const rowY = y + 8;
  doc.text(`Total Partes: ${currencyES(grandTimesheets)}`, 16, rowY);
  doc.text(`Total Extras: ${currencyES(grandExtras)}`, 80, rowY);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Gira: ${currencyES(grandTotal)}`, 150, rowY);

  // Disclaimers (aggregated, deduped)
  const disclaimers = Array.from(
    new Set(
      payouts
        .filter((p) => p.vehicle_disclaimer && p.vehicle_disclaimer_text)
        .map((p) => `${nameMap.get(p.technician_id) || p.technician_id}: ${p.vehicle_disclaimer_text}`)
    )
  );
  if (disclaimers.length) {
    const startY = rowY + 12;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 90, 0);
    const text = `Notas: ${disclaimers.join(' | ')}`;
    const split = doc.splitTextToSize(text, pageWidth - 28);
    doc.text(split, 14, startY);
  }

  // Footer
  const footerY = pageHeight - 20;
  if (companyLogo) {
    try {
      const logoW = 50;
      const logoH = logoW * (companyLogo.height / companyLogo.width);
      const x = (pageWidth - logoW) / 2;
      doc.addImage(companyLogo, 'PNG', x, footerY - logoH, logoW, logoH);
    } catch {}
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 12, pageHeight - 8, { align: 'right' });

  const safeName = (tour.name || 'Gira').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeName}_Desglose_Pagos_Gira.pdf`);
}

// Single tour date export (one job)
export async function downloadTourDatePayoutBreakdownPDF(jobId: string) {
  // Fetch job info
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title, start_time, tour_id')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error('Job not found');
  if ((job as any).job_type && (job as any).job_type !== 'tourdate') {
    // Fallback to generic job export if someone passes non-tourdate here
    return downloadJobPayoutBreakdownPDF(jobId);
  }

  // Assignments for this date
  const { data: assigns, error: aErr } = await supabase
    .from('job_assignments')
    .select('technician_id')
    .eq('job_id', jobId);
  if (aErr) throw aErr;
  const techIds = Array.from(new Set((assigns || []).map((r: any) => r.technician_id).filter(Boolean)));

  // Compute quotes
  const payouts: PayoutRow[] = [];
  for (const techId of techIds) {
    const { data, error } = await supabase.rpc('compute_tour_job_rate_quote_2025', { _job_id: jobId, _tech_id: techId });
    if (error) continue;
    const q = (data || {}) as any;
    payouts.push({
      job_id: jobId,
      technician_id: techId,
      timesheets_total_eur: Number(q.total_eur || 0),
      extras_total_eur: Number(q.extras_total_eur || 0),
      total_eur: Number(q.total_with_extras_eur || (Number(q.total_eur || 0) + Number(q.extras_total_eur || 0))),
      vehicle_disclaimer: !!q.vehicle_disclaimer,
      vehicle_disclaimer_text: q.vehicle_disclaimer_text ?? null,
    });
  }

  // Names
  const nameMap = new Map<string, string>();
  if (techIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', techIds);
    (profiles || []).forEach((p: any) => {
      nameMap.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Sin nombre');
    });
  }

  // LPO map for this job
  const { data: lpos } = await supabase
    .from('flex_work_orders')
    .select('technician_id, lpo_number')
    .eq('job_id', jobId);
  const lpoMap = new Map<string, string | null>();
  (lpos || []).forEach((r: any) => lpoMap.set(r.technician_id, r.lpo_number || null));

  // Render PDF similar to a single job section
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header
  doc.setFillColor(125, 1, 1);
  doc.rect(0, 0, pageWidth, 40, 'F');
  const [jobLogoUrl] = await Promise.all([fetchJobLogo(job.id)]);
  const [jobLogo, companyLogo] = await Promise.all([
    loadImageSafely(jobLogoUrl || undefined),
    loadImageSafely('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png')
  ]);
  if (jobLogo) { try { doc.addImage(jobLogo, 'PNG', 15, 8, 30, 24); } catch {} }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255,255,255);
  doc.text('DESGLOSE DE PAGOS — FECHA', pageWidth/2, 20, { align: 'center' });
  doc.setFontSize(12);
  const dateStr = job.start_time ? new Date(job.start_time).toLocaleDateString('es-ES') : '';
  doc.text(`${job.title}${dateStr ? ` — ${dateStr}` : ''}`, pageWidth/2, 30, { align: 'center' });

  let y = 55;
  const currencyES = (n: number) => (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const rows = payouts.map((p) => [
    nameMap.get(p.technician_id) || p.technician_id,
    lpoMap.get(p.technician_id) || '—',
    currencyES(p.timesheets_total_eur || 0),
    currencyES(p.extras_total_eur || 0),
    currencyES(p.total_eur || 0),
  ]);

  autoTable(doc, {
    head: [['Técnico', 'LPO Nº', 'Tarifa base', 'Extras', 'Total']],
    body: rows.length ? rows : [['—', '—', '—', '—', '—']],
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 28 }, 2: { cellWidth: 32, halign: 'right' }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 32, halign: 'right' } },
  });
  y = (doc as any).lastAutoTable?.finalY ?? y + 10;

  // Subtotals
  const t1 = payouts.reduce((s, p) => s + (p.timesheets_total_eur || 0), 0);
  const t2 = payouts.reduce((s, p) => s + (p.extras_total_eur || 0), 0);
  const t3 = payouts.reduce((s, p) => s + (p.total_eur || 0), 0);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0,0,0); doc.setFontSize(10);
  doc.text(`Subtotal base: ${currencyES(t1)} — Subtotal extras: ${currencyES(t2)} — Total fecha: ${currencyES(t3)}`, 14, y + 8);

  // Disclaimers
  const disclaimers = payouts.filter(p => p.vehicle_disclaimer && p.vehicle_disclaimer_text).map(p => `${nameMap.get(p.technician_id) || p.technician_id}: ${p.vehicle_disclaimer_text}`);
  if (disclaimers.length) {
    const startY = y + 16; doc.setFont('helvetica','italic'); doc.setFontSize(9); doc.setTextColor(120,90,0);
    const txt = `Notas: ${disclaimers.join(' | ')}`; const split = doc.splitTextToSize(txt, pageWidth - 28);
    doc.text(split, 14, startY);
  }

  // Footer
  const footerY = pageHeight - 20;
  if (companyLogo) {
    try { const w = 50; const h = w * (companyLogo.height / companyLogo.width); const x = (pageWidth - w)/2; doc.addImage(companyLogo,'PNG',x,footerY - h,w,h); } catch {}
  }
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100,100,100);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 12, pageHeight - 8, { align: 'right' });

  const safeName = (job.title || 'Fecha').replace(/[^a-zA-Z0-9\s]/g,'').replace(/\s+/g,'_');
  doc.save(`${safeName}_Desglose_Pagos.pdf`);
}
