import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class LogisticsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addLogisticsSection(eventData: EventData, yPosition: number): number {
    const logistics = eventData.logistics;
    if (!logistics) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);

    // Transportes section with complete field set
    if (logistics.transport && logistics.transport.length > 0) {
      this.pdfDoc.setText(14, [125, 1, 1]);
      this.pdfDoc.addText("Transportes", 20, yPosition);
      yPosition += 15;

      const transportData = logistics.transport.map(transport => [
        transport.transport_type || '',
        transport.driver_name || '',
        transport.driver_phone || '',
        transport.license_plate || '',
        transport.company || '',
        transport.date_time || '',
        transport.has_return ? 'Sí' : 'No',
        transport.return_date_time || ''
      ]);

      this.pdfDoc.addTable({
        startY: yPosition,
        head: [["Tipo", "Conductor", "Teléfono", "Matrícula", "Empresa", "Salida", "Retorno", "Vuelta"]],
        body: transportData,
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 18 }, // Tipo
          1: { cellWidth: 22 }, // Conductor
          2: { cellWidth: 20 }, // Teléfono
          3: { cellWidth: 18 }, // Matrícula
          4: { cellWidth: 20 }, // Empresa
          5: { cellWidth: 25 }, // Salida
          6: { cellWidth: 15 }, // Retorno
          7: { cellWidth: 25 }  // Vuelta
        },
        margin: { left: 15, right: 15 }
      });

      yPosition = this.pdfDoc.getLastAutoTableY() + 15;
    }

    // Loading details
    if (DataValidators.hasData(logistics.loadingDetails)) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);
      
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Detalles de Carga:", 20, yPosition);
      yPosition += 15;

      this.pdfDoc.setText(10, [51, 51, 51]);
      const loadingLines = logistics.loadingDetails!.split('\n');
      for (const line of loadingLines) {
        if (line.trim()) {
          this.pdfDoc.addText(line.trim(), 30, yPosition);
          yPosition += 12;
        }
      }
      yPosition += 10;
    }

    // Unloading details
    if (DataValidators.hasData(logistics.unloadingDetails)) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);
      
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Detalles de Descarga:", 20, yPosition);
      yPosition += 15;

      this.pdfDoc.setText(10, [51, 51, 51]);
      const unloadingLines = logistics.unloadingDetails!.split('\n');
      for (const line of unloadingLines) {
        if (line.trim()) {
          this.pdfDoc.addText(line.trim(), 30, yPosition);
          yPosition += 12;
        }
      }
      yPosition += 10;
    }

    // Equipment logistics
    if (DataValidators.hasData(logistics.equipmentLogistics)) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);
      
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Logística de Equipos:", 20, yPosition);
      yPosition += 15;

      this.pdfDoc.setText(10, [51, 51, 51]);
      const equipmentLines = logistics.equipmentLogistics!.split('\n');
      for (const line of equipmentLines) {
        if (line.trim()) {
          this.pdfDoc.addText(line.trim(), 30, yPosition);
          yPosition += 12;
        }
      }
      yPosition += 10;
    }

    return yPosition;
  }
}