import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { MADRID_TIMEZONE } from '@/utils/timezoneUtils';

export type SoundvisionReportSystem = 'LA' | 'Turbo';
export type SoundvisionPlotId = 'spl-a' | 'spl-z' | 'subs';
export type SoundvisionPlotView = 'top' | 'iso';

export interface SoundvisionPdfImage {
  dataUrl: string;
  width: number;
  height: number;
  format: 'PNG' | 'JPEG';
}

export interface SoundvisionEquipmentRow {
  quantity: string;
  model: string;
  role: string;
}

export interface SoundvisionReportConditions {
  temperatureC: string;
  humidityPercent: string;
  inputLevelDbu: string;
  audiencePlaneM: string;
}

export interface SoundvisionReportPlot {
  id: SoundvisionPlotId;
  title: string;
  descriptor: string;
  weighting: string;
  band: string;
  topView: SoundvisionPdfImage | null;
  isoView: SoundvisionPdfImage | null;
}

export interface SoundvisionReportModel {
  system: SoundvisionReportSystem;
  eventTitle: string;
  stageLabel: string;
  eventDate: string;
  issuedDate: string;
  revision: string;
  equipment: SoundvisionEquipmentRow[];
  conditions: SoundvisionReportConditions;
  plots: SoundvisionReportPlot[];
}

export interface SoundvisionReportBrand {
  reportLabel: string;
  predictionLabel: string;
  manufacturer: string;
  filenamePrefix: string;
  logoPath: string;
}

export interface SoundvisionPlotDefinition {
  id: SoundvisionPlotId;
  title: string;
  descriptor: string;
  weighting: string;
  band: string;
  topFileBase: string;
  isoFileBase?: string;
}

export const MAX_SOUNDVISION_SCHEDULE_ROWS = 10;

export const SOUNDVISION_REPORT_BRANDS: Record<SoundvisionReportSystem, SoundvisionReportBrand> = {
  LA: {
    reportLabel: 'Informe Soundvision',
    predictionLabel: 'Predicción Soundvision',
    manufacturer: "L-Acoustics",
    filenamePrefix: 'Soundvision',
    logoPath: '/lovable-uploads/a2246e0e-373b-4091-9471-1a7c00fe82ed.png',
  },
  Turbo: {
    reportLabel: 'Informe EASE Focus',
    predictionLabel: 'Predicción EASE Focus',
    manufacturer: 'Turbosound',
    filenamePrefix: 'EaseFocus',
    logoPath: '/lovable-uploads/e78ab52e-aa81-4770-a6bb-f802a5ff651e.png',
  },
};

export const SOUNDVISION_PLOT_DEFINITIONS: SoundvisionPlotDefinition[] = [
  {
    id: 'spl-a',
    title: 'SPL(A) Banda ancha',
    descriptor: 'Ponderación A | rango completo',
    weighting: 'Ponderación A',
    band: 'Banda ancha',
    topFileBase: 'TOP_A',
    isoFileBase: 'ISO_A',
  },
  {
    id: 'spl-z',
    title: 'SPL(Z) 250 Hz - 16 kHz',
    descriptor: 'Lineal (Z) | 250 Hz - 16 kHz',
    weighting: 'Lineal (Z)',
    band: '250 Hz - 16 kHz',
    topFileBase: 'TOP_C',
    isoFileBase: 'ISO_C',
  },
  {
    id: 'subs',
    title: 'Subgraves SPL(Z) 32 - 80 Hz',
    descriptor: 'Sin ponderación | 32 - 80 Hz',
    weighting: 'Lineal (Z)',
    band: '32 - 80 Hz',
    topFileBase: 'SUB',
  },
];

export const soundvisionPlotImageKey = (
  plotId: SoundvisionPlotId,
  view: SoundvisionPlotView,
): string => `${plotId}-${view}`;

export const parseSoundvisionEquipment = (value: string): SoundvisionEquipmentRow[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const roleMatch = line.match(/\s*\(([^()]*)\)\s*$/);
      const role = roleMatch?.[1]?.trim() ?? '';
      const withoutRole = roleMatch ? line.slice(0, roleMatch.index).trim() : line;
      const quantityMatch = withoutRole.match(/^(\d+)\s*(?:x\s+)?(.+)$/i);

      if (!quantityMatch) {
        return { quantity: '-', model: withoutRole, role };
      }

      return {
        quantity: String(Number(quantityMatch[1])),
        model: quantityMatch[2].trim(),
        role,
      };
    });

const validDate = (value: string | Date): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatReportDate = (date: Date, pattern: string): string =>
  formatInTimeZone(date, MADRID_TIMEZONE, pattern, { locale: es });

export const formatSoundvisionDateRange = (
  startValue: string | Date,
  endValue?: string | Date | null,
): string => {
  const start = validDate(startValue);
  const end = endValue ? validDate(endValue) : null;
  if (!start) return '';
  if (!end || end.getTime() <= start.getTime()) return formatReportDate(start, 'dd MMMM yyyy');
  if (end.getTime() - start.getTime() < 18 * 60 * 60 * 1000) {
    return formatReportDate(start, 'dd MMMM yyyy');
  }

  const startDay = formatReportDate(start, 'yyyy-MM-dd');
  const endDay = formatReportDate(end, 'yyyy-MM-dd');
  if (startDay === endDay) return formatReportDate(start, 'dd MMMM yyyy');

  const startMonth = formatReportDate(start, 'yyyy-MM');
  const endMonth = formatReportDate(end, 'yyyy-MM');
  if (startMonth === endMonth) {
    return `${formatReportDate(start, 'dd')}-${formatReportDate(end, 'dd MMMM yyyy')}`;
  }

  const startYear = formatReportDate(start, 'yyyy');
  const endYear = formatReportDate(end, 'yyyy');
  if (startYear === endYear) {
    return `${formatReportDate(start, 'dd MMMM')} - ${formatReportDate(end, 'dd MMMM yyyy')}`;
  }

  return `${formatReportDate(start, 'dd MMMM yyyy')} - ${formatReportDate(end, 'dd MMMM yyyy')}`;
};

export const formatSoundvisionIssueDate = (value: string | Date): string => {
  const date = validDate(value);
  return date ? formatReportDate(date, 'dd MMMM yyyy') : '';
};

export const buildSoundvisionReportFilename = (
  system: SoundvisionReportSystem,
  eventTitle: string,
  stageLabel: string,
): string => {
  const safeName = [eventTitle, stageLabel]
    .filter(Boolean)
    .join(' - ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_');
  return `${SOUNDVISION_REPORT_BRANDS[system].filenamePrefix}_Informe_${safeName || 'Sin_nombre'}.pdf`;
};

export const validateSoundvisionReport = (model: SoundvisionReportModel): string[] => {
  const errors: string[] = [];
  if (!model.eventTitle.trim()) errors.push('El informe necesita un nombre de trabajo.');
  if (model.equipment.length === 0) errors.push('Añada al menos una línea de equipamiento.');
  if (model.equipment.length > MAX_SOUNDVISION_SCHEDULE_ROWS) {
    errors.push(`El listado admite un máximo de ${MAX_SOUNDVISION_SCHEDULE_ROWS} líneas.`);
  }

  const missingPlots = model.plots.filter((plot) => !plot.topView).map((plot) => plot.title);
  if (missingPlots.length > 0) {
    errors.push(`Faltan vistas en planta: ${missingPlots.join(', ')}.`);
  }

  return errors;
};
