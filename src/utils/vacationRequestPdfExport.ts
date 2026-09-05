import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { VacationRequest } from '@/lib/vacation-requests';
import { supabase } from '@/integrations/supabase/client';
import { getDepartmentLabel } from '@/types/department';
import { buildVacationRequestPdfFilename } from '@/utils/pdfFileNames';
import { loadJsPDF } from '@/utils/pdf/lazyPdf';
import {
  REPORT_INK,
  REPORT_SOFT,
  drawReportMasthead,
  drawReportSectionHeading,
  loadReportIssuerMark,
  setReportText,
  stampReportChrome,
  drawReportFlag,
  type ReportChromeOptions,
} from '@/utils/pdf/report-system';
import { drawReportItemLine } from '@/utils/pdf/report-system/blocks';

const UNKNOWN = 'No disponible';

/** The long Spanish date used throughout the document. */
const longDate = (value: string | Date): string =>
  format(new Date(value), "d 'de' MMMM 'de' yyyy", { locale: es });

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

interface VacationRequestPDFOptions {
  request: VacationRequest;
  approverName?: string;
}

// Function to get approver name
const getApproverName = async (approverId?: string): Promise<string> => {
  if (!approverId) return UNKNOWN;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', approverId)
      .single();
    
    if (error || !data) return UNKNOWN;

    return `${data.first_name || ''} ${data.last_name || ''}`.trim() || UNKNOWN;
  } catch (error) {
    console.error('Error fetching approver name:', error);
    return 'Unknown';
  }
};

// Function to get technician name and department
const getTechnicianInfo = async (technicianId: string): Promise<{ name: string; department: string }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, department')
      .eq('id', technicianId)
      .single();
    
    if (error || !data) {
      return { name: UNKNOWN, department: UNKNOWN };
    }

    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || UNKNOWN;
    const department = data.department ? getDepartmentLabel(data.department) : UNKNOWN;

    return { name, department };
  } catch (error) {
    console.error('Error fetching technician info:', error);
    return { name: UNKNOWN, department: UNKNOWN };
  }
};

// Main PDF generation function
export const generateVacationRequestPDF = async ({ request, approverName }: VacationRequestPDFOptions): Promise<Blob> => {
  const jsPDF = await loadJsPDF();
  const pdf = new jsPDF();
  await loadReportIssuerMark();

  // Get approver name if not provided
  let finalApproverName = approverName;
  if (!finalApproverName && request.approved_by) {
    finalApproverName = await getApproverName(request.approved_by);
  }

  const { name: techName, department } = await getTechnicianInfo(request.technician_id);

  const startDate = new Date(request.start_date);
  const endDate = new Date(request.end_date);
  const durationDays =
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const durationLabel = `${durationDays} ${durationDays === 1 ? 'día' : 'días'}`;
  const period = `${longDate(request.start_date)} – ${longDate(request.end_date)}`;
  const statusLabel = STATUS_LABELS[request.status] ?? request.status;

  const chrome: ReportChromeOptions = {
    kind: 'vacation',
    kindLabel: 'Solicitud de vacaciones',
    eventTitle: techName,
    contextLabel: period,
  };

  // The person is the subject of the document, so the name is the title; the
  // resolution is the one thing a reader looks for, so it leads the conditions.
  const { geo, y: contentTop } = drawReportMasthead(pdf, {
    ...chrome,
    title: techName,
    subtitle: `Solicitud de vacaciones · ${period}`,
    meta: [
      { label: 'Estado', value: statusLabel },
      { label: 'Duración', value: durationLabel },
      { label: 'Departamento', value: department },
    ],
  });

  let y = drawReportSectionHeading(pdf, geo, 'Solicitud', contentTop, 1);
  y = drawReportItemLine(pdf, geo, 'Empleado', techName, y, { indent: 0 });
  y = drawReportItemLine(pdf, geo, 'Departamento', department, y, { indent: 0 });
  y = drawReportItemLine(pdf, geo, 'Fecha de la solicitud', longDate(request.created_at), y, { indent: 0 });
  y = drawReportItemLine(pdf, geo, 'Periodo solicitado', period, y, { indent: 0 });
  y = drawReportItemLine(pdf, geo, 'Duración', durationLabel, y, { indent: 0 });
  y += 4;

  y = drawReportSectionHeading(pdf, geo, 'Motivo', y, 2);
  setReportText(pdf, request.reason ? REPORT_INK : REPORT_SOFT, 8);
  const reasonLines = pdf.splitTextToSize(
    request.reason || 'No se indicó ningún motivo.',
    geo.contentWidth,
  ) as string[];
  pdf.text(reasonLines, geo.left, y, { lineHeightFactor: 1.3 });
  y += reasonLines.length * 4.4 + 6;

  y = drawReportSectionHeading(pdf, geo, 'Resolución', y, 3);
  y = drawReportItemLine(pdf, geo, 'Estado', statusLabel, y, { indent: 0 });

  if (request.status === 'approved' && request.approved_at) {
    y = drawReportItemLine(pdf, geo, 'Aprobada por', finalApproverName || UNKNOWN, y, { indent: 0 });
    y = drawReportItemLine(pdf, geo, 'Fecha de aprobación', longDate(request.approved_at), y, { indent: 0 });
  } else if (request.status === 'rejected' && request.approved_at) {
    y = drawReportItemLine(pdf, geo, 'Rechazada por', finalApproverName || UNKNOWN, y, { indent: 0 });
    y = drawReportItemLine(pdf, geo, 'Fecha de rechazo', longDate(request.approved_at), y, { indent: 0 });
    if (request.rejection_reason) {
      y = drawReportFlag(pdf, geo, y + 3, {
        label: 'Revisar',
        text: `Motivo del rechazo: ${request.rejection_reason}`,
      });
    }
  } else {
    y = drawReportItemLine(pdf, geo, 'Resolución', 'Pendiente de aprobación', y, { indent: 0 });
  }

  stampReportChrome(pdf, chrome);

  return pdf.output('blob');
};

// Function to download the PDF
export const downloadVacationRequestPDF = async (options: VacationRequestPDFOptions) => {
  try {
    const pdfBlob = await generateVacationRequestPDF(options);
    
    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    
    // Get technician info for filename
    const techInfo = await getTechnicianInfo(options.request.technician_id);
    link.download = buildVacationRequestPdfFilename(techInfo.name, options.request.created_at);
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating vacation request PDF:', error);
    throw error;
  }
};
