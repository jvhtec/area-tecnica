import { format } from 'date-fns';
import { ShiftWithAssignments } from '@/types/festival-scheduling';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import {
  distributeColumnWidths,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  festivalTableTheme,
  loadFestivalIssuerMark,
} from '@/utils/pdf/festival-report';

export interface ShiftsTablePdfData {
  jobTitle: string;
  date: string;
  jobId?: string;
  shifts: ShiftWithAssignments[];
  logoUrl?: string;
  /** False when the document is bound into a set that stamps its own folios. */
  paginate?: boolean;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  sound: 'Sonido',
  lights: 'Iluminación',
  video: 'Vídeo',
  logistics: 'Logística',
  production: 'Producción',
  administrative: 'Administración',
};

const technicianName = (assignment: ShiftWithAssignments['assignments'][number]): string => {
  if (assignment.external_technician_name) return assignment.external_technician_name;
  const profile = assignment.profiles;
  // A partial name is more use to a crew chief than "Sin nombre".
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  return name || 'Sin nombre';
};

export const exportShiftsTablePDF = async (data: ShiftsTablePdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const shiftDate = new Date(data.date);
  const dateLabel = Number.isNaN(shiftDate.getTime())
    ? data.date
    : format(shiftDate, 'dd/MM/yyyy');

  await loadFestivalIssuerMark();
  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  const chrome = () =>
    drawFestivalChrome(doc, {
      kind: 'shifts',
      eventTitle: data.jobTitle,
      contextLabel: dateLabel,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      paginate: false,
    });

  const geo = chrome();
  const { mm } = geo;

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'Turnos de personal  ·  Rev. A',
    title: data.jobTitle,
    subtitle: `Jornada del ${dateLabel}`,
    clientLogo,
  });

  const byDepartment = new Map<string, ShiftWithAssignments[]>();
  for (const shift of data.shifts) {
    const department = shift.department || 'General';
    if (!byDepartment.has(department)) byDepartment.set(department, []);
    byDepartment.get(department)?.push(shift);
  }

  const assignedCount = data.shifts.reduce(
    (total, shift) => total + (shift.assignments?.length ?? 0),
    0,
  );
  const unstaffed = data.shifts.filter((shift) => (shift.assignments?.length ?? 0) === 0).length;

  y = drawFestivalMetaGrid(doc, geo, [
    { label: 'Turnos', value: String(data.shifts.length) },
    { label: 'Departamentos', value: String(byDepartment.size) },
    { label: 'Asignaciones', value: String(assignedCount) },
    { label: 'Sin cubrir', value: unstaffed > 0 ? String(unstaffed) : 'Ninguno' },
  ], y);

  if (data.shifts.length === 0) {
    drawFestivalNilState(
      doc,
      geo,
      y,
      'No hay turnos definidos para esta jornada. Confirmado como jornada sin personal asignado, no pendiente de planificación.',
    );
  }

  let sectionNumber = 1;
  for (const [department, shifts] of byDepartment.entries()) {
    const sorted = [...shifts].sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (y + 26 * mm > geo.contentBottom) {
      doc.addPage();
      chrome();
      y = geo.contentTop;
    }

    y = drawFestivalSectionHeading(
      doc,
      geo,
      DEPARTMENT_LABELS[department] ?? department,
      y,
      sectionNumber,
    );
    sectionNumber += 1;

    const rows = sorted.map((shift) => [
      shift.name,
      shift.stage ? `Escenario ${shift.stage}` : '—',
      `${shift.start_time.substring(0, 5)} – ${shift.end_time.substring(0, 5)}`,
      (shift.assignments ?? [])
        .map((assignment) => `${technicianName(assignment)} (${assignment.role || 'sin rol'})`)
        .join('\n') || 'Sin asignar',
    ]);

    autoTable(doc, {
      head: [['Turno', 'Escenario', 'Horario', 'Técnicos asignados']],
      body: rows,
      startY: y,
      ...festivalTableTheme(geo, { fontSize: 7.6 }),
      columnStyles: distributeColumnWidths([26, 20, 20, 60], geo.contentWidth),
      margin: {
        left: geo.left,
        right: geo.pageWidth - geo.right,
        top: geo.contentTop,
        bottom: geo.pageHeight - geo.contentBottom,
      },
      rowPageBreak: 'avoid',
      didDrawPage: () => {
        chrome();
      },
    });

    y = getLastAutoTableY(doc, y) + 10 * mm;
  }

  if (data.shifts.length > 0) {
    drawFestivalConstantsLine(doc, geo, [{ label: 'Jornada', value: dateLabel }], y - 6 * mm);
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'shifts',
      eventTitle: data.jobTitle,
      contextLabel: dateLabel,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber: page,
      totalPages,
      paginate: data.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};
