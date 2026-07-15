import type { jsPDF } from 'jspdf';
import type { MarginPaddingInput, UserOptions } from 'jspdf-autotable';

export type WeatherPdfIconKind =
  | 'sun'
  | 'partly-cloudy'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export interface WeatherPdfIconData {
  weatherCode?: number | null;
  condition?: string | null;
  icon?: string | null;
}

type WeatherTableIconHooks = Pick<UserOptions, 'didParseCell' | 'didDrawCell'>;

interface WeatherTableIconOptions {
  conditionColumnIndex?: number;
  iconInsetX?: number;
  leftPadding?: number;
  maxIconSize?: number;
}

const normalizeWeatherLabel = (value?: string | null): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const resolveWeatherPdfIconKind = ({
  weatherCode,
  condition,
  icon,
}: WeatherPdfIconData): WeatherPdfIconKind => {
  if (typeof weatherCode === 'number' && Number.isFinite(weatherCode)) {
    if (weatherCode === 0) return 'sun';
    if (weatherCode === 1 || weatherCode === 2) return 'partly-cloudy';
    if (weatherCode === 3) return 'cloud';
    if (weatherCode === 45 || weatherCode === 48) return 'fog';
    if (weatherCode >= 51 && weatherCode <= 57) return 'drizzle';
    if ((weatherCode >= 61 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return 'rain';
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) return 'snow';
    if (weatherCode >= 95) return 'storm';
  }

  const label = normalizeWeatherLabel(`${condition ?? ''} ${icon ?? ''}`);
  if (/tormenta|granizo|⛈/.test(label)) return 'storm';
  if (/nieve|nevada|❄|🌨/.test(label)) return 'snow';
  if (/niebla|bruma|🌫/.test(label)) return 'fog';
  if (/llovizna|🌦/.test(label)) return 'drizzle';
  if (/lluvia|chubasco|🌧/.test(label)) return 'rain';
  if (/parcial|mayormente despejado|intervalos|⛅|🌤/.test(label)) return 'partly-cloudy';
  if (/nublado|cubierto|☁/.test(label)) return 'cloud';
  if (/despejado|soleado|☀/.test(label)) return 'sun';
  return 'partly-cloudy';
};

const drawSun = (doc: jsPDF, x: number, y: number, size: number): void => {
  const centerX = x + size * 0.5;
  const centerY = y + size * 0.5;
  const radius = size * 0.19;

  doc.setDrawColor(184, 120, 0);
  doc.setFillColor(250, 204, 21);
  doc.setLineWidth(Math.max(0.2, size * 0.035));
  doc.circle(centerX, centerY, radius, 'FD');

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * index) / 4;
    const innerRadius = size * 0.31;
    const outerRadius = size * 0.44;
    doc.line(
      centerX + Math.cos(angle) * innerRadius,
      centerY + Math.sin(angle) * innerRadius,
      centerX + Math.cos(angle) * outerRadius,
      centerY + Math.sin(angle) * outerRadius,
    );
  }
};

const drawCloud = (doc: jsPDF, x: number, y: number, size: number): void => {
  const cloudFill: [number, number, number] = [226, 232, 240];
  doc.setFillColor(...cloudFill);
  doc.setDrawColor(...cloudFill);
  doc.setLineWidth(Math.max(0.18, size * 0.025));
  doc.circle(x + size * 0.37, y + size * 0.54, size * 0.2, 'FD');
  doc.circle(x + size * 0.56, y + size * 0.43, size * 0.25, 'FD');
  doc.circle(x + size * 0.75, y + size * 0.56, size * 0.16, 'FD');
  doc.roundedRect(
    x + size * 0.22,
    y + size * 0.52,
    size * 0.63,
    size * 0.25,
    size * 0.06,
    size * 0.06,
    'FD',
  );
  doc.setDrawColor(71, 85, 105);
  doc.line(x + size * 0.24, y + size * 0.77, x + size * 0.82, y + size * 0.77);
};

const drawPartlyCloudy = (doc: jsPDF, x: number, y: number, size: number): void => {
  drawSun(doc, x, y, size * 0.68);
  drawCloud(doc, x + size * 0.12, y + size * 0.12, size * 0.88);
};

const drawFog = (doc: jsPDF, x: number, y: number, size: number): void => {
  drawCloud(doc, x + size * 0.06, y, size * 0.83);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(Math.max(0.22, size * 0.035));
  doc.setLineCap('round');
  doc.line(x + size * 0.12, y + size * 0.76, x + size * 0.82, y + size * 0.76);
  doc.line(x + size * 0.22, y + size * 0.88, x + size * 0.9, y + size * 0.88);
  doc.line(x + size * 0.1, y + size, x + size * 0.68, y + size);
};

const drawDrizzle = (doc: jsPDF, x: number, y: number, size: number): void => {
  drawCloud(doc, x + size * 0.05, y, size * 0.86);
  doc.setDrawColor(14, 116, 144);
  doc.setFillColor(56, 189, 248);
  for (const offset of [0.3, 0.52, 0.74]) {
    doc.circle(x + size * offset, y + size * 0.9, Math.max(0.18, size * 0.035), 'FD');
  }
};

