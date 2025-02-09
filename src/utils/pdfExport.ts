import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportTableRow {
  quantity: string;
  componentName?: string;
  weight?: string;
  watts?: string;
  totalWeight?: number;
  totalWatts?: number;
}

interface ExportTable {
  name: string;
  rows: ExportTableRow[];
  totalWeight?: number;
  dualMotors?: boolean;
  totalWatts?: number;
  currentPerPhase?: number;
  toolType?: 'pesos' | 'consumos' | 'technical' | 'infrastructure' | 'extras';
  pduType?: string;
  customPduType?: string;
  includesHoist?: boolean;
}

interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

interface ArtistPdfInfo {
  showTimes: string;
  soundcheckTimes: string;
  notes: string;
  additionalInfo: {
    fohProvider: string;
    monProvider: string;
    wirelessProvider: string;
    iemProvider: string;
    infrastructureProvider: string;
  };
}

/**
 * Function signature:
 * 1. projectName
 * 2. tables
 * 3. type ('weight' | 'power' | 'technical')
 * 4. jobName
 * 5. jobDate (the date of the job – can be a Date or a parsable value)
 * 6. summaryRows (optional) – used for "pesos" reports; if not provided, summary rows are generated automatically
 * 7. powerSummary (optional)
 * 8. safetyMargin (optional)
 */
export const exportToPDF = (
  projectName: string,
  tables: ExportTable[],
  type: 'weight' | 'power' | 'technical',
  jobName: string,
  jobDate: string,
  summaryRows?: SummaryRow[],
  powerSummary?: { totalSystemWatts: number; totalSystemAmps: number },
  safetyMargin?: number,
  artistInfo?: ArtistPdfInfo
): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = new Date().toLocaleDateString('en-GB');

    // Convert jobDate to a proper date string:
    const jobDateStr = new Date(jobDate).toLocaleDateString('en-GB');

    // === HEADER SECTION (for main tables) ===
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    let title = type === 'weight'
      ? "Informe de Distribución de Peso"
      : type === 'power'
      ? "Informe de Distribución de Potencia"
      : "Technical Requirements";
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

    let yPosition = 70;

    // Add artist-specific information if provided
    if (artistInfo) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Schedule Information", 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.text(`Show Time: ${artistInfo.showTimes}`, 14, yPosition);
      yPosition += 8;
      doc.text(`Soundcheck: ${artistInfo.soundcheckTimes}`, 14, yPosition);
      yPosition += 15;
    }

    // === MAIN TABLES SECTION ===
    tables.forEach((table, index) => {
      // Section header background for each table.
      doc.setFillColor(245, 245, 250);
      doc.rect(14, yPosition - 6, pageWidth - 28, 10, 'F');

      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text(table.name, 14, yPosition);
      yPosition += 10;

      // For technical requirements, add provider information
      if (table.toolType === 'technical' && artistInfo?.additionalInfo) {
        const providers = {
          'FOH Console': artistInfo.additionalInfo.fohProvider,
          'MON Console': artistInfo.additionalInfo.monProvider,
          'Handheld Wireless': artistInfo.additionalInfo.wirelessProvider,
          'Bodypack Wireless': artistInfo.additionalInfo.wirelessProvider,
          'IEM Systems': artistInfo.additionalInfo.iemProvider,
          'Monitors': artistInfo.additionalInfo.infrastructureProvider,
        };

        const tableRows = table.rows.map(row => [
          row.quantity,
          row.componentName,
          row.weight || '',
          providers[row.componentName as keyof typeof providers] === 'festival' ? 'Festival' : 'Band'
        ]);

        autoTable(doc, {
          head: [['Quantity', 'Component', 'Model/Type', 'Provided By']],
          body: tableRows,
          startY: yPosition,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 5,
            lineColor: [220, 220, 230],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          bodyStyles: { textColor: [51, 51, 51] },
          alternateRowStyles: { fillColor: [250, 250, 255] },
        });
      } else {
        const tableRows = table.rows.map(row => [
          row.quantity,
          row.componentName,
          row.weight || '',
          ''
        ]);

        autoTable(doc, {
          head: [['Quantity', 'Component', 'Details', '']],
          body: tableRows,
          startY: yPosition,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 5,
            lineColor: [220, 220, 230],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          bodyStyles: { textColor: [51, 51, 51] },
          alternateRowStyles: { fillColor: [250, 250, 255] },
        });
      }

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      if (yPosition > pageHeight - 40 && index < tables.length - 1) {
        doc.addPage();
        yPosition = 20;
      }
    });

    // Add notes section if present
    if (artistInfo?.notes) {
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Notes", 14, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      const splitNotes = doc.splitTextToSize(artistInfo.notes, pageWidth - 28);
      doc.text(splitNotes, 14, yPosition);
      yPosition += splitNotes.length * 7 + 10;
    }

    // === LOGO & CREATED DATE SECTION ===
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
    logo.onload = () => {
      const logoWidth = 50;
      const logoHeight = logoWidth * (logo.height / logo.width);
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const xPosition = (pageWidth - logoWidth) / 2;
        const yLogo = pageHeight - 20;
        try {
          doc.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight);
        } catch (error) {
          console.error(`Error adding logo on page ${i}:`, error);
        }
      }
      doc.setPage(totalPages);
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
      const blob = doc.output('blob');
      resolve(blob);
    };

    logo.onerror = () => {
      console.error('Failed to load logo');
      const totalPages = doc.internal.pages.length - 1;
      doc.setPage(totalPages);
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(`Generated: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
      const blob = doc.output('blob');
      resolve(blob);
    };
  });
};
