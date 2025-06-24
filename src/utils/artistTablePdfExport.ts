
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportArtistTablePDF = async (
  jobIdOrData: string | any,
  jobTitle?: string,
  stage?: number,
  logoUrl?: string
): Promise<Blob> => {
  console.log(`Generating artist table PDF`);
  
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let yPosition = 20;

  // Handle both old and new function signatures
  let actualJobTitle: string;
  let actualStage: number | undefined;
  
  if (typeof jobIdOrData === 'string') {
    // Old signature: (jobId, jobTitle, stage, logoUrl)
    actualJobTitle = jobTitle || 'Festival';
    actualStage = stage;
  } else {
    // New signature: (data object)
    actualJobTitle = jobIdOrData.jobTitle || 'Festival';
    actualStage = jobIdOrData.stage;
  }

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  const headerText = actualStage ? `Stage ${actualStage} Artist Schedule` : 'Artist Schedule';
  pdf.text(headerText, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(actualJobTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 30;

  // Placeholder content for now
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
