
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportShiftsTablePDF = async (
  jobId: string,
  jobTitle: string,
  stage: number,
  logoUrl?: string
): Promise<Blob> => {
  console.log(`Generating shifts table PDF for stage ${stage}`);
  
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let yPosition = 20;

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Stage ${stage} Staff Schedules`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(jobTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 30;

  // Placeholder content
  pdf.setFontSize(12);
  pdf.text('Staff shift schedules will be implemented here.', 20, yPosition);
  yPosition += 20;
  pdf.text('This includes:', 20, yPosition);
  yPosition += 15;
  pdf.text('• Load-in Schedule', 30, yPosition);
  yPosition += 15;
  pdf.text('• Sound Check Times', 30, yPosition);
  yPosition += 15;
  pdf.text('• Show Schedule', 30, yPosition);
  yPosition += 15;
  pdf.text('• Load-out Schedule', 30, yPosition);

  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};
