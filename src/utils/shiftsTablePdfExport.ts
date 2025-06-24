
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

export interface ShiftsTablePdfData {
  jobTitle: string;
  date: string;
  jobId: string;
  shifts: any[];
  logoUrl?: string;
}

export const exportShiftsTablePDF = async (
  pdfData: ShiftsTablePdfData
): Promise<Blob> => {
  console.log(`Generating shifts table PDF for ${pdfData.date}`);
  
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let yPosition = 20;

  // Add logo if available
  if (pdfData.logoUrl) {
    try {
      const logoResponse = await fetch(pdfData.logoUrl);
      const logoImageData = await logoResponse.arrayBuffer();
      let logoImage;
      
      if (pdfData.logoUrl.toLowerCase().endsWith('.png')) {
        logoImage = await pdf.addImage(logoImageData, 'PNG', pageWidth - 60, 10, 40, 30);
      } else {
        logoImage = await pdf.addImage(logoImageData, 'JPEG', pageWidth - 60, 10, 40, 30);
      }
    } catch (error) {
      console.error('Error adding logo to shifts PDF:', error);
    }
  }

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Staff Schedule - ${pdfData.date}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(pdfData.jobTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 30;

  if (pdfData.shifts && pdfData.shifts.length > 0) {
    // Create shifts table
    const tableData = pdfData.shifts.map(shift => [
      shift.name || '',
      `${shift.start_time?.slice(0, 5) || ''} - ${shift.end_time?.slice(0, 5) || ''}`,
      shift.stage ? `Stage ${shift.stage}` : '-',
      shift.department || '-',
      shift.assignments?.length > 0 
        ? shift.assignments.map((a: any) => 
            a.external_technician_name || 
            (a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : 'Unknown')
          ).join(', ')
        : 'No assignments'
    ]);

    (pdf as any).autoTable({
      startY: yPosition,
      head: [['Shift', 'Time', 'Stage', 'Department', 'Technicians']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [139, 21, 33],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: { 
        fontSize: 9,
        textColor: [33, 37, 41]
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      }
    });
  } else {
    pdf.setFontSize(12);
    pdf.text('No shifts scheduled for this date.', 20, yPosition);
  }

  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};

// Legacy function signature for backward compatibility
export const exportShiftsTablePDFLegacy = async (
  jobId: string,
  jobTitle: string,
  stage: number,
  logoUrl?: string
): Promise<Blob> => {
  const pdfData: ShiftsTablePdfData = {
    jobId,
    jobTitle,
    date: new Date().toISOString().split('T')[0],
    shifts: [],
    logoUrl
  };
  
  return exportShiftsTablePDF(pdfData);
};
