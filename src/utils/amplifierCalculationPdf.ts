
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { SpeakerConfig, SpeakerSection, AmplifierResults } from '../components/sound/AmplifierTool';

export const generateAmplifierPdf = async (
  config: Record<string, SpeakerSection>,
  results: AmplifierResults,
  soundComponentDatabase: Array<{ id: number; name: string; weight: number }>,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const createdDate = format(new Date(), 'PPP');

      // Header
      doc.setFillColor(125, 1, 1);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("Amplifier Requirements Report", pageWidth / 2, 20, { align: 'center' });

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

          yPosition = (doc as any).lastAutoTable.finalY + 10;

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

      // Add logo
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

      logo.onload = () => {
        try {
          const logoWidth = 40;
          const logoHeight = logoWidth * (logo.height / logo.width);
          const totalPages = (doc.internal as any).pages.length;

          // Add logo and page numbers to each page
          for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.addImage(logo, 'PNG', pageWidth - 50, pageHeight - 25, logoWidth, logoHeight);
            doc.setFontSize(10);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
          }

          const blob = doc.output('blob');
          resolve(blob);
        } catch (error) {
          console.error('Error adding logo:', error);
          const blob = doc.output('blob');
          resolve(blob);
        }
      };

      logo.onerror = () => {
        console.error('Failed to load logo');
        const blob = doc.output('blob');
        resolve(blob);
      };

    } catch (error) {
      console.error("Error generating PDF:", error);
      reject(error);
    }
  });
};
