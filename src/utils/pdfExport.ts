
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
  riggingPoint?: string;
}

export interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

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
    const footerSpace = 40; // Space reserved for logo and created date

    // Convert jobDate to a proper date string:
    const jobDateStr = new Date(jobDate).toLocaleDateString('en-GB');

    // === HEADER SECTION (for main tables) ===
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Store the titleText variable outside the function so it's accessible everywhere
    const titleText = type === 'weight'
      ? "Informe de Distribución de Peso"
      : "Informe de Distribución de Potencia";

    // If we have a custom logo, load it for the header
    const loadHeaderContent = (customLogo?: HTMLImageElement) => {
      // If we have a custom logo, add it to the left side of the header
      if (customLogo) {
        const logoHeight = 7.5; // Reduced to 1/4th of the original size (was 30)
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
      // Use "Trabajo sin título" if jobName is empty.
      doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(12);
      // Translate "Job Date:" to "Fecha del Trabajo:"
      doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

      // FIXED: Only show safety margin for power reports
      if (safetyMargin !== undefined && type === 'power') {
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        // Translate "Safety Margin Applied:" to "Margen de Seguridad Aplicado:"
        doc.text(`Margen de Seguridad Aplicado: ${safetyMargin}%`, 14, 50);
      }
      doc.setFontSize(10);
      // Translate "Generated:" to "Generado:"
      doc.text(`Generado: ${new Date().toLocaleDateString('en-GB')}`, 14, 60);

      processTables();
    };

    const processTables = () => {
      let yPosition = 70;

      // Function to check if content fits on current page
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - footerSpace) {
          doc.addPage();
          yPosition = 20;
          return true;
        }
        return false;
      };

      // === MAIN TABLES SECTION ===
      tables.forEach((table, index) => {
        // Calculate approximate table height
        const rowCount = table.rows.length + (type === 'weight' && table.totalWeight !== undefined ? 1 : 0);
        const approxTableHeight = rowCount * 15 + 20;

        checkPageBreak(approxTableHeight + 40);

        // Section header background for each table.
        doc.setFillColor(245, 245, 250);
        doc.rect(14, yPosition - 6, pageWidth - 28, 10, 'F');

        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);

        // Use the stored table name.
        // For power reports, append the PDU info only if the table name (trimmed) does not already end with parentheses.
        let displayName = table.name;
        if (type === 'power' && (table.customPduType || table.pduType)) {
          if (!/\([^)]+\)$/.test(table.name.trim())) {
            displayName = `${table.name} (${table.customPduType || table.pduType})`;
          }
        }
        doc.text(displayName, 14, yPosition);
        yPosition += 10;

        const tableRows = table.rows.map((row) => [
          row.quantity,
          row.componentName || '',
          type === 'weight' ? row.weight || '' : row.watts || '',
          type === 'weight'
            ? row.totalWeight !== undefined ? row.totalWeight.toFixed(2) : ''
            : row.totalWatts !== undefined ? row.totalWatts.toFixed(2) : ''
        ]);

        if (type === 'weight' && table.totalWeight !== undefined) {
          // Translate "Total Weight" to "Peso Total"
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

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        if (type === 'power') {
          if (table.totalWatts !== undefined) {
            checkPageBreak(30);
            doc.setFillColor(245, 245, 250);
            doc.rect(14, yPosition - 6, pageWidth - 28, 20, 'F');

            doc.setFontSize(11);
            doc.setTextColor(125, 1, 1);
            // Translate "Total Power:" to "Potencia Total:"
            doc.text(`Potencia Total: ${table.totalWatts.toFixed(2)} W`, 14, yPosition);

            if (table.currentPerPhase !== undefined) {
              yPosition += 7;
              // Translate "Current per Phase:" to "Corriente por Fase:"
              doc.text(`Corriente por Fase: ${table.currentPerPhase.toFixed(2)} A`, 14, yPosition);
            }
            yPosition += 10;
          }

          if (table.includesHoist) {
            checkPageBreak(20);
            doc.setFontSize(10);
            doc.setTextColor(51, 51, 51);
            doc.setFont(undefined, 'italic');
            // Translate "Additional Hoist Power Required for ..." to Spanish.
            doc.text(
              `Potencia adicional para polipasto requerida para ${table.name}: CEE32A 3P+N+G`,
              14,
              yPosition
            );
            yPosition += 10;
            doc.setFont(undefined, 'normal');
          }
        }

        if (yPosition > pageHeight - 40 && index < tables.length - 1) {
          doc.addPage();
          yPosition = 20;
        }
      });

      // === GENERATE SUMMARY DATA ===
      let generatedSummaryRows: SummaryRow[] = [];
      let generatedPowerSummary: { totalSystemWatts: number; totalSystemAmps: number } | undefined;

      // Generate summary for weight reports (pesos)
      if (type === 'weight') {
        generatedSummaryRows = tables.map((table) => ({
          clusterName: table.name,
          riggingPoints: table.riggingPoint || 'N/A',
          clusterWeight: table.totalWeight || 0
        }));
      }

      // Generate summary for power reports (consumos)
      if (type === 'power') {
        const totalSystemWatts = tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
        const totalSystemAmps = tables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0);
        generatedPowerSummary = { totalSystemWatts, totalSystemAmps };
      }

      // Use provided summaries or generated ones
      const finalSummaryRows = summaryRows && summaryRows.length > 0 ? summaryRows : generatedSummaryRows;
      const finalPowerSummary = powerSummary || generatedPowerSummary;

      // === SUMMARY PAGE ===
      // Generate summary for weight reports OR power reports with consumos toolType
      const shouldGenerateSummary = 
        (type === 'weight' && finalSummaryRows.length > 0) ||
        (type === 'power' && tables.length > 0 && tables[0]?.toolType === 'consumos');

      if (shouldGenerateSummary) {
        // Always add a new page for the summary.
        doc.addPage();

        // Reprint header on the summary page.
        doc.setFillColor(125, 1, 1);
        doc.rect(0, 0, pageWidth, 40, 'F');

        // If we have a custom logo, add it to the header of the summary page
        if (headerLogo) {
          const logoHeight = 7.5; // Reduced to 1/4th of the original size (was 30)
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

        // FIXED: Only show safety margin for power reports on summary page too
        if (safetyMargin !== undefined && type === 'power') {
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Margen de Seguridad Aplicado: ${safetyMargin}%`, 14, 50);
        }
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('en-GB')}`, 14, 60);

        yPosition = 70;

        // For "consumos" tool, print summary as text lines.
        if (type === 'power' && tables[0]?.toolType === 'consumos') {
          doc.setFontSize(16);
          doc.setTextColor(125, 1, 1);
          // Translate "Summary" to "Resumen"
          doc.text("Resumen", 14, yPosition);
          yPosition += 10;

          // Print a summary line for each table.
          tables.forEach((table) => {
            checkPageBreak(table.includesHoist ? 30 : 20);
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            let pduText = table.customPduType ? table.customPduType : table.pduType;
            let line = `${table.name} - PDU: ${pduText || 'N/A'}`;
            doc.text(line, 14, yPosition);
            yPosition += 7;
            if (table.includesHoist) {
              doc.setFontSize(10);
              doc.setTextColor(80, 80, 80);
              // Translate "Additional Hoist Power Required for ..." to Spanish.
              doc.text(
                `Potencia adicional para polipasto requerida para ${table.name}: CEE32A 3P+N+G`,
                14,
                yPosition
              );
              yPosition += 7;
            }
            yPosition += 5;
            if (yPosition > pageHeight - 40) {
              doc.addPage();
              yPosition = 20;
              doc.setFontSize(16);
              doc.setTextColor(125, 1, 1);
              // Translate "Summary (cont'd)" to "Resumen (continuado)"
              doc.text("Resumen (continuado)", 14, yPosition);
              yPosition += 10;
            }
          });

          // Next, count followspot elements from the ROBERT JULIAT series.
          const followspotComponents = [
            'ROBERT JULIAT ARAMIS',
            'ROBERT JULIAT MERLIN',
            'ROBERT JULIAT CYRANO',
            'ROBERT JULIAT LANCELOT',
            'ROBERT JULIAT KORRIGAN'
          ];
          let followspotCount = 0;
          tables.forEach((table) => {
            table.rows.forEach((row) => {
              if (
                row.componentName &&
                followspotComponents.some((name) =>
                  row.componentName.toUpperCase().includes(name.toUpperCase())
                )
              ) {
                followspotCount++;
              }
            });
          });
          // For each followspot, print a note with full enumeration.
          for (let i = 1; i <= followspotCount; i++) {
            checkPageBreak(20);
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            // Translate: "CEE16A 1P+N+G required at followspot position #i" to Spanish.
            doc.text(`Se requiere CEE16A 1P+N+G en la posición de followspot n°${i}`, 14, yPosition);
            yPosition += 7;
            if (yPosition > pageHeight - 40) {
              doc.addPage();
              yPosition = 20;
              doc.setFontSize(16);
              doc.setTextColor(125, 1, 1);
              doc.text("Resumen (continuado)", 14, yPosition);
              yPosition += 10;
            }
          }
          // Finally, always add a note for FoH.
          checkPageBreak(20);
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          // Translate "16A Schuko Power required at FoH position" to Spanish.
          doc.text("Se requiere potencia de 16A Schuko en posición FoH", 14, yPosition);
          yPosition += 7;

          // Add power summary if available
          if (finalPowerSummary) {
            checkPageBreak(30);
            doc.setFontSize(14);
            doc.setTextColor(125, 1, 1);
            doc.text("Resumen de Potencia Total", 14, yPosition);
            yPosition += 10;
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Potencia Total del Sistema: ${finalPowerSummary.totalSystemWatts.toFixed(2)} W`, 14, yPosition);
            yPosition += 7;
            doc.text(`Corriente Total del Sistema: ${finalPowerSummary.totalSystemAmps.toFixed(2)} A`, 14, yPosition);
            yPosition += 7;
          }
        } else if (type === 'weight' && finalSummaryRows.length > 0) {
          doc.setFontSize(16);
          doc.setTextColor(125, 1, 1);
          // Translate "Summary" to "Resumen"
          doc.text("Resumen", 14, yPosition);
          yPosition += 6;

          const summaryData = finalSummaryRows.map((row) => [
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
            didDrawPage: (data) => {
              yPosition = data.cursor.y + 10;
            }
          });
          yPosition = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // === LOGO & CREATED DATE SECTION ===
      // Add the company logo on every page and on the last page add the created date.
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
        // Translate "Created:" to "Creado:"
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

    // If a custom logo URL is provided, load it first
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
