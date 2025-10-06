
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { categoryLabels } from '@/types/equipment';

interface DailyUsage {
  used: number;
  remaining: number;
  date: Date;
  boost?: number;
  presets?: { name: string; qty: number }[];
  rentals?: { qty: number; notes?: string | null }[];
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
      const categoriesText = selectedCategories.length > 0
        ? `Categorías: ${selectedCategories.map(cat => categoryLabels[cat as keyof typeof categoryLabels]).join(', ')}`
        : 'Categorías: Todas';
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
          const showDash = usage.used === 0 && (!usage.boost || usage.boost === 0);
          if (showDash) return '-';
          const content = `${usage.used}${usage.boost && usage.boost > 0 ? ` (+${usage.boost})` : ''}`;
          return {
            content,
            styles: {
              fillColor: [51, 51, 51] as [number, number, number],
              textColor: [255, 255, 255] as [number, number, number],
              fontStyle: usage.remaining < 0 ? 'bold' : 'normal' as 'bold' | 'normal',
              halign: 'center' as 'center'
            }
          };
        }),
        {
          content: row.available.toString(),
          styles: {
            textColor: row.available < 0 ? [255, 0, 0] as [number, number, number] : [0, 0, 0] as [number, number, number],
            fontStyle: row.available < 0 ? 'bold' : 'normal' as 'bold' | 'normal'
          }
        }
      ]);

      // Generate main table and reserve footer margin so footer never overlaps
      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 60,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 5,
          lineColor: [220, 220, 230] as [number, number, number],
          lineWidth: 0.1,
          halign: 'left' as 'left'
        },
        margin: { top: 60, left: 14, right: 14, bottom: 42 },
        headStyles: {
          fillColor: [125, 1, 1] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontStyle: 'bold' as 'bold',
          halign: 'center' as 'center'
        },
        bodyStyles: { 
          textColor: [51, 51, 51] as [number, number, number],
        },
        alternateRowStyles: { 
          fillColor: [250, 250, 255] as [number, number, number] 
        },
      });

      // Append details section with clean tables per equipment
      const LEFT = 14;
      const TOP = 60;
      const FOOTER_RESERVE = 42; // keep clear space for footer/logo & page number
      const safeBottom = doc.internal.pageSize.getHeight() - FOOTER_RESERVE;
      let y = (doc as any).lastAutoTable?.finalY ? Math.min((doc as any).lastAutoTable.finalY + 12, safeBottom) : TOP;

      const ensureSpace = (needed: number) => {
        if (y + needed > safeBottom) {
          doc.addPage('landscape');
          y = TOP;
        }
      };

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Detalles por equipo y día', LEFT, y);
      y += 6;

      rows.forEach(row => {
        const active = row.dailyUsage.filter(d => (d.used || 0) > 0 || (d.boost || 0) > 0);
        if (active.length === 0) return;

        // Equipment title
        ensureSpace(16);
        doc.setFont(undefined, 'bold');
        doc.text(`${row.name} · ${categoryLabels[row.category as keyof typeof categoryLabels]}`, LEFT, y);
        doc.setFont(undefined, 'normal');
        y += 4;

        // Build table rows
        const detailRows = active.map(d => {
          const dateLabel = format(d.date, "EEE d 'de' MMM", { locale: es });
          const usedCol = `${d.used}${d.boost && d.boost > 0 ? ` (+${d.boost})` : ''}`;
          const rentalsCol = (d.rentals || []).map(r => `+${r.qty}${r.notes ? ` · ${r.notes}` : ''}`).join('\n') || '-';
          const presetsCol = (d.presets || []).map(p => `${p.name}: ${p.qty}`).join('\n') || '-';
          return [dateLabel, usedCol, rentalsCol, presetsCol];
        });

        // Render table
        autoTable(doc, {
          head: [['Fecha', 'Usado (+sub‑rentas)', 'Sub‑rentas', 'Presets']],
          body: detailRows,
          startY: y,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 35, halign: 'center' as any },
            2: { cellWidth: 80 },
            3: { cellWidth: 90 }
          },
          margin: { left: LEFT, right: 14, bottom: FOOTER_RESERVE },
        });
        y = ((doc as any).lastAutoTable?.finalY || y) + 8;
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

// Ensure there is room; otherwise add a new page
function checkAddPage(doc: jsPDF, currentY: number, needed: number): number {
  // legacy helper (kept for compatibility where still used)
  const FOOTER_RESERVE = 34;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + needed > pageHeight - FOOTER_RESERVE) {
    doc.addPage('landscape');
    return 60; // top margin below header
  }
  return currentY;
}
