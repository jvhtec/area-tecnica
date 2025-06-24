
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportArtistTablePDF = async (
  jobId: string,
  jobTitle: string,
  stage: number,
  logoUrl?: string
): Promise<Blob> => {
  console.log(`Generating artist table PDF for stage ${stage}`);
  
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let yPosition = 20;

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Stage ${stage} Artist Schedule`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(jobTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 30;

  // Placeholder content
  pdf.setFontSize(12);
  pdf.text('Artist schedule table will be implemented here.', 20, yPosition);
  yPosition += 20;
  pdf.text('This includes:', 20, yPosition);
  yPosition += 15;
  pdf.text('• Artist Names and Times', 30, yPosition);
  yPosition += 15;
  pdf.text('• Soundcheck Schedule', 30, yPosition);
  yPosition += 15;
  pdf.text('• Show Times', 30, yPosition);
  yPosition += 15;
  pdf.text('• Changeover Times', 30, yPosition);

  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};
