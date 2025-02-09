
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DailyUsage {
  used: number;
  remaining: number;
  date: Date;
}

interface WeeklySummaryRow {
  name: string;
  category: string;
  stock: number;
  dailyUsage: DailyUsage[];
  available: number;
}

export const exportWeeklySummaryPDF = async (
  weekStart: Date,
  rows: WeeklySummaryRow[],
  selectedCategories: string[]
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const createdDate = new Date().toLocaleDateString('es-ES');

      // Header section
      doc.setFillColor(125, 1, 1);
      doc.rect(0, 0, pageWidth, 40, 'F');

      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text("Resumen Semanal de Equipamiento", pageWidth / 2, 20, { align: 'center' });

      const dateRange = `${format(weekStart, "d 'de' MMMM", { locale: es })} - ${format(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), "d 'de' MMMM", { locale: es })}`;
      doc.setFontSize(16);
      doc.text(dateRange, pageWidth / 2, 30, { align: 'center' });

      // Categories section
      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      const categoryLabels = {
        convencional: 'Convencional',
        robotica: 'Robótica',
        fx: 'FX',
        rigging: 'Rigging'
      };
      const categoriesText = `Categorías: ${selectedCategories.map(cat => categoryLabels[cat as keyof typeof categoryLabels]).join(', ')}`;
      doc.text(categoriesText, 14, 50);

      // Table data preparation
      const tableHead = [
        ['Equipo', 'Categoría', 'Stock Total',
          ...rows[0].dailyUsage.map(d => format(d.date, 'EEE d', { locale: es })),
          'Disponible'
        ]
      ];

      const tableBody = rows.map(row => [
        row.name,
        categoryLabels[row.category as keyof typeof categoryLabels],
        row.stock.toString(),
        ...row.dailyUsage.map(usage => {
          if (usage.used === 0) return '-';
          const remainingText = usage.remaining >= 0 ? `(+${usage.remaining})` : `(${usage.remaining})`;
          return {
            content: `${usage.used} ${remainingText}`,
            styles: {
              textColor: [255, 255, 255],
              fontStyle: 'normal',
            }
          };
        }),
        {
          content: row.available.toString(),
          styles: {
            textColor: row.available < 0 ? [255, 0, 0] : [0, 0, 0],
            fontStyle: row.available < 0 ? 'bold' : 'normal'
          }
        }
      ]);

      // Generate table
      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 60,
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

      // Add logo and page numbers
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

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
            doc.setFontSize(10);
            doc.setTextColor(51, 51, 51);
            doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
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
        const blob = doc.output('blob');
        resolve(blob);
      };

    } catch (error) {
      console.error("Error in PDF generation:", error);
      reject(error);
    }
  });
};
