import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { VacationRequest } from '@/lib/vacation-requests';
import { supabase } from '@/integrations/supabase/client';

interface VacationRequestPDFOptions {
  request: VacationRequest;
  approverName?: string;
}

// Helper function to load logo image
const loadImageSafely = (src: string, description: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      console.warn(`${description} load timeout`);
      resolve(null);
    }, 3000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      console.warn(`Failed to load ${description}`);
      resolve(null);
    };

    img.crossOrigin = 'anonymous';
    img.src = src;
  });
};

// Function to get approver name
const getApproverName = async (approverId?: string): Promise<string> => {
  if (!approverId) return 'Unknown';
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', approverId)
      .single();
    
    if (error || !data) return 'Unknown';
    
    return `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown';
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
      return { name: 'Not Available', department: 'Not Available' };
    }
    
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Not Available';
    const department = data.department || 'Not Available';
    
    return { name, department };
  } catch (error) {
    console.error('Error fetching technician info:', error);
    return { name: 'Not Available', department: 'Not Available' };
  }
};

// Main PDF generation function
export const generateVacationRequestPDF = async ({ request, approverName }: VacationRequestPDFOptions): Promise<Blob> => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Corporate colors (matching other PDFs in the system)
  const primaryColor: [number, number, number] = [125, 1, 1]; // Dark blue
  const accentColor: [number, number, number] = [125, 1, 25]; // Darker blue-gray
  
  // Load Sector Pro logo (try multiple paths like other PDFs)
  let logoImg: HTMLImageElement | null = null;
  const logoPaths = [
    '/sector pro logo.png',
    '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png',
    './sector pro logo.png',
    'sector pro logo.png'
  ];
  
  for (const logoPath of logoPaths) {
    logoImg = await loadImageSafely(logoPath, 'Sector Pro logo');
    if (logoImg) break;
  }
  
  // Header
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(0, 0, pageWidth, 25, 'F');
  
  // Header text (centered)
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SOLICITUD DE VACACIONES', pageWidth / 2, 15, { align: 'center' });
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
  
  // Document title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Detalles', 15, 45);
  
  // Request information
  let yPosition = 60;
  
  // Get approver name if not provided
  let finalApproverName = approverName;
  if (!finalApproverName && request.approved_by) {
    finalApproverName = await getApproverName(request.approved_by);
  }
  
  // Get technician information
  const techInfo = await getTechnicianInfo(request.technician_id);
  const techName = techInfo.name;
  const department = techInfo.department;
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  
  // Create a structured layout
  const addInfoRow = (label: string, value: string, y: number) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label + ':', 15, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, 80, y);
    return y + 10;
  };
  
  yPosition = addInfoRow('Nombre del Empleado', techName, yPosition);
  yPosition = addInfoRow('Departmento', department, yPosition);
  yPosition = addInfoRow('Fecha de la Solicitud', format(new Date(request.created_at), 'PPP'), yPosition);
  yPosition += 5;
  
  yPosition = addInfoRow('Periodo', 
    `${format(new Date(request.start_date), 'PPP')} - ${format(new Date(request.end_date), 'PPP')}`, 
    yPosition);
    
  // Calculate vacation duration
  const startDate = new Date(request.start_date);
  const endDate = new Date(request.end_date);
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  yPosition = addInfoRow('Duracion', `${durationDays} day${durationDays > 1 ? 's' : ''}`, yPosition);
  yPosition += 5;
  
  // Reason section
  pdf.setFont('helvetica', 'bold');
  pdf.text('Motivo:', 15, yPosition);
  yPosition += 10;
  
  pdf.setFont('helvetica', 'normal');
  const reasonLines = pdf.splitTextToSize(request.reason || 'No reason provided', pageWidth - 30);
  pdf.text(reasonLines, 15, yPosition);
  yPosition += reasonLines.length * 7 + 10;
  
  // Status section
  yPosition = addInfoRow('Estado', request.status.toUpperCase(), yPosition);
  
  // Status color indicator
  const statusColors: Record<string, [number, number, number]> = {
    pending: [255, 193, 7], // amber
    approved: [40, 167, 69], // green
    rejected: [220, 53, 69] // red
  };
  
  const statusColor = statusColors[request.status] || [108, 117, 125];
  pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.circle(70, yPosition - 5, 3, 'F');
  
  yPosition += 5;
  
  // Approval information (if applicable)
  if (request.status === 'approved' && request.approved_at) {
    yPosition = addInfoRow('Aprobado por', finalApproverName || 'Not Available', yPosition);
    yPosition = addInfoRow('Fecha de aprobacion', format(new Date(request.approved_at), 'PPP'), yPosition);
  } else if (request.status === 'rejected' && request.approved_at) {
    yPosition = addInfoRow('Rechazado por', finalApproverName || 'Not Available', yPosition);
    yPosition = addInfoRow('Fecha de rechazo', format(new Date(request.approved_at), 'PPP'), yPosition);
    
    if (request.rejection_reason) {
      yPosition += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Motivo del Rechazo', 15, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      const rejectionLines = pdf.splitTextToSize(request.rejection_reason, pageWidth - 30);
      pdf.text(rejectionLines, 15, yPosition);
      yPosition += rejectionLines.length * 7;
    }
  }
  
  // Footer
  const footerY = pageHeight - 30;
  pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  pdf.rect(0, footerY, pageWidth, 30, 'F');
  
  // Footer content
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  // Sector Pro logo in footer (centered)
  if (logoImg) {
    const footerLogoHeight = 10;
    const footerLogoWidth = footerLogoHeight * (logoImg.width / logoImg.height);
    const logoX = (pageWidth - footerLogoWidth) / 2;
    pdf.addImage(logoImg, 'PNG', logoX, footerY + 5, footerLogoWidth, footerLogoHeight);
  }
  
  // Footer text
  pdf.text(format(new Date(), 'PPP p'), pageWidth - 15, footerY + 10, { align: 'right' });
  
  
  // Page number
  pdf.text('Page 1 of 1', pageWidth / 2, footerY + 20, { align: 'center' });
  
  return new Promise((resolve) => {
    const pdfBlob = pdf.output('blob');
    resolve(pdfBlob);
  });
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
    const cleanTechName = techInfo.name
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim() // Remove leading/trailing spaces
      .replace(/\s/g, '_'); // Replace spaces with underscores
    
    // Format request date for filename
    const requestDate = format(new Date(options.request.created_at), 'MMM_dd_yyyy');
    
    // Generate readable filename: "vacation request tech name date.pdf"
    link.download = `vacation_request_${cleanTechName}_${requestDate}.pdf`;
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