import { PDFDocument } from '../core/pdf-document';
import { EventData, WeatherData } from '../core/pdf-types';
import { createWeatherTableIconHooks } from '@/utils/pdf/weatherPdfIcons';
import { REPORT_INK } from '@/utils/pdf/report-system';
import { hojaGeometry, hojaTable } from '../hoja-report-system';

export class WeatherSection {
  constructor(private pdfDoc: PDFDocument) {}

  addWeatherSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);

    this.pdfDoc.setText(9, REPORT_INK);
    yPosition += 2;

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
    const weatherIconHooks = createWeatherTableIconHooks(this.pdfDoc.document, eventData.weather, {
      iconInsetX: 1.2,
      leftPadding: 8,
      maxIconSize: 5,
    });

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [['Fecha/Hora', 'Condición', 'Temperatura', 'Viento', 'Precipitación']],
      body: weatherData,
      ...hojaTable(hojaGeometry(this.pdfDoc.document), {
        numericColumns: [2, 3, 4],
        weights: [26, 34, 22, 18, 24],
      }),
      ...weatherIconHooks,
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}
