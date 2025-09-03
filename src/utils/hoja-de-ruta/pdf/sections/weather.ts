import { PDFDocument } from '../core/pdf-document';
import { EventData, WeatherData } from '../core/pdf-types';

export class WeatherSection {
  constructor(private pdfDoc: PDFDocument) {}

  addWeatherSection(eventData: EventData, yPosition: number): number {
    let currentY = yPosition;

    if (!eventData.weather || eventData.weather.length === 0) {
      return currentY;
    }

    currentY = this.pdfDoc.checkPageBreak(currentY, 40);

    // Add section header
    this.pdfDoc.setText(14, [0, 0, 0]);
    this.pdfDoc.addText('METEOROLOGÍA', 20, currentY);
    currentY += 15;

    // Prepare weather data for table
    const weatherData = eventData.weather.map(weather => [
      weather.date || '',
      weather.condition || '',
      weather.maxTemp ? `${weather.maxTemp}°C` : '',
      weather.precipitationProbability ? `${weather.precipitationProbability}%` : ''
    ]);

    this.pdfDoc.addTable({
      startY: currentY,
      head: [['Fecha', 'Condición', 'Temperatura', 'Precipitación']],
      body: weatherData,
      theme: 'grid',
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      margin: { left: 20, right: 20 }
    });

    currentY = this.pdfDoc.getLastAutoTableY() + 10;

    return currentY;
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