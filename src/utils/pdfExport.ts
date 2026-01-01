import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

interface ExportTableRow {
  quantity?: string;
  componentName?: string;
  weight?: string;
  watts?: string;
  totalWeight?: number;
  totalWatts?: number;
  // rigging-specific
  x?: number; // position in meters
  reactionKg?: number;
  hoistName?: string;
}

interface ExportTable {
  name: string;
  rows: ExportTableRow[];
  totalWeight?: number;
  dualMotors?: boolean;
  totalWatts?: number;
  currentPerPhase?: number;   // line current (per-phase if 3φ, single-line if 1φ)
  toolType?: 'pesos' | 'consumos' | 'rigging';
  pduType?: string;
  customPduType?: string;
  includesHoist?: boolean;
  riggingPoint?: string;
  // rigging summary fields
  maxMomentNm?: number;
  maxDeflectionMm?: number;
  okMoment?: boolean;
  okDefl?: boolean;
  cablePick?: boolean;
}

export interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

export const exportToPDF = async (
  projectName: string,
  tables: ExportTable[],
  type: 'weight' | 'power' | 'rigging',
  jobName: string,
  jobDate: string,
  summaryRows?: SummaryRow[],
  powerSummary?: { totalSystemWatts: number; totalSystemAmps: number },
  safetyMargin?: number,
  customLogoUrl?: string,
  fohSchukoRequired?: boolean
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  return new Promise<Blob>((resolve) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const createdDate = new Date().toLocaleDateString('en-GB');
    const footerSpace = 40;

    // Normalize job date
    let jobDateStr: string;
    try {
      const date = new Date(jobDate);
      if (isNaN(date.getTime())) {
        const fallbackDate = jobDate.includes('-') ? new Date(jobDate + 'T00:00:00') : new Date();
        jobDateStr = fallbackDate.toLocaleDateString('en-GB');
      } else {
        jobDateStr = date.toLocaleDateString('en-GB');
      }
    } catch {
      jobDateStr = new Date().toLocaleDateString('en-GB');
    }

    // Header
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 40, 'F');

    const titleText = type === 'weight'
      ? "Informe de Distribución de Peso"
      : type === 'power'
        ? "Informe de Distribución de Potencia"
        : "Informe de Rigging";

    const loadHeaderContent = (customLogo?: HTMLImageElement) => {
      if (customLogo) {
        const logoHeight = 7.5;
        const logoWidth = logoHeight * (customLogo.width / customLogo.height);
        try { doc.addImage(customLogo, 'PNG', 10, 5, logoWidth, logoHeight); } catch {}
      }

      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text(titleText, pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

      if (safetyMargin !== undefined && type === 'power') {
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

      tables.forEach((table, index) => {
        if (table.toolType === 'rigging') {
          // (unchanged rigging rendering)
          doc.setFillColor(245, 245, 250);
          doc.rect(14, yPosition - 6, pageWidth - 28, 10, 'F');
          doc.setFontSize(14);
          doc.setTextColor(125, 1, 1);
          doc.text(`Truss: ${table.name}`, 14, yPosition);
          yPosition += 10;

          const fixtureRows = table.rows
            .filter(r => r.componentName && (r.weight !== undefined || r.x !== undefined))
            .map(r => [r.quantity ?? '', r.componentName ?? '', r.weight ?? '', r.x !== undefined ? `${Number(r.x).toFixed(2)} m` : '']);

          if (fixtureRows.length > 0) {
            autoTable(doc, {
              head: [['Cantidad', 'Componente', 'Peso (kg)', 'Posición (m)']],
              body: fixtureRows,
              startY: yPosition, theme: 'grid',
              styles: { fontSize: 10, cellPadding: 5 },
              headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255] }
            });
            yPosition = (doc as any).lastAutoTable.finalY + 10;
          }

          const supportRows = table.rows
            .filter(r => r.reactionKg !== undefined)
            .map(r => [r.componentName ?? '', r.reactionKg !== undefined ? Number(r.reactionKg).toFixed(0) : '', r.hoistName ?? '']);

          if (supportRows.length > 0) {
            autoTable(doc, {
              head: [['Punto de Montaje', 'Reacción (kg)', 'Motor Sugerido']],
              body: supportRows,
              startY: yPosition, theme: 'grid',
              styles: { fontSize: 10, cellPadding: 5 },
              headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255] }
            });
            yPosition = (doc as any).lastAutoTable.finalY + 10;
          }

          if (table.maxMomentNm !== undefined || table.maxDeflectionMm !== undefined) {
            const need = 30; checkPageBreak(need);
            doc.setFontSize(11); doc.setTextColor(0, 0, 0);
            if (table.maxMomentNm !== undefined) {
              doc.text(`Momento Máximo: ${Number(table.maxMomentNm).toFixed(0)} N·m (${table.okMoment ? 'OK' : 'FALLA'})`, 14, yPosition);
              yPosition += 6;
            }
            if (table.maxDeflectionMm !== undefined) {
              doc.text(`Deflexión Máxima: ${Number(table.maxDeflectionMm).toFixed(1)} mm (${table.okDefl ? 'OK' : 'FALLA'})`, 14, yPosition);
              yPosition += 10;
            }
          }

          if (table.cablePick) {
            checkPageBreak(10);
            doc.setFontSize(10); doc.setTextColor(80, 80, 80);
            doc.text('*Incluye cable pick.', 14, yPosition);
            yPosition += 10;
          }

          if (yPosition > pageHeight - 40 && index < tables.length - 1) {
            doc.addPage(); yPosition = 20;
          }
          return;
        }

        const rowCount = table.rows.length + (type === 'weight' && table.totalWeight !== undefined ? 1 : 0);
        const approxTableHeight = rowCount * 15 + 20;
        checkPageBreak(approxTableHeight + 40);

        doc.setFillColor(245, 245, 250);
        doc.rect(14, yPosition - 6, pageWidth - 28, 10, 'F');

        doc.setFontSize(14);
        doc.setTextColor(125, 1, 1);

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
          styles: { fontSize: 10, cellPadding: 5, lineColor: [220, 220, 230], lineWidth: 0.1 },
          headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255], fontStyle: 'bold' },
          bodyStyles: { textColor: [51, 51, 51] },
          alternateRowStyles: { fillColor: [250, 250, 255] },
          didDrawPage: (data) => { yPosition = data.cursor.y + 10; }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        if (type === 'power') {
          if (table.totalWatts !== undefined) {
            checkPageBreak(42);
            doc.setFillColor(245, 245, 250);
            doc.rect(14, yPosition - 6, pageWidth - 28, 28, 'F');

            doc.setFontSize(11);
            doc.setTextColor(125, 1, 1);
            doc.text(`Potencia Total (sin margen): ${table.totalWatts.toFixed(2)} W`, 14, yPosition);
            yPosition += 7;

            if (safetyMargin !== undefined) {
              const adjusted = (table.totalWatts || 0) * (1 + (safetyMargin || 0) / 100);
              doc.text(`Potencia Ajustada (con ${safetyMargin}%): ${adjusted.toFixed(2)} W`, 14, yPosition);
              yPosition += 7;
            }

            if (table.currentPerPhase !== undefined) {
              doc.text(`Corriente${/* label agnostic to phase */''}: ${table.currentPerPhase.toFixed(2)} A`, 14, yPosition);
              yPosition += 10;
            }
          }

          if (table.includesHoist) {
            checkPageBreak(20);
            doc.setFontSize(10); doc.setTextColor(51, 51, 51); doc.setFont(undefined, 'italic');
            doc.text(`Potencia adicional para motores requerida para ${table.name}: CEE32A 3P+N+G`, 14, yPosition);
            yPosition += 10; doc.setFont(undefined, 'normal');
          }
        }

        if (yPosition > pageHeight - 40 && index < tables.length - 1) {
          doc.addPage(); yPosition = 20;
        }
      });

      // (FOH schuko note intentionally only on summary page)

      // Summary data
      let generatedSummaryRows: SummaryRow[] = [];
      let generatedPowerSummary: { totalSystemWatts: number; totalSystemAmps: number } | undefined;

      if (type === 'weight') {
        generatedSummaryRows = tables.map((table) => ({
          clusterName: table.name,
          riggingPoints: table.riggingPoint || 'N/A',
          clusterWeight: table.totalWeight || 0
        }));
      }

      let riggingSummaryRows: SummaryRow[] = [];
      const riggingTables = tables.filter(t => t.toolType === 'rigging');
      if (riggingTables.length > 0) {
        riggingSummaryRows = riggingTables.map((t) => ({
          clusterName: t.name,
          riggingPoints: String(t.rows.filter(r => r.reactionKg !== undefined).length),
          clusterWeight: t.totalWeight || 0
        }));
      }

      if (type === 'power') {
        const totalSystemWatts = tables.reduce((sum, table) => sum + (table.totalWatts || 0), 0);
        const totalSystemAmps = tables.reduce((sum, table) => sum + (table.currentPerPhase || 0), 0);
        generatedPowerSummary = { totalSystemWatts, totalSystemAmps };
      }

      const finalSummaryRows = summaryRows && summaryRows.length > 0 ? summaryRows : (riggingSummaryRows.length > 0 ? riggingSummaryRows : generatedSummaryRows);
      const finalPowerSummary = powerSummary || generatedPowerSummary;

      const shouldGenerateSummary = 
        (type === 'weight' && finalSummaryRows.length > 0) ||
        (type === 'power' && tables.length > 0 && tables[0]?.toolType === 'consumos') ||
        (type === 'rigging' && riggingSummaryRows.length > 0) ||
        (riggingSummaryRows.length > 0);

      if (shouldGenerateSummary) {
        doc.addPage();

        doc.setFillColor(125, 1, 1);
        doc.rect(0, 0, pageWidth, 40, 'F');

        if (headerLogo) {
          const logoHeight = 7.5;
          const logoWidth = logoHeight * (headerLogo.width / headerLogo.height);
          try { doc.addImage(headerLogo, 'PNG', 10, 5, logoWidth, logoHeight); } catch {}
        }

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text(titleText, pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(16);
        doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

        if (safetyMargin !== undefined && type === 'power') {
          doc.setFontSize(10); doc.setTextColor(51, 51, 51);
          doc.text(`Margen de Seguridad Aplicado: ${safetyMargin}%`, 14, 50);
        }
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('en-GB')}`, 14, 60);

        // Reuse the outer yPosition to keep page-break checks in sync
        yPosition = 70;

        if (type === 'power' && tables[0]?.toolType === 'consumos') {
          doc.setFontSize(16);
          doc.setTextColor(125, 1, 1);
          doc.text("Resumen", 14, yPosition);
          yPosition += 10;

          // FOH Schuko global note also on summary page
          if (fohSchukoRequired) {
            checkPageBreak(12);
            doc.setFontSize(10); doc.setTextColor(80, 80, 80); doc.setFont(undefined, 'italic');
            doc.text('Se requiere potencia de 16A en formato schuko hembra en posicion FoH', 14, yPosition);
            yPosition += 10; doc.setFont(undefined, 'normal');
          }

          tables.forEach((table) => {
            checkPageBreak(30);
            doc.setFontSize(12); doc.setTextColor(0, 0, 0);
            const pduText = table.customPduType ? table.customPduType : table.pduType;
            doc.text(`${table.name} - PDU: ${pduText || 'N/A'}`, 14, yPosition);
            yPosition += 7;

            const adjusted = safetyMargin !== undefined ? (table.totalWatts || 0) * (1 + (safetyMargin || 0) / 100) : (table.totalWatts || 0);
            doc.setFontSize(10); doc.setTextColor(60, 60, 60);
            doc.text(`Potencia (ajustada): ${adjusted.toFixed(2)} W — Corriente: ${(table.currentPerPhase || 0).toFixed(2)} A`, 14, yPosition);
            yPosition += 7;

            if (table.includesHoist) {
              doc.setTextColor(80, 80, 80);
              doc.text(`*Potencia adicional para polipast requerida para ${table.name}: CEE32A 3P+N+G`, 14, yPosition);
              yPosition += 7;
            }
            yPosition += 3;
          });

          if (finalPowerSummary) {
            checkPageBreak(30);
            doc.setFontSize(14); doc.setTextColor(125, 1, 1);
            doc.text("Resumen de Potencia Total", 14, yPosition);
            yPosition += 10;
            doc.setFontSize(12); doc.setTextColor(0, 0, 0);
            doc.text(`Potencia Total del Sistema (sin margen): ${finalPowerSummary.totalSystemWatts.toFixed(2)} W`, 14, yPosition);
            yPosition += 7;
            if (safetyMargin !== undefined) {
              const adjustedSystem = finalPowerSummary.totalSystemWatts * (1 + (safetyMargin || 0) / 100);
              doc.text(`Potencia Total del Sistema (ajustada): ${adjustedSystem.toFixed(2)} W`, 14, yPosition);
              yPosition += 7;
            }
            doc.text(`Corriente Total del Sistema: ${finalPowerSummary.totalSystemAmps.toFixed(2)} A`, 14, yPosition);
            yPosition += 7;
          }
        } else if ((type === 'weight' || type === 'rigging') && finalSummaryRows.length > 0) {
          doc.setFontSize(16); doc.setTextColor(125, 1, 1);
          doc.text(riggingSummaryRows.length > 0 ? "Resumen de Rigging" : "Resumen", 14, yPosition);
          yPosition += 6;

          const summaryData = finalSummaryRows.map((row) => [row.clusterName, row.riggingPoints, row.clusterWeight.toFixed(2)]);

          autoTable(doc, {
            head: [['Truss', 'Puntos de Montaje', 'Peso Total (kg)']],
            body: summaryData,
            startY: yPosition,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5, lineColor: [220, 220, 230], lineWidth: 0.1 },
            headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [51, 51, 51] },
            alternateRowStyles: { fillColor: [250, 250, 255] },
            didDrawPage: (data) => { yPosition = data.cursor.y + 10; }
          });
        }
      }

      // Footer logo & created date
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
          try { doc.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight); } catch {}
        }
        doc.setPage(totalPages);
        doc.setFontSize(10); doc.setTextColor(51, 51, 51);
        doc.text(`Creado: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        const blob = doc.output('blob'); resolve(blob);
      };

      logo.onerror = () => {
        const totalPages = doc.internal.pages.length - 1;
        doc.setPage(totalPages);
        doc.setFontSize(10); doc.setTextColor(51, 51, 51);
        doc.text(`Creado: ${createdDate}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        const blob = doc.output('blob'); resolve(blob);
      };
    };

    // Header logo (optional)
    let headerLogo: HTMLImageElement | undefined;
    if (customLogoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = customLogoUrl;
      img.onload = () => { headerLogo = img; loadHeaderContent(img); };
      img.onerror = () => { loadHeaderContent(); };
    } else {
      loadHeaderContent();
    }
  });
};
