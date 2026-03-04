import { getWeatherForJob } from '@/utils/weather/weatherApi';
import { WeatherData } from '@/types/hoja-de-ruta';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export interface WeatherPdfData {
  jobTitle: string;
  logoUrl?: string;
  venue?: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  jobDates: Date[];
}

interface LoadedImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

const loadImageFromUrl = async (url?: string): Promise<LoadedImage | undefined> => {
  if (!url || typeof Image === 'undefined') return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const dimensions = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.width, height: image.height });
      image.onerror = () => resolve(undefined);
      image.src = dataUrl;
    });

    if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return undefined;

    return {
      dataUrl,
      format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG',
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch {
    return undefined;
  }
};

const fitDimensions = (
  image: LoadedImage,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } => {
  const ratio = image.width / image.height || 1;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  return { width, height };
};

const formatDateRangeForWeather = (jobDates: Date[]): string => {
  if (jobDates.length === 0) return '';
  const sortedDates = [...jobDates]
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sortedDates.length === 0) return '';

  const toInputDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  };

  if (sortedDates.length === 1) {
    return toInputDate(sortedDates[0]);
  }

  return `${toInputDate(sortedDates[0])} - ${toInputDate(sortedDates[sortedDates.length - 1])}`;
};

export const generateWeatherPDF = async (data: WeatherPdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const leftMargin = 10;
  const rightMargin = 10;
  const contentTop = 40;
  const footerReserve = 24;

  const festivalLogo = await loadImageFromUrl(data.logoUrl);
  const sectorLogo =
    (await loadImageFromUrl('/sector pro logo.png')) ||
    (await loadImageFromUrl('/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png'));

  const drawRunningHeader = (): void => {
    pdf.setFillColor(125, 1, 1);
    pdf.rect(0, 0, pageWidth, 30, 'F');

    if (festivalLogo) {
      const dims = fitDimensions(festivalLogo, 40, 18);
      pdf.addImage(
        festivalLogo.dataUrl,
        festivalLogo.format,
        pageWidth - dims.width - rightMargin,
        6,
        dims.width,
        dims.height,
      );
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Prevision Meteorologica', pageWidth / 2, 13, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.jobTitle, pageWidth / 2, 23, { align: 'center' });
  };

  drawRunningHeader();

  let yPosition = contentTop;
  const eventDatesString = formatDateRangeForWeather(data.jobDates);
  
  let weatherData: WeatherData[] | null = null;
  
  if (data.venue && eventDatesString) {
    try {
      weatherData = await getWeatherForJob(data.venue, eventDatesString);
    } catch (error) {
      console.error('Error fetching weather data for PDF:', error);
    }
  }
  
  if (weatherData && weatherData.length > 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(80);
    pdf.setFont('helvetica', 'normal');
    if (eventDatesString) {
      pdf.text(`Fechas del evento: ${eventDatesString}`, leftMargin, yPosition);
      yPosition += 8;
    }

    // Create weather table
    const tableData = weatherData.map(weather => {
      const date = new Date(weather.date).toLocaleDateString('es-ES', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
      
      const temp = `${Math.round(weather.maxTemp)}°C / ${Math.round(weather.minTemp)}°C`;
      const precipitation = weather.precipitationProbability > 0 
        ? `${weather.precipitationProbability}%`
        : '-';
      
      return [date, weather.condition, temp, precipitation];
    });
    
    autoTable(pdf, {
      startY: yPosition,
      head: [['Fecha', 'Condicion', 'Temperatura', 'Prob. Lluvia']],
      body: tableData,
      theme: 'grid',
      margin: { left: leftMargin, right: rightMargin, top: contentTop, bottom: footerReserve },
      rowPageBreak: 'avoid',
      styles: {
        fontSize: 10,
        cellPadding: 2.5,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 58 },
        2: { cellWidth: 35 },
        3: { cellWidth: 32 },
      },
      didDrawPage: () => {
        drawRunningHeader();
      },
    });
    
    yPosition = (pdf as any).lastAutoTable.finalY + 20;
    
    // Add weather source info
    if (yPosition > pageHeight - footerReserve - 10) {
      pdf.addPage();
      drawRunningHeader();
      yPosition = contentTop;
    }

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(80);
    pdf.text('Datos meteorologicos proporcionados por Open-Meteo (open-meteo.com)', leftMargin, yPosition);
    
  } else {
    // No weather data available
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(20);
    const unavailableLines = pdf.splitTextToSize(
      'Datos meteorologicos no disponibles para las fechas y ubicacion seleccionadas.',
      pageWidth - leftMargin - rightMargin,
    );
    pdf.text(unavailableLines, leftMargin, yPosition);
    yPosition += unavailableLines.length * 6 + 8;
    
    if (!data.venue?.address && !data.venue?.coordinates) {
      const venueLines = pdf.splitTextToSize(
        'Por favor, añada la ubicacion del recinto para habilitar la prevision meteorologica.',
        pageWidth - leftMargin - rightMargin,
      );
      pdf.text(venueLines, leftMargin, yPosition);
      yPosition += venueLines.length * 6 + 8;
    }
    
    if (data.jobDates.length === 0) {
      const dateLines = pdf.splitTextToSize(
        'Por favor, añada las fechas del evento para habilitar la prevision meteorologica.',
        pageWidth - leftMargin - rightMargin,
      );
      pdf.text(dateLines, leftMargin, yPosition);
    }
  }

  const totalPages = pdf.getNumberOfPages();
  const generatedDate = new Date().toLocaleDateString('es-ES');
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pdf.setPage(pageNumber);
    drawRunningHeader();

    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Generado: ${generatedDate}`, leftMargin, pageHeight - 8);
    pdf.text(`Pagina ${pageNumber} de ${totalPages}`, pageWidth - rightMargin, pageHeight - 8, { align: 'right' });

    if (sectorLogo) {
      const dims = fitDimensions(sectorLogo, 24, 8);
      pdf.addImage(
        sectorLogo.dataUrl,
        sectorLogo.format,
        pageWidth / 2 - dims.width / 2,
        pageHeight - 16 + (8 - dims.height) / 2,
        dims.width,
        dims.height,
      );
    }
  }

  return pdf.output('blob');
};
