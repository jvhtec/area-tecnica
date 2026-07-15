import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getResolvedPowerPosition } from '@/utils/powerPositions';
import { buildPowerStagePlot } from '@/utils/powerStagePlot';
import { drawPowerStagePlot } from '@/utils/pdf/powerStagePlotPdf';
import {
  registerPdfUnicodeFont,
} from '@/utils/pdf/pdfUnicodeFont';
import { aggregatePowerCalculations } from '@/features/technical-tools/power/powerAggregation';
import {
  getPowerPduAmpRating,
  POWER_PDU_PLANNING_LOAD_FACTOR,
} from '@/features/technical-tools/power/powerCalculations';
import type {
  PowerCalculationSnapshot,
} from '@/features/technical-tools/power/types';

interface ExportTableRow {
  quantity?: string;
  lineName?: string;
  componentName?: string;
  weight?: string;
  watts?: string;
  totalWeight?: number;
  totalWatts?: number;
  pf?: string;
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
  adjustedWatts?: number;
  totalVa?: number;            // apparent power (VA)
  currentPerPhase?: number;   // line current (per-phase if 3φ, single-line if 1φ)
  phaseMode?: 'single' | 'three';
  calculation?: PowerCalculationSnapshot;
  toolType?: 'pesos' | 'consumos' | 'rigging';
  pduType?: string;
  customPduType?: string;
  position?: string;
  customPosition?: string;
  includesHoist?: boolean;
  riggingPoint?: string;
  // rigging summary fields
  maxMomentNm?: number;
  maxDeflectionMm?: number;
  okMoment?: boolean;
  okDefl?: boolean;
  cablePick?: boolean;
}

export interface PowerPdfSummary {
  totalSystemWatts: number;
  adjustedSystemWatts?: number;
  totalSystemAmps: number | null;
  totalSystemKva?: number | null;
  aggregationReason?: string;
}

export interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

const getMotorCountLabel = (table: ExportTable) => {
  if (table.riggingPoint) {
    const motorCount = table.riggingPoint.split(',').filter((point) => point.trim().length > 0).length;
    if (motorCount > 0) return String(motorCount);
  }

  if (table.dualMotors) return '2';
  return table.totalWeight && table.totalWeight > 0 ? '1' : 'N/A';
};

