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
      // Show placeholder
      this.pdfDoc.setText(10, [128, 128, 128]);
      this.pdfDoc.addText("No hay datos meteorológicos disponibles", 30, yPosition);
      return yPosition + 20;
    }

    // Prepare weather data for table with all required columns
    const weatherData = eventData.weather.map(weather => [
      weather.date || '—',
      weather.condition || '—',
      weather.maxTemp ? `${weather.maxTemp}°C` : '—',
      '—', // Wind placeholder - field doesn't exist yet in interface
      weather.precipitationProbability ? `${weather.precipitationProbability}%` : '—'
    ]);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [['Fecha/Hora', 'Condición', 'Temperatura', 'Viento', 'Precipitación']],
      body: weatherData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: { 
        fillColor: [125, 1, 1], 
        textColor: [255, 255, 255], 
        fontSize: 10, 
        fontStyle: 'bold' 
      },
      columnStyles: {
        0: { cellWidth: 35 }, // Fecha/Hora
        1: { cellWidth: 35 }, // Condición
        2: { cellWidth: 25 }, // Temperatura
        3: { cellWidth: 25 }, // Viento
        4: { cellWidth: 30 }  // Precipitación
      },
      margin: { left: 20, right: 20 }
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }

  private getWeatherIcon(condition: string): string {
    // Return weather icon based on condition
    // This is a simplified mapping - in a real implementation, 
    // you might want to use actual weather icons
    switch (condition.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return '☀️';
      case 'cloudy':
      case 'overcast':
        return '☁️';
      case 'rainy':
      case 'rain':
        return '🌧️';
      case 'stormy':
      case 'thunderstorm':
        return '⛈️';
      case 'snowy':
      case 'snow':
        return '❄️';
      default:
        return '🌤️';
    }
  }
}