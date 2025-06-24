
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportRfIemTablePDF = async (
  jobId: string,
  jobTitle: string,
  stage: number,
  logoUrl?: string
): Promise<Blob> => {
  console.log(`Generating RF & IEM table PDF for stage ${stage}`);
  
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let yPosition = 20;

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Stage ${stage} RF & IEM Overview`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(jobTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 30;

  // Placeholder content
  pdf.setFontSize(12);
  pdf.text('RF and IEM overview will be implemented here.', 20, yPosition);
  yPosition += 20;
  pdf.text('This includes:', 20, yPosition);
  yPosition += 15;
  pdf.text('• Wireless Microphone Systems', 30, yPosition);
  yPosition += 15;
  pdf.text('• In-Ear Monitor Systems', 30, yPosition);
  yPosition += 15;
  pdf.text('• Frequency Coordination', 30, yPosition);
  yPosition += 15;
  pdf.text('• RF Coverage Requirements', 30, yPosition);

  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};
