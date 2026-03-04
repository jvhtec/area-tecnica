import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { AUXILIARY_MACHINERY_LABELS } from '@/constants/hojaDeRutaAuxiliaryNeeds';

export class AuxNeedsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addAuxNeedsSection(eventData: EventData, yPosition: number): number {
    const tableRows: string[][] = [];
    const setupQty = this.toSafeNonNegativeInt(eventData.auxiliaryStaffSetupQty);
    const dismantleQty = this.toSafeNonNegativeInt(eventData.auxiliaryStaffDismantleQty);

    if (setupQty > 0) {
      tableRows.push(["Personal de Carga y Descarga - montaje", String(setupQty)]);
    }

    if (dismantleQty > 0) {
      tableRows.push(["Personal de Carga y Descarga - desmontaje", String(dismantleQty)]);
    }

    for (const machinery of eventData.auxiliaryMachinery || []) {
      const quantity = this.toSafeNonNegativeInt(machinery.quantity);
      if (quantity <= 0) continue;

      const machineryLabel = AUXILIARY_MACHINERY_LABELS[machinery.machineType];
      if (!machineryLabel) continue;

      tableRows.push([`Maquinaria - ${machineryLabel}`, String(quantity)]);
    }

    if (tableRows.length > 0) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, Math.max(40, 12 + tableRows.length * 8));
      this.pdfDoc.addTable({
        startY: yPosition,
        head: [["Concepto", "Cantidad"]],
        body: tableRows,
        theme: "grid",
        margin: { left: 30, right: 20 },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          textColor: [51, 51, 51],
        },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          1: { halign: "right", cellWidth: 25 },
        },
      });

      yPosition = this.pdfDoc.getLastAutoTableY() + 6;
    }

    if (!DataValidators.hasData(eventData.auxiliaryNeeds)) {
      return yPosition;
    }

    const lineHeight = 6;
    const auxLines = eventData.auxiliaryNeeds!
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (auxLines.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition, 14);
    this.pdfDoc.setText(10, [51, 51, 51]);
    this.pdfDoc.addText("Notas:", 30, yPosition);
    yPosition += lineHeight;

    for (const line of auxLines) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, lineHeight + 2);
      this.pdfDoc.addText(line, 30, yPosition);
      yPosition += lineHeight;
    }

    return yPosition + 4;
  }

  private toSafeNonNegativeInt(value: unknown): number {
    const parsed = Number.parseInt(String(value ?? 0), 10);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return parsed;
  }
}
