import { PDFDocument } from '../core/pdf-document';
import { EventData, WeatherData } from '../core/pdf-types';

export class WeatherSection {
  constructor(private pdfDoc: PDFDocument) {}

  addWeatherSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);

    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText('Meteorología', 20, yPosition);
    yPosition += 15;

    if (!eventData.weather || eventData.weather.length === 0) {
      return yPosition;
    }

    // Prepare weather data for table
    const weatherData = eventData.weather.map(weather => {
      return [
        weather.date || '—',
        weather.condition || '—',
        weather.maxTemp ? `${weather.maxTemp}°C` : '—',
        '—', // Wind placeholder - field doesn't exist yet in interface
        weather.precipitationProbability ? `${weather.precipitationProbability}%` : '—'
      ];
    });

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [['Fecha/Hora', 'Condición', 'Temperatura', 'Viento', 'Precipitación']],
      body: weatherData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 4
      },
      headStyles: { 
        fillColor: [125, 1, 1], 
        textColor: [255, 255, 255], 
        fontSize: 10, 
        fontStyle: 'bold' 
      },
      alternateRowStyles: {
        fillColor: [250, 245, 245]
      },
      margin: { left: 20, right: 20 },
      tableWidth: 'auto'
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}