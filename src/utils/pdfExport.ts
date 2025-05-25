
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
  toolType?: 'pesos' | 'consumos';
  pduType?: string;
  customPduType?: string;
  includesHoist?: boolean;
}

export interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

// Helper function to clean table names by removing suffixes
const cleanTableName = (name: string): string => {
  return name
    .replace(/\s*\(Default\)$/i, '')
    .replace(/\s*\(Override\)$/i, '')
    .trim();
};

export const exportToPDF = (
  projectName: string,
  tables: ExportTable[],
  type: 'weight' | 'power',
  jobName: string,
  jobDate: string,
  summaryRows?: SummaryRow[],
  powerSummary?: { totalSystemWatts: number; totalSystemAmps: number },
  safetyMargin?: number,
  customLogoUrl?: string
): Promise<Blob> => {
  return new Promise<Blob>((resolve) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = new Date().toLocaleDateString('en-GB');
    const footerSpace = 40;

    const jobDateStr = new Date(jobDate).toLocaleDateString('en-GB');

    const titleText = type === 'weight'
      ? "Informe de Distribución de Peso"
      : "Informe de Distribución de Potencia";

    const loadHeaderContent = (customLogo?: HTMLImageElement) => {
      // Header section
      doc.setFillColor(125, 1, 1);
      doc.rect(0, 0, pageWidth, 40, 'F');

      if (customLogo) {
        const logoHeight = 7.5;
        const logoWidth = logoHeight * (customLogo.width / customLogo.height);
        try {
          doc.addImage(customLogo, 'PNG', 10, 5, logoWidth, logoHeight);
        } catch (error) {
          console.error("Error adding custom logo to header:", error);
        }
      }

      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text(titleText, pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

      if (safetyMargin !== undefined && safetyMargin > 0) {
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        doc.text(`Margen de Seguridad Aplicado: ${safetyMargin}%`, 14, 50);
      }
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleDateString('en-GB')}`, 14, 60);

      processTables();
    };

    const processTables = () => {
      let yPosition = 70;

      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - footerSpace) {
          doc.addPage();
          yPosition = 20;
          return true;
        }
        return false;
      };

      // Process each table with cleaned names
      tables.forEach((table, index) => {
        const cleanedTableName = cleanTableName(table.name);
        const rowCount = table.rows.length + (type === 'weight' && table.totalWeight !== undefined ? 1 : 0);
        const approxTableHeight = rowCount * 15 + 40;

        checkPageBreak(approxTableHeight);

        // Table header with improved spacing
        doc.setFillColor(245, 245, 250);
        doc.rect(14, yPosition - 6, pageWidth - 28, 12, 'F');

        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);

        let displayName = cleanedTableName;
        if (type === 'power' && (table.customPduType || table.pduType)) {
          if (!/\([^)]+\)$/.test(cleanedTableName.trim())) {
            displayName = `${cleanedTableName} (${table.customPduType || table.pduType})`;
          }
        }
        
        doc.text(displayName, 14, yPosition + 2);
        yPosition += 15;

        const tableRows = table.rows.map((row) => [
          row.quantity,
          row.componentName || '',
          type === 'weight' ? row.weight || '' : row.watts || '',
          type === 'weight'
            ? row.totalWeight !== undefined ? row.totalWeight.toFixed(2) : ''
            : row.totalWatts !== undefined ? row.totalWatts.toFixed(2) : ''
        ]);

        if (type === 'weight' && table.totalWeight !== undefined) {
          tableRows.push(['', 'Peso Total', '', table.totalWeight.toFixed(2)]);
        }

        const headers =
          type === 'weight'
            ? [['Cantidad', 'Componente', 'Peso (por unidad)', 'Peso Total']]
            : [['Cantidad', 'Componente', 'Vatios (por unidad)', 'Vatios Totales']];

        autoTable(doc, {
          head: headers,
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
          didDrawPage: (data) => {
            yPosition = data.cursor.y + 10;
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        if (type === 'power') {
          if (table.totalWatts !== undefined) {
            checkPageBreak(30);
            doc.setFillColor(245, 245, 250);
            doc.rect(14, yPosition - 6, pageWidth - 28, 20, 'F');

            doc.setFontSize(11);
            doc.setTextColor(125, 1, 1);
            
            // Apply safety margin to display values
            const adjustedWatts = safetyMargin && safetyMargin > 0 
              ? table.totalWatts * (1 + safetyMargin / 100)
              : table.totalWatts;
            
            doc.text(`Potencia Total: ${adjustedWatts.toFixed(2)} W`, 14, yPosition);

            if (table.currentPerPhase !== undefined) {
              yPosition += 7;
              const adjustedCurrent = safetyMargin && safetyMargin > 0 
                ? table.currentPerPhase * (1 + safetyMargin / 100)
                : table.currentPerPhase;
              doc.text(`Corriente por Fase: ${adjustedCurrent.toFixed(2)} A`, 14, yPosition);
            }
            yPosition += 10;
          }

          if (table.includesHoist) {
            checkPageBreak(20);
            doc.setFontSize(10);
            doc.setTextColor(51, 51, 51);
            doc.setFont(undefined, 'italic');
            doc.text(
              `Potencia adicional para polipasto requerida para ${cleanedTableName}: CEE32A 3P+N+G`,
              14,
              yPosition
            );
            yPosition += 10;
            doc.setFont(undefined, 'normal');
          }
        }

        if (yPosition > pageHeight - 60 && index < tables.length - 1) {
          doc.addPage();
          yPosition = 20;
        }
      });

      // Add summary page
      if (summaryRows && summaryRows.length > 0) {
        doc.addPage();

        // Reprint header on summary page
        doc.setFillColor(125, 1, 1);
        doc.rect(0, 0, pageWidth, 40, 'F');

        if (headerLogo) {
          const logoHeight = 7.5;
          const logoWidth = logoHeight * (headerLogo.width / headerLogo.height);
          try {
            doc.addImage(headerLogo, 'PNG', 10, 5, logoWidth, logoHeight);
          } catch (error) {
            console.error("Error adding custom logo to summary header:", error);
          }
        }

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text(titleText, pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(16);
        doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

        if (safetyMargin !== undefined && safetyMargin > 0) {
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Margen de Seguridad Aplicado: ${safetyMargin}%`, 14, 50);
        }
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('en-GB')}`, 14, 60);

        yPosition = 70;

        // Summary content
        if (tables[0]?.toolType === 'consumos') {
          doc.setFontSize(16);
          doc.setTextColor(125, 1, 1);
          doc.text("Resumen", 14, yPosition);
          yPosition += 15;

          tables.forEach((table) => {
            checkPageBreak(30);
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            let pduText = table.customPduType ? table.customPduType : table.pduType;
            let line = `${cleanTableName(table.name)} - PDU: ${pduText || 'N/A'}`;
            doc.text(line, 14, yPosition);
            yPosition += 7;
            
            if (table.includesHoist) {
              doc.setFontSize(10);
              doc.setTextColor(80, 80, 80);
              doc.text(
                `Potencia adicional para polipasto requerida para ${cleanTableName(table.name)}: CEE32A 3P+N+G`,
                14,
                yPosition
              );
              yPosition += 7;
            }
            yPosition += 5;
          });
        } else {
          // Weight summary table
          doc.setFontSize(16);
          doc.setTextColor(125, 1, 1);
          doc.text("Resumen", 14, yPosition);
          yPosition += 10;

          const summaryData = summaryRows.map((row) => [
            row.clusterName,
            row.riggingPoints,
            row.clusterWeight.toFixed(2)
          ]);

          autoTable(doc, {
            head: [['Nombre del Cluster', 'Puntos de Montaje', 'Peso del Cluster']],
            body: summaryData,
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
      }

      // Add company logo and created date to all pages
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
        doc.text(`Creado: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        
        const blob = doc.output('blob');
        resolve(blob);
      };

      logo.onerror = () => {
        console.error('Failed to load logo');
        const totalPages = doc.internal.pages.length - 1;
        doc.setPage(totalPages);
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        doc.text(`Creado: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        const blob = doc.output('blob');
        resolve(blob);
      };
    };

    // Load custom logo if provided
    let headerLogo: HTMLImageElement | undefined;
    if (customLogoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = customLogoUrl;
      img.onload = () => {
        headerLogo = img;
        loadHeaderContent(img);
      };
      img.onerror = () => {
        console.error('Failed to load custom logo:', customLogoUrl);
        loadHeaderContent();
      };
    } else {
      loadHeaderContent();
    }
  });
};