export const exportToPDF = async (
  projectName: string,
  tables: ExportTable[],
  type: 'weight' | 'power' | 'rigging',
  jobName: string,
  jobDate: string,
  summaryRows?: SummaryRow[],
  powerSummary?: PowerPdfSummary,
  safetyMargin?: number,
  customLogoUrl?: string,
  fohSchukoRequired?: boolean
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF();
  const unicodeFontFamily =
    type === 'power' ? await registerPdfUnicodeFont(doc) : null;
  const reportFontFamily = unicodeFontFamily ?? 'helvetica';
  return new Promise<Blob>((resolve) => {
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
        try { doc.addImage(customLogo, 'PNG', 10, 5, logoWidth, logoHeight); } catch { /* logo is optional; render without it */ }
      }

      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text(titleText, pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

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
            const checkLabel = (value: unknown) =>
              value === true ? 'OK' : value === false ? 'FALLA' : 'No validado';
            if (table.maxMomentNm !== undefined) {
              doc.text(`Momento Máximo: ${Number(table.maxMomentNm).toFixed(0)} N·m (${checkLabel(table.okMoment)})`, 14, yPosition);
              yPosition += 6;
            }
            if (table.maxDeflectionMm !== undefined) {
              doc.text(`Deflexión Máxima: ${Number(table.maxDeflectionMm).toFixed(1)} mm (${checkLabel(table.okDefl)})`, 14, yPosition);
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

        const hasLineNames = type === 'power' && table.rows.some((row) => row.lineName?.trim());
        const hasRowPowerFactors =
          type === 'power' && table.rows.some((row) => row.pf?.trim());
        const tableRows = table.rows.map((row) => {
          const baseCells = [
            row.quantity,
            row.componentName || '',
            type === 'weight' ? row.weight || '' : row.watts || '',
            type === 'weight'
              ? row.totalWeight !== undefined ? row.totalWeight.toFixed(2) : ''
              : row.totalWatts !== undefined ? row.totalWatts.toFixed(2) : '',
          ];

          if (!hasLineNames) {
            return hasRowPowerFactors
              ? [baseCells[0], baseCells[1], baseCells[2], row.pf || '', baseCells[3]]
              : baseCells;
          }

          const namedCells = [
            row.quantity,
            row.lineName || '',
            row.componentName || '',
            row.watts || '',
          ];
          if (hasRowPowerFactors) namedCells.push(row.pf || '');
          namedCells.push(row.totalWatts !== undefined ? row.totalWatts.toFixed(2) : '');
          return namedCells;
        });

        if (type === 'weight' && table.totalWeight !== undefined) {
          tableRows.push(['', 'Peso Total', '', table.totalWeight.toFixed(2)]);
        }

        const headers =
          type === 'weight'
            ? [['Cantidad', 'Componente', 'Peso (por unidad)', 'Peso Total']]
            : hasLineNames
              ? [hasRowPowerFactors
                  ? ['Cantidad', 'Nombre', 'Componente', 'Vatios (por unidad)', 'PF', 'Vatios Totales']
                  : ['Cantidad', 'Nombre', 'Componente', 'Vatios (por unidad)', 'Vatios Totales']]
            : [hasRowPowerFactors
                ? ['Cantidad', 'Componente', 'Vatios (por unidad)', 'PF', 'Vatios Totales']
                : ['Cantidad', 'Componente', 'Vatios (por unidad)', 'Vatios Totales']];

        autoTable(doc, {
          head: headers,
          body: tableRows,
          startY: yPosition,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 5, lineColor: [220, 220, 230], lineWidth: 0.1 },
          headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255] },
          bodyStyles: { textColor: [51, 51, 51] },
          alternateRowStyles: { fillColor: [250, 250, 255] },
          didDrawPage: (data) => { yPosition = data.cursor.y + 10; }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        if (type === 'power') {
          const positionLabel = getResolvedPowerPosition(table.position, table.customPosition);
          if (table.totalWatts !== undefined) {
            const calculation = table.calculation;
            const effectiveMargin = calculation?.safetyMargin ?? safetyMargin;
            const adjustedWatts =
              calculation?.adjustedWatts ??
              table.adjustedWatts ??
              table.totalWatts * (1 + (effectiveMargin ?? 0) / 100);
            const phaseMode = calculation?.phaseMode ?? table.phaseMode;
            const totalVa = calculation?.totalVa ?? table.totalVa;
            const currentLine = calculation?.currentLine ?? table.currentPerPhase;
            const selectedPdu = table.customPduType || table.pduType;
            const pduAmps = getPowerPduAmpRating(selectedPdu || '');
            const pduLimit = pduAmps === undefined
              ? undefined
              : pduAmps * POWER_PDU_PLANNING_LOAD_FACTOR;
            const apparent = totalVa === undefined ? 'N/D' : `${(totalVa / 1000).toFixed(2)} kVA`;
            const current = currentLine === undefined ? 'N/D' : `${currentLine.toFixed(2)} A`;
            const phaseLabel = phaseMode === 'three'
              ? unicodeFontFamily ? '3φ equilibrada' : 'trifásica equilibrada'
              : phaseMode === 'single'
                ? unicodeFontFamily ? '1φ' : 'monofásica'
                : 'suministro no identificado';
            const pduStatus = pduLimit === undefined
              ? 'NO VERIFICABLE'
              : currentLine === undefined
                ? 'SIN ESTADO'
                : currentLine <= pduLimit ? 'OK' : 'SOBRE LIMITE';
            const detailLines = [
              `Potencia: ${table.totalWatts.toFixed(2)} W; ajustada (${effectiveMargin ?? 0}%): ${adjustedWatts.toFixed(2)} W`,
              `Aparente: ${apparent}; corriente de línea: ${current}`,
              calculation
                ? `Suministro: ${phaseLabel} ${calculation.voltage} V${calculation.phaseMode === 'three' ? ' LL' : ''}; PF ${calculation.powerFactorSource === 'per-row' ? unicodeFontFamily ? 'ΣP/ΣQ' : 'vectorial' : (calculation.powerFactor?.toFixed(2) ?? 'N/D')}; v${calculation.version}${calculation.isEstimate ? ' estimado' : ''}`
                : 'Cálculo heredado sin snapshot reproducible',
              `PDU: ${selectedPdu || 'sin recomendación'}; ${pduLimit === undefined ? 'sin límite verificable' : `límite 80% ${pduLimit.toFixed(1)} A`}; ${pduStatus}`,
            ];
            if (positionLabel) detailLines.push(`Posición: ${positionLabel}`);
            const detailHeight = detailLines.length * 7 + 3;
            checkPageBreak(detailHeight + 10);
            doc.setFillColor(245, 245, 250);
            doc.rect(14, yPosition - 6, pageWidth - 28, detailHeight, 'F');

            doc.setFontSize(9);
            doc.setTextColor(125, 1, 1);
            doc.setFont(reportFontFamily, 'normal');
            detailLines.forEach((line) => {
              if (line.includes('SOBRE LIMITE') || line.includes('NO VERIFICABLE')) doc.setTextColor(180, 30, 30);
              else doc.setTextColor(125, 1, 1);
              doc.text(line, 14, yPosition);
              yPosition += 7;
            });
            doc.setFont('helvetica', 'normal');
            yPosition += 3;
          }

          if (table.includesHoist) {
            checkPageBreak(20);
            doc.setFontSize(10); doc.setTextColor(51, 51, 51); doc.setFont('helvetica', 'italic');
            doc.text(`Suministro auxiliar de motores para ${table.name}: CEE32A 3P+N+G (excluido de los totales)`, 14, yPosition);
            yPosition += 10; doc.setFont('helvetica', 'normal');
          }
        }

        if (yPosition > pageHeight - 40 && index < tables.length - 1) {
          doc.addPage(); yPosition = 20;
        }
      });

      // (FOH schuko note intentionally only on summary page)

      // Summary data
      let generatedSummaryRows: SummaryRow[] = [];
      let generatedPowerSummary: PowerPdfSummary | undefined;

      if (type === 'weight') {
        generatedSummaryRows = tables.map((table) => ({
          clusterName: table.name,
          riggingPoints: getMotorCountLabel(table),
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
        const aggregation = aggregatePowerCalculations(tables);
        generatedPowerSummary = {
          totalSystemWatts: aggregation.totalWatts,
          adjustedSystemWatts: aggregation.adjustedWatts,
          totalSystemAmps: aggregation.currentLine,
          totalSystemKva:
            aggregation.totalVa === null ? null : aggregation.totalVa / 1000,
          aggregationReason: aggregation.reason,
        };
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
          try { doc.addImage(headerLogo, 'PNG', 10, 5, logoWidth, logoHeight); } catch { /* logo is optional; render without it */ }
        }

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text(titleText, pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(16);
        doc.text(jobName || 'Trabajo sin título', pageWidth / 2, 30, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Fecha del Trabajo: ${jobDateStr}`, pageWidth / 2, 38, { align: 'center' });

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
            doc.setFontSize(10); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'italic');
            doc.text('Suministro auxiliar FoH: 16A en formato schuko hembra (excluido de los totales)', 14, yPosition);
            yPosition += 10; doc.setFont('helvetica', 'normal');
          }

          if (finalPowerSummary) {
            checkPageBreak(37);
            doc.setFontSize(14); doc.setTextColor(125, 1, 1);
            doc.text("Resumen de Potencia Total", 14, yPosition);
            yPosition += 10;
            doc.setFontSize(12); doc.setTextColor(0, 0, 0);
            const totals = [
              `Potencia Total del Sistema (sin margen): ${finalPowerSummary.totalSystemWatts.toFixed(2)} W`,
              finalPowerSummary.adjustedSystemWatts === undefined ? null : `Potencia Total del Sistema (ajustada por tabla): ${finalPowerSummary.adjustedSystemWatts.toFixed(2)} W`,
              finalPowerSummary.totalSystemKva == null ? null : `Potencia Aparente Total del Sistema: ${finalPowerSummary.totalSystemKva.toFixed(2)} kVA`,
              finalPowerSummary.totalSystemAmps === null ? 'Corriente y kVA del sistema: no agregables con los datos disponibles.' : `Corriente de Línea Resultante: ${finalPowerSummary.totalSystemAmps.toFixed(2)} A`,
            ].filter((line): line is string => line !== null);
            totals.forEach((line) => { doc.text(line, 14, yPosition); yPosition += 7; });
            if (finalPowerSummary.totalSystemAmps === null && finalPowerSummary.aggregationReason) {
              doc.setFontSize(9); doc.setTextColor(80, 80, 80);
              doc.text(finalPowerSummary.aggregationReason, 14, yPosition);
              yPosition += 7;
            }
          }

          // Stage plot with PDU positions (theater conventions, audience at bottom)
          const stagePlot = buildPowerStagePlot(tables);
          if (stagePlot.hasPositionedEntries) {
            yPosition = drawPowerStagePlot(doc, stagePlot, {
              startY: yPosition + 6,
              pageWidth,
              pageHeight,
              footerSpace,
              fohSchukoRequired,
            });
          }
        } else if ((type === 'weight' || type === 'rigging') && finalSummaryRows.length > 0) {
          doc.setFontSize(16); doc.setTextColor(125, 1, 1);
          doc.text(riggingSummaryRows.length > 0 ? "Resumen de Rigging" : "Resumen", 14, yPosition);
          yPosition += 6;

          const summaryData = finalSummaryRows.map((row) => [row.clusterName, row.riggingPoints, row.clusterWeight.toFixed(2)]);

          autoTable(doc, {
            head: [['Truss', 'Motores', 'Peso Total (kg)']],
            body: summaryData,
            startY: yPosition,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5, lineColor: [220, 220, 230], lineWidth: 0.1 },
            headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255] },
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
          try { doc.addImage(logo, 'PNG', xPosition, yLogo - logoHeight, logoWidth, logoHeight); } catch { /* logo is optional; render without it */ }
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