const drawRain = (doc: jsPDF, x: number, y: number, size: number): void => {
  drawCloud(doc, x + size * 0.05, y, size * 0.86);
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(Math.max(0.25, size * 0.045));
  doc.setLineCap('round');
  for (const offset of [0.3, 0.52, 0.74]) {
    doc.line(
      x + size * offset,
      y + size * 0.81,
      x + size * (offset - 0.06),
      y + size,
    );
  }
};

const drawSnowflake = (doc: jsPDF, centerX: number, centerY: number, radius: number): void => {
  for (let index = 0; index < 3; index += 1) {
    const angle = (Math.PI * index) / 3;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    doc.line(centerX - dx, centerY - dy, centerX + dx, centerY + dy);
  }
};

const drawSnow = (doc: jsPDF, x: number, y: number, size: number): void => {
  drawCloud(doc, x + size * 0.05, y, size * 0.86);
  doc.setDrawColor(14, 116, 144);
  doc.setLineWidth(Math.max(0.16, size * 0.025));
  drawSnowflake(doc, x + size * 0.34, y + size * 0.9, size * 0.08);
  drawSnowflake(doc, x + size * 0.68, y + size * 0.9, size * 0.08);
};

const drawStorm = (doc: jsPDF, x: number, y: number, size: number): void => {
  drawCloud(doc, x + size * 0.05, y, size * 0.86);
  doc.setDrawColor(180, 83, 9);
  doc.setFillColor(250, 204, 21);
  doc.setLineWidth(Math.max(0.18, size * 0.025));
  doc.triangle(
    x + size * 0.47,
    y + size * 0.72,
    x + size * 0.65,
    y + size * 0.72,
    x + size * 0.53,
    y + size * 0.9,
    'FD',
  );
  doc.triangle(
    x + size * 0.53,
    y + size * 0.85,
    x + size * 0.65,
    y + size * 0.85,
    x + size * 0.43,
    y + size,
    'FD',
  );
};

export const drawWeatherPdfIcon = (
  doc: jsPDF,
  weather: WeatherPdfIconData,
  x: number,
  y: number,
  size: number,
): void => {
  doc.saveGraphicsState();
  try {
    switch (resolveWeatherPdfIconKind(weather)) {
      case 'sun':
        drawSun(doc, x, y, size);
        break;
      case 'cloud':
        drawCloud(doc, x, y, size);
        break;
      case 'fog':
        drawFog(doc, x, y, size);
        break;
      case 'drizzle':
        drawDrizzle(doc, x, y, size);
        break;
      case 'rain':
        drawRain(doc, x, y, size);
        break;
      case 'snow':
        drawSnow(doc, x, y, size);
        break;
      case 'storm':
        drawStorm(doc, x, y, size);
        break;
      case 'partly-cloudy':
      default:
        drawPartlyCloudy(doc, x, y, size);
        break;
    }
  } finally {
    doc.restoreGraphicsState();
  }
};

const normalizePadding = (padding?: MarginPaddingInput | null): { top: number; right: number; bottom: number; left: number } => {
  if (padding == null) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }

  if (Array.isArray(padding)) {
    if (padding.length === 2) {
      return { top: padding[0], right: padding[1], bottom: padding[0], left: padding[1] };
    }
    if (padding.length === 3) {
      return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[1] };
    }
    return {
      top: padding[0] ?? 0,
      right: padding[1] ?? padding[0] ?? 0,
      bottom: padding[2] ?? padding[0] ?? 0,
      left: padding[3] ?? padding[1] ?? padding[0] ?? 0,
    };
  }

  return {
    top: padding.top ?? padding.vertical ?? 0,
    right: padding.right ?? padding.horizontal ?? 0,
    bottom: padding.bottom ?? padding.vertical ?? 0,
    left: padding.left ?? padding.horizontal ?? 0,
  };
};

export const createWeatherTableIconHooks = (
  doc: jsPDF,
  weatherRows: readonly WeatherPdfIconData[],
  options: WeatherTableIconOptions = {},
): WeatherTableIconHooks => {
  const conditionColumnIndex = options.conditionColumnIndex ?? 1;
  const iconInsetX = options.iconInsetX ?? 2;
  const leftPadding = options.leftPadding ?? 11;
  const maxIconSize = options.maxIconSize ?? 7.2;

  return {
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== conditionColumnIndex || !weatherRows[data.row.index]) return;

      const padding = normalizePadding(data.cell.styles.cellPadding);
      data.cell.styles.cellPadding = {
        ...padding,
        left: Math.max(padding.left, leftPadding),
      };
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== conditionColumnIndex) return;

      const weather = weatherRows[data.row.index];
      if (!weather) return;

      const size = Math.min(maxIconSize, data.cell.height - 2.4);
      if (size < 3) return;

      drawWeatherPdfIcon(
        doc,
        weather,
        data.cell.x + iconInsetX,
        data.cell.y + (data.cell.height - size) / 2,
        size,
      );
    },
  };
};
