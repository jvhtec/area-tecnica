import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { VacationRequest } from '@/lib/vacation-requests';

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

// Main PDF generation function
export const generateVacationRequestPDF = async ({ request, approverName }: VacationRequestPDFOptions): Promise<Blob> => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Company colors
  const primaryColor = '#1a365d';
  const accentColor = '#2d3748';
  
  // Load company logo
  const logoImg = await loadImageSafely('/company-logo.png', 'company logo');
  
  // Header
  pdf.setFillColor(26, 54, 93); // primaryColor
  pdf.rect(0, 0, pageWidth, 25, 'F');
  
  // Company logo in header (if available)
  if (logoImg) {
    pdf.addImage(logoImg, 'PNG', 15, 5, 30, 15);
  }
  
  // Header text
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('VACATION REQUEST', pageWidth - 15, 15, { align: 'right' });
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
  
  // Document title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Vacation Request Details', 15, 45);
  
  // Request information
  let yPosition = 60;
  
  // Technician information
  const techName = request.technicians 
    ? `${request.technicians.first_name || ''} ${request.technicians.last_name || ''}`.trim()
    : 'Unknown Technician';
    
  const department = request.technicians?.department || 'Unknown Department';
  
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
  
  yPosition = addInfoRow('Technician Name', techName, yPosition);
  yPosition = addInfoRow('Department', department, yPosition);
  yPosition = addInfoRow('Request Date', format(new Date(request.created_at), 'PPP'), yPosition);
  yPosition += 5;
  
  yPosition = addInfoRow('Vacation Period', 
    `${format(new Date(request.start_date), 'PPP')} - ${format(new Date(request.end_date), 'PPP')}`, 
    yPosition);
    
  // Calculate vacation duration
  const startDate = new Date(request.start_date);
  const endDate = new Date(request.end_date);
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  yPosition = addInfoRow('Duration', `${durationDays} day${durationDays > 1 ? 's' : ''}`, yPosition);
  yPosition += 5;
  
  // Reason section
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reason:', 15, yPosition);
  yPosition += 10;
  
  pdf.setFont('helvetica', 'normal');
  const reasonLines = pdf.splitTextToSize(request.reason || 'No reason provided', pageWidth - 30);
  pdf.text(reasonLines, 15, yPosition);
  yPosition += reasonLines.length * 7 + 10;
  
  // Status section
  yPosition = addInfoRow('Status', request.status.toUpperCase(), yPosition);
  
  // Status color indicator
  const statusColors: Record<string, [number, number, number]> = {
    pending: [255, 193, 7], // amber
    approved: [40, 167, 69], // green
    rejected: [220, 53, 69] // red
  };
  
  const statusColor = statusColors[request.status] || [108, 117, 125];
  pdf.setFillColor(...statusColor);
  pdf.circle(70, yPosition - 5, 3, 'F');
  
  yPosition += 5;
  
  // Approval information (if applicable)
  if (request.status === 'approved' && request.approved_at) {
    yPosition = addInfoRow('Approved By', approverName || 'Unknown', yPosition);
    yPosition = addInfoRow('Approval Date', format(new Date(request.approved_at), 'PPP'), yPosition);
  } else if (request.status === 'rejected' && request.approved_at) {
    yPosition = addInfoRow('Rejected By', approverName || 'Unknown', yPosition);
    yPosition = addInfoRow('Rejection Date', format(new Date(request.approved_at), 'PPP'), yPosition);
    
    if (request.rejection_reason) {
      yPosition += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Rejection Reason:', 15, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      const rejectionLines = pdf.splitTextToSize(request.rejection_reason, pageWidth - 30);
      pdf.text(rejectionLines, 15, yPosition);
      yPosition += rejectionLines.length * 7;
    }
  }
  
  // Footer
  const footerY = pageHeight - 30;
  pdf.setFillColor(45, 55, 72); // accentColor
  pdf.rect(0, footerY, pageWidth, 30, 'F');
  
  // Footer content
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  // Company logo in footer (smaller)
  if (logoImg) {
    pdf.addImage(logoImg, 'PNG', 15, footerY + 5, 20, 10);
  }
  
  // Footer text
  pdf.text('Generated on: ' + format(new Date(), 'PPP p'), pageWidth - 15, footerY + 10, { align: 'right' });
  pdf.text('Sector Pro Audio & Video', pageWidth - 15, footerY + 20, { align: 'right' });
  
  // Page number
  pdf.text('Page 1 of 1', pageWidth / 2, footerY + 15, { align: 'center' });
  
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
    
    // Generate filename
    const techName = options.request.technicians 
      ? `${options.request.technicians.first_name}_${options.request.technicians.last_name}`
      : 'vacation_request';
    const requestDate = format(new Date(options.request.created_at), 'yyyy-MM-dd');
    
    link.download = `vacation_request_${techName}_${requestDate}.pdf`;
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