import { getWeatherForJob } from '@/utils/weather/weatherApi';
import { WeatherData } from '@/types/hoja-de-ruta';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { createWeatherTableIconHooks } from '@/utils/pdf/weatherPdfIcons';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import {
  distributeColumnWidths,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  festivalTableTheme,
} from '@/utils/pdf/festival-report';

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

export const generateWeatherPDF = async (
  data: WeatherPdfData & { paginate?: boolean },
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  const chrome = () =>
    drawFestivalChrome(doc, {
      kind: 'weather',
      eventTitle: data.jobTitle,
      contextLabel: 'Previsión meteorológica',
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      paginate: false,
    });

  const geo = chrome();
  const { mm } = geo;
  const eventDatesString = formatDateRangeForWeather(data.jobDates);

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'Previsión meteorológica  ·  Rev. A',
    title: data.jobTitle,
    subtitle: eventDatesString || 'Fechas del evento sin definir',
    clientLogo,
  });

  let weatherData: WeatherData[] | null = null;
  if (data.venue && eventDatesString) {
    try {
      weatherData = await getWeatherForJob(data.venue, eventDatesString);
    } catch (error) {
      console.error('No se pudo obtener la previsión meteorológica:', error);
    }
  }

  if (weatherData && weatherData.length > 0) {
    const temperatures = weatherData.flatMap((weather) => [weather.maxTemp, weather.minTemp]);
    const wettest = weatherData.reduce((worst, weather) =>
      weather.precipitationProbability > worst.precipitationProbability ? weather : worst,
    );

    y = drawFestivalMetaGrid(doc, geo, [
      { label: 'Jornadas', value: String(weatherData.length) },
      { label: 'Máxima', value: `${Math.round(Math.max(...temperatures))} °C` },
      { label: 'Mínima', value: `${Math.round(Math.min(...temperatures))} °C` },
      {
        label: 'Mayor prob. lluvia',
        value: wettest.precipitationProbability > 0 ? `${wettest.precipitationProbability} %` : 'Sin lluvia',
      },
    ], y);

    y = drawFestivalSectionHeading(doc, geo, 'Previsión por jornada', y, 1);

    const rows = weatherData.map((weather) => [
      new Date(weather.date).toLocaleDateString('es-ES', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      weather.condition,
      `${Math.round(weather.maxTemp)} / ${Math.round(weather.minTemp)}`,
      weather.precipitationProbability > 0 ? String(weather.precipitationProbability) : '·',
    ]);

    const weatherIconHooks = createWeatherTableIconHooks(doc, weatherData);
    const theme = festivalTableTheme(geo, { fontSize: 7.8, numericColumns: [2, 3] });

    autoTable(doc, {
      head: [['Fecha', 'Condición', 'Máx. / mín. (°C)', 'Prob. lluvia (%)']],
      body: rows,
      startY: y,
      ...theme,
      columnStyles: distributeColumnWidths([38, 30, 22, 22], geo.contentWidth),
      margin: {
        left: geo.left,
        right: geo.pageWidth - geo.right,
        top: geo.contentTop,
        bottom: geo.pageHeight - geo.contentBottom,
      },
      rowPageBreak: 'avoid',
      didDrawPage: () => {
        chrome();
      },
      ...weatherIconHooks,
    });

    y = getLastAutoTableY(doc, y) + 4 * mm;
    // Units are stated once, under the table, rather than on every cell.
    drawFestivalConstantsLine(doc, geo, [
      { label: 'Temperaturas', value: 'grados Celsius, máxima y mínima diarias' },
      { label: 'Fuente', value: 'Open-Meteo (open-meteo.com)' },
    ], y);
  } else {
    const missing: string[] = [];
    if (!data.venue?.address && !data.venue?.coordinates) missing.push('la ubicación del recinto');
    if (data.jobDates.length === 0) missing.push('las fechas del evento');

    drawFestivalNilState(
      doc,
      geo,
      y,
      missing.length > 0
        ? `Previsión no disponible: falta ${missing.join(' y ')}. Añádelo en la ficha del trabajo y vuelve a generar el documento.`
        : 'Previsión no disponible para las fechas y la ubicación indicadas. El proveedor no devolvió datos para este rango.',
    );
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'weather',
      eventTitle: data.jobTitle,
      contextLabel: 'Previsión meteorológica',
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber: page,
      totalPages,
      paginate: data.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};
