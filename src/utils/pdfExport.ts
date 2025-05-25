
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TableData {
  name: string;
  rows?: any[];
  totalWatts?: number;
  totalWeight?: number;
  currentPerPhase?: number;
  pduType?: string;
  customPduType?: string;
  includesHoist?: boolean;
  riggingPoints?: string;
  toolType?: string;
}

export interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

interface AutoTableJsPDF extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export const exportToPDF = async (
  title: string,
  tables: TableData[],
  reportType: 'power' | 'weight',
  jobTitle: string,
  jobDate: string,
  summaryRows?: SummaryRow[],
  defaultTables?: TableData[],
  safetyMargin?: number,
  logoUrl?: string
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Starting PDF generation with tables:", tables);
      console.log("Report type:", reportType);
      console.log("Default tables:", defaultTables);
      
      const doc = new jsPDF() as AutoTableJsPDF;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const createdDate = new Date().toLocaleDateString('en-GB');

      // === HEADER SECTION ===
      doc.setFillColor(125, 1, 1);
      doc.rect(0, 0, pageWidth, 40, 'F');

      // Header text
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      const headerTitle = reportType === 'power' ? 'Informe de Distribución de Potencia' : 'Informe de Pesos';
      doc.text(headerTitle, pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.text(jobTitle, pageWidth / 2, 30, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Fecha del Trabajo: ${jobDate}`, pageWidth / 2, 38, { align: 'center' });

      let currentY = 50;

      // Add safety margin info if provided
      if (safetyMargin && safetyMargin > 0) {
        doc.setFontSize(12);
        doc.setTextColor(51, 51, 51);
        doc.text(`Margen de Seguridad Aplicado: ${safetyMargin}%`, 20, currentY);
        currentY += 10;
      }

      // Filter and process tables - NO DEFAULTS when overrides exist
      let tablesToRender = tables;
      
      // Check if we have any override tables
      const hasOverrides = tables.some(table => 
        table.name.includes('Override') || 
        table.toolType === 'override'
      );
      
      console.log("Has overrides:", hasOverrides);
      
      // If we have overrides, exclude all default tables completely
      if (hasOverrides) {
        tablesToRender = tables.filter(table => 
          !table.name.includes('(Default)') && 
          !table.name.includes('Default')
        );
        console.log("Filtered tables (overrides only):", tablesToRender);
      }

      // Process each table
      tablesToRender.forEach((table, index) => {
        if (currentY > pageHeight - 80) {
          doc.addPage();
          currentY = 20;
        }

        // Clean table name - remove any (Default) or (Override) text
        let cleanTableName = table.name
          .replace(/\s*\(Default\)\s*/g, '')
          .replace(/\s*\(Override\)\s*/g, '')
          .trim();

        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);
        doc.text(cleanTableName, 20, currentY);
        currentY += 10;

        if (reportType === 'power') {
          // Power table rendering
          const tableData = [
            ['Potencia Total', `${table.totalWatts?.toFixed(2) || '0'} W`],
            ['Corriente por Fase', `${table.currentPerPhase?.toFixed(2) || '0'} A`],
            ['Tipo PDU', table.customPduType || table.pduType || 'N/A'],
          ];

          if (table.includesHoist) {
            tableData.push(['Requiere Polipasto', 'Sí (CEE32A 3P+N+G)']);
          }

          autoTable(doc, {
            startY: currentY,
            head: [['Parámetro', 'Valor']],
            body: tableData,
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
            margin: { left: 20, right: 20 },
          });

        } else if (reportType === 'weight') {
          // Weight table rendering
          if (table.rows && table.rows.length > 0) {
            const tableRows = table.rows.map(row => [
              row.quantity || '',
              row.componentName || '',
              `${row.weight || ''} kg`,
              `${row.totalWeight?.toFixed(2) || '0'} kg`
            ]);

            autoTable(doc, {
              startY: currentY,
              head: [['Cantidad', 'Componente', 'Peso (por unidad)', 'Peso Total']],
              body: tableRows,
              theme: 'grid',
              styles: {
                fontSize: 9,
                cellPadding: 4,
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
              margin: { left: 20, right: 20 },
            });

            currentY = doc.lastAutoTable?.finalY || currentY + 30;

            // Add total weight
            doc.setFontSize(11);
            doc.setTextColor(125, 1, 1);
            doc.text(`Peso Total: ${table.totalWeight?.toFixed(2) || '0'} kg`, 20, currentY + 10);
            currentY += 20;
          }
        }

        currentY = doc.lastAutoTable?.finalY || currentY + 30;
      });

      // Add summary section for weight reports
      if (reportType === 'weight' && summaryRows && summaryRows.length > 0) {
        if (currentY > pageHeight - 100) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(16);
        doc.setTextColor(125, 1, 1);
        doc.text('Resumen de Pesos por Punto de Rigging', 20, currentY);
        currentY += 15;

        const summaryTableRows = summaryRows.map(row => [
          row.clusterName,
          row.riggingPoints,
          `${row.clusterWeight.toFixed(2)} kg`
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Elemento', 'Puntos de Rigging', 'Peso Total']],
          body: summaryTableRows,
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
          margin: { left: 20, right: 20 },
        });

        currentY = doc.lastAutoTable?.finalY || currentY + 30;
      }

      // Add logo and finish PDF
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = logoUrl || '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

      logo.onload = () => {
        const logoWidth = 50;
        const logoHeight = logoWidth * (logo.height / logo.width);
        const totalPages = (doc.internal as any).pages.length - 1;

        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          const xPosition = (pageWidth - logoWidth) / 2;
          const yLogo = pageHeight - 20;
          try {
            doc.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight);
          } catch (error) {
            console.error(`Error adding logo on page ${i}:`, error);
          }
          
          // Add page numbers
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.setPage(totalPages);
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generado: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        
        const blob = doc.output('blob');
        resolve(blob);
      };

      logo.onerror = () => {
        console.error('Failed to load logo, generating PDF without logo');
        const totalPages = (doc.internal as any).pages.length - 1;
        
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
        
        doc.setPage(totalPages);
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        doc.text(`Generado: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        
        const blob = doc.output('blob');
        resolve(blob);
      };

    } catch (error) {
      console.error("Error in PDF generation:", error);
      reject(error);
    }
  });
};
