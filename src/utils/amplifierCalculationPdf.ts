import { format } from 'date-fns';
import type { SpeakerSection, AmplifierResults } from '@/components/sound/amplifier-tool/types';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  drawCorporatePdfHeader,
  drawGeneratedPdfFooter,
  getLastAutoTableY,
  loadCompanyLogoDataUrl,
} from '@/utils/pdf';

export const generateAmplifierPdf = async (
  config: Record<string, SpeakerSection>,
  results: AmplifierResults,
  soundComponentDatabase: Array<{ id: number; name: string; weight: number }>,
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const companyLogo = await loadCompanyLogoDataUrl();
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      const createdDate = format(new Date(), 'PPP');

      // Header (shared corporate chrome)
      drawCorporatePdfHeader(doc, { title: 'Amplifier Requirements Report' });

      // Date
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Generated: ${createdDate}`, 14, 40);

      let yPosition = 60;

      // Section Details
      Object.entries(results.perSection).forEach(([section, data]) => {
        if (data.totalAmps > 0) {
          // Section Header
          doc.setFontSize(14);
          doc.setTextColor(125, 1, 1);
          const sectionTitle = `${section.charAt(0).toUpperCase() + section.slice(1)}${data.mirrored ? ' (Mirrored)' : ''}`;
          doc.text(sectionTitle, 14, yPosition);
          yPosition += 10;

          // Speaker Details
          const speakerData = data.details.map(detail => [detail]);
          autoTable(doc, {
            startY: yPosition,
            head: [['Speaker Configuration']],
            body: speakerData,
            theme: 'grid',
            headStyles: {
              fillColor: [200, 200, 200],
              textColor: [0, 0, 0],
              fontStyle: 'bold'
            },
            margin: { left: 14, right: 14 },
          });

          yPosition = getLastAutoTableY(doc, yPosition) + 10;

          // Total for section
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          doc.text(`Total amplifiers for section: ${data.totalAmps}`, 14, yPosition);
          yPosition += 20;

          // Check if we need a new page
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
          }
        }
      });

      // Summary Section
      doc.setFontSize(16);
      doc.setTextColor(125, 1, 1);
      doc.text("Summary", 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      const summaryData = [
        [`Total LA-RAKs required: ${results.completeRaks}`],
        [`Additional loose amplifiers: ${results.looseAmplifiers}`],
        [`Total amplifiers needed: ${results.totalAmplifiersNeeded}`]
      ];

      autoTable(doc, {
        startY: yPosition,
        body: summaryData,
        theme: 'plain',
        styles: {
          fontSize: 12,
          cellPadding: 2
        },
        margin: { left: 14, right: 14 }
      });

      // Shared corporate footer (centered logo + generated date + page number)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawGeneratedPdfFooter(doc, { pageNumber: i, logo: companyLogo });
      }

      resolve(doc.output('blob'));
    } catch (error) {
      console.error("Error generating PDF:", error);
      reject(error);
    }
  });
};
