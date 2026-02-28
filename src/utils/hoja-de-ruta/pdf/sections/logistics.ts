import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';
import { formatLogisticsHojaCategories } from "@/constants/logisticsHojaCategories";

export class LogisticsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addLogisticsSection(eventData: EventData, yPosition: number): number {
    const logistics = eventData.logistics;
    if (!logistics) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);

    // Transportes section with complete field set
    if (logistics.transport && logistics.transport.length > 0) {
      // Start table immediately; section header is already printed by the page header

      const transportData = logistics.transport.map(transport => [
        transport.transport_type || '',
        transport.driver_name || '',
        transport.driver_phone || '',
        transport.license_plate || '',
        Formatters.translateCompany(transport.company || ''),
        Formatters.formatDateTime(transport.date_time || ''),
        transport.has_return ? 'Sí' : 'No',
        Formatters.formatDateTime(transport.return_date_time || ''),
        transport.is_hoja_relevant === false ? 'No' : 'Sí',
        formatLogisticsHojaCategories(transport.logistics_categories)
      ]);

      this.pdfDoc.addTable({
        startY: yPosition,
        head: [["Tipo", "Conductor", "Teléfono", "Matrícula", "Empresa", "Salida", "Retorno", "Vuelta", "Hoja", "Categorías"]],
        body: transportData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: {
          fillColor: [125, 1, 1],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [250, 245, 245]
        },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto'
      });

      yPosition = this.pdfDoc.getLastAutoTableY() + 10;
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
