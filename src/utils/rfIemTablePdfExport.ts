import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { formatFrequencyBand, type FrequencyBandSelection } from '@/lib/frequencyBands';

export interface RfIemSystemData {
  model: string;
  quantity?: number;
  quantity_ch?: number;
  quantity_hh?: number;
  quantity_bp?: number;
  band?: FrequencyBandSelection | string;
  provided_by?: 'festival' | 'band' | 'mixed';
}

export interface ArtistRfIemData {
  name: string;
  stage: number;
  wirelessSystems: RfIemSystemData[];
  iemSystems: RfIemSystemData[];
  date?: string;
  isAfterMidnight?: boolean;
  showStart?: string;
  showEnd?: string;
  soundcheckStart?: string;
  soundcheckEnd?: string;
}

export interface RfIemTablePdfData {
  jobTitle: string;
  logoUrl?: string;
  artists: ArtistRfIemData[];
}

type RawArtistLike = ArtistRfIemData & {
  wireless_systems?: unknown;
  iem_systems?: unknown;
  wireless_provided_by?: unknown;
  iem_provided_by?: unknown;
  date?: unknown;
  isaftermidnight?: unknown;
  isAfterMidnight?: unknown;
  show_start?: unknown;
  show_end?: unknown;
  soundcheck_start?: unknown;
  soundcheck_end?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toProvider = (value: unknown, fallback: 'festival' | 'band' | 'mixed' = 'festival'): 'festival' | 'band' | 'mixed' => {
  if (value === 'festival' || value === 'band' || value === 'mixed') return value;
  return fallback;
};

const FESTIVAL_DAY_ROLLOVER_HOUR = 7;

const parseTimeToMinutes = (value: string | null | undefined): number => {
  if (!value || typeof value !== 'string') return Number.NaN;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) return Number.NaN;

  const hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const second = Number(match[3] || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return Number.NaN;
  return hour * 60 + minute + second / 60;
};

const parseIsoDate = (value: string | undefined): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getShowSortMinutes = (artist: ArtistRfIemData): number => {
  const parsed = parseTimeToMinutes(artist.showStart);
  if (!Number.isFinite(parsed)) return Number.MAX_SAFE_INTEGER;
  if (parsed >= FESTIVAL_DAY_ROLLOVER_HOUR * 60) {
    return parsed;
  }
  const explicitAfterMidnight = artist.isAfterMidnight === true;
  if (explicitAfterMidnight || parsed < FESTIVAL_DAY_ROLLOVER_HOUR * 60) {
    return parsed + (24 * 60);
  }
  return parsed;
};

export const computeRfIemFestivalDayKey = (artist: ArtistRfIemData): string => {
  const parsedDate = parseIsoDate(artist.date);
  if (!parsedDate) {
    return 'Sin fecha';
  }

  const showMinutes = parseTimeToMinutes(artist.showStart);
  const shouldUsePreviousDay = artist.isAfterMidnight !== true &&
    Number.isFinite(showMinutes) &&
    showMinutes < FESTIVAL_DAY_ROLLOVER_HOUR * 60;

  if (!shouldUsePreviousDay) {
    return toIsoDate(parsedDate);
  }

  const previousDay = new Date(parsedDate);
  previousDay.setDate(previousDay.getDate() - 1);
  return toIsoDate(previousDay);
};

const formatFestivalDayLabel = (dayKey: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey;
  const parsed = parseIsoDate(dayKey);
  if (!parsed) return dayKey;
  return parsed.toLocaleDateString('es-ES');
};

const groupArtistsByFestivalDay = (artists: ArtistRfIemData[]): Array<{
  key: string;
  label: string;
  artists: ArtistRfIemData[];
}> => {
  const sorted = [...artists].sort((a, b) => {
    const dayA = computeRfIemFestivalDayKey(a);
    const dayB = computeRfIemFestivalDayKey(b);
    if (dayA !== dayB) return dayA.localeCompare(dayB);

    const timeA = getShowSortMinutes(a);
    const timeB = getShowSortMinutes(b);
    if (timeA !== timeB) return timeA - timeB;

    if (a.stage !== b.stage) return a.stage - b.stage;
    return (a.name || '').localeCompare(b.name || '');
  });

  const grouped = new Map<string, ArtistRfIemData[]>();
  for (const artist of sorted) {
    const dayKey = computeRfIemFestivalDayKey(artist);
    if (!grouped.has(dayKey)) grouped.set(dayKey, []);
    grouped.get(dayKey)?.push(artist);
  }

  return [...grouped.entries()].map(([key, groupArtists]) => ({
    key,
    label: formatFestivalDayLabel(key),
    artists: groupArtists,
  }));
};

const normalizeSystems = (
  value: unknown,
  fallbackProvider: 'festival' | 'band' | 'mixed',
): RfIemSystemData[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((system) => ({
      model: typeof system.model === 'string' ? system.model : '',
      quantity: toNumber(system.quantity),
      quantity_ch: toNumber(system.quantity_ch),
      quantity_hh: toNumber(system.quantity_hh),
      quantity_bp: toNumber(system.quantity_bp),
      band: typeof system.band === 'string' || isRecord(system.band)
        ? (system.band as FrequencyBandSelection | string)
        : undefined,
      provided_by: toProvider(system.provided_by, fallbackProvider),
    }))
    .filter((system) =>
      system.model.trim().length > 0 ||
      (system.quantity || 0) > 0 ||
      (system.quantity_ch || 0) > 0 ||
      (system.quantity_hh || 0) > 0 ||
      (system.quantity_bp || 0) > 0,
    );
};

export const normalizeRfIemArtistInput = (artist: RawArtistLike): ArtistRfIemData => {
  const wirelessFallback = toProvider(artist.wireless_provided_by, 'festival');
  const iemFallback = toProvider(artist.iem_provided_by, 'festival');

  const normalizedWireless = normalizeSystems(
    artist.wirelessSystems ?? artist.wireless_systems,
    wirelessFallback,
  );
  const normalizedIem = normalizeSystems(
    artist.iemSystems ?? artist.iem_systems,
    iemFallback,
  );

  return {
    name: typeof artist.name === 'string' && artist.name.trim().length > 0 ? artist.name : 'Unnamed Artist',
    stage: toNumber(artist.stage, 1),
    wirelessSystems: normalizedWireless,
    iemSystems: normalizedIem,
    date: typeof artist.date === 'string' ? artist.date : undefined,
    isAfterMidnight: artist.isAfterMidnight === true || artist.isaftermidnight === true,
    showStart: typeof (artist.showStart ?? artist.show_start) === 'string'
      ? String(artist.showStart ?? artist.show_start)
      : undefined,
    showEnd: typeof (artist.showEnd ?? artist.show_end) === 'string'
      ? String(artist.showEnd ?? artist.show_end)
      : undefined,
    soundcheckStart: typeof (artist.soundcheckStart ?? artist.soundcheck_start) === 'string'
      ? String(artist.soundcheckStart ?? artist.soundcheck_start)
      : undefined,
    soundcheckEnd: typeof (artist.soundcheckEnd ?? artist.soundcheck_end) === 'string'
      ? String(artist.soundcheckEnd ?? artist.soundcheck_end)
      : undefined,
  };
};

export const hasRfIemContent = (artist: ArtistRfIemData): boolean => {
  return artist.wirelessSystems.length > 0 || artist.iemSystems.length > 0;
};

// Helper function to aggregate provider information from systems
const getProviderSummary = (systems: RfIemSystemData[]): string => {
  if (!systems || systems.length === 0) return '';

  const providers = systems.map(system => system.provided_by || 'festival');
  const uniqueProviders = [...new Set(providers)];

  if (uniqueProviders.length === 1) {
    if (uniqueProviders[0] === 'festival') return 'Festival';
    if (uniqueProviders[0] === 'band') return 'Banda';
    return 'Mixto';
  }

  return 'Mixto';
};

const getRfSystemChannels = (system: RfIemSystemData): number => {
  if (typeof system.quantity_ch === 'number' && Number.isFinite(system.quantity_ch)) {
    return system.quantity_ch;
  }
  return (system.quantity_hh || 0) + (system.quantity_bp || 0);
};

export const getUniqueFormattedBands = (systems: RfIemSystemData[] = []): string => {
  return [...new Set(systems
    .map(sys => formatFrequencyBand(sys.band))
    .filter(Boolean)
  )].join(', ');
};

const aggregateByModel = (
  systems: RfIemSystemData[],
  getMetric: (system: RfIemSystemData) => number,
): Array<{ model: string; metric: number }> => {
  const byModel = new Map<string, number>();
  for (const system of systems) {
    const model = (system.model || '').trim() || 'Modelo sin nombre';
    byModel.set(model, (byModel.get(model) || 0) + getMetric(system));
  }
  return [...byModel.entries()].map(([model, metric]) => ({ model, metric }));
};

const formatModelWithCounts = (systems: RfIemSystemData[], isIem: boolean): string => {
  const byModel = new Map<string, { channels: number; hh: number; bp: number }>();

  for (const system of systems) {
    const model = (system.model || '').trim() || 'Modelo sin nombre';
    if (!byModel.has(model)) {
      byModel.set(model, { channels: 0, hh: 0, bp: 0 });
    }
    const current = byModel.get(model)!;
    if (isIem) {
      current.channels += system.quantity_hh || system.quantity || 0;
      current.bp += system.quantity_bp || 0;
    } else {
      current.channels += getRfSystemChannels(system);
      current.hh += system.quantity_hh || 0;
      current.bp += system.quantity_bp || 0;
    }
  }

  return [...byModel.entries()]
    .map(([model, values]) =>
      isIem
        ? `${model} (${values.channels}ch, ${values.bp}bp)`
        : `${model} (${values.channels}ch, ${values.hh}hh, ${values.bp}bp)`,
    )
    .join(', ');
};

const formatMetricBreakdown = (
  systems: RfIemSystemData[],
  getMetric: (system: RfIemSystemData) => number,
): string | number => {
  const grouped = aggregateByModel(systems, getMetric);
  if (grouped.length <= 1) {
    return grouped.reduce((sum, group) => sum + group.metric, 0);
  }
  const values = grouped.map((group) => group.metric);
  const total = values.reduce((sum, value) => sum + value, 0);
  return `${values.join('+')} (${total})`;
};

const getProviderCellColor = (provider: string): [number, number, number] => {
  const normalized = provider.toLowerCase();
  if (normalized === 'festival') {
    return [214, 232, 255];
  }
  if (normalized === 'banda' || normalized === 'band') {
    return [255, 226, 204];
  }
  return [232, 232, 232];
};

const getStageCellColor = (stageLabel: string): [number, number, number] => {
  const match = stageLabel.match(/\d+/);
  const stageNumber = match ? parseInt(match[0], 10) : 0;
  const palette: Array<[number, number, number]> = [
    [238, 244, 252], // light blue
    [242, 250, 238], // light green
    [252, 245, 236], // light orange
    [245, 240, 252], // light lavender
    [239, 250, 250], // light cyan
  ];
  if (!Number.isFinite(stageNumber) || stageNumber <= 0) {
    return [245, 245, 245];
  }
  return palette[(stageNumber - 1) % palette.length];
};

const formatTimeRange = (start?: string, end?: string): string => {
  const safeStart = (start || '').trim();
  const safeEnd = (end || '').trim();
  if (!safeStart && !safeEnd) return '-';
  if (!safeStart) return `- ${safeEnd}`;
  if (!safeEnd) return `${safeStart} - -`;
  return `${safeStart} - ${safeEnd}`;
};

export const buildRfIemTableRow = (artist: ArtistRfIemData): Array<string | number> => {
  const totalRfChannels = formatMetricBreakdown(artist.wirelessSystems, getRfSystemChannels);
  const totalRfHH = formatMetricBreakdown(artist.wirelessSystems, (sys) => sys.quantity_hh || 0);
  const totalRfBP = formatMetricBreakdown(artist.wirelessSystems, (sys) => sys.quantity_bp || 0);
  const totalIemChannels = formatMetricBreakdown(artist.iemSystems, (sys) => sys.quantity_hh || sys.quantity || 0);
  const totalIemBodpacks = formatMetricBreakdown(artist.iemSystems, (sys) => sys.quantity_bp || 0);
  const rfModels = formatModelWithCounts(artist.wirelessSystems, false);
  const rfBands = getUniqueFormattedBands(artist.wirelessSystems);
  const iemModels = formatModelWithCounts(artist.iemSystems, true);
  const iemBands = getUniqueFormattedBands(artist.iemSystems);
  const rfProvidedBy = getProviderSummary(artist.wirelessSystems);
  const iemProvidedBy = getProviderSummary(artist.iemSystems);
  const scheduleCell = `Show: ${formatTimeRange(artist.showStart, artist.showEnd)}\nSC: ${formatTimeRange(artist.soundcheckStart, artist.soundcheckEnd)}`;

  return [
    artist.name,
    `Escenario ${artist.stage}`,
    scheduleCell,
    rfProvidedBy,
    rfModels,
    rfBands,
    totalRfChannels,
    totalRfHH,
    totalRfBP,
    iemProvidedBy,
    iemModels,
    iemBands,
    totalIemChannels,
    totalIemBodpacks
  ];
};

export const exportRfIemTablePDF = async (data: RfIemTablePdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const horizontalMargin = 10;
  const footerBandHeight = 22;

  let headerLogoObjectUrl: string | undefined;
  if (data.logoUrl) {
    try {
      const response = await fetch(data.logoUrl);
      const logoBlob = await response.blob();
      headerLogoObjectUrl = URL.createObjectURL(logoBlob);
    } catch (err) {
      console.error('Error loading logo:', err);
    }
  }

  const drawPageHeader = (festivalDayLabel: string): void => {
    if (headerLogoObjectUrl) {
      const maxLogoWidth = 40;
      const maxLogoHeight = 15;
      pdf.addImage(
        headerLogoObjectUrl,
        'PNG',
        pageWidth - maxLogoWidth - horizontalMargin,
        10,
        maxLogoWidth,
        maxLogoHeight
      );
    }

    pdf.setTextColor(0);
    pdf.setFontSize(18);
    pdf.text(`${data.jobTitle} - Resumen RF e IEM`, horizontalMargin, 18);
    pdf.setFontSize(11);
    pdf.setTextColor(80);
    pdf.text(`Día festival: ${festivalDayLabel}`, horizontalMargin, 25);
  };

  const normalizedArtists = (data.artists || []).map((artist) => normalizeRfIemArtistInput(artist as RawArtistLike));
  const filteredArtists = normalizedArtists.filter(hasRfIemContent);

  if (filteredArtists.length === 0) {
    throw new Error('No hay datos RF/IEM para los escenarios seleccionados.');
  }

  const dayGroups = groupArtistsByFestivalDay(filteredArtists);

  if (dayGroups.length === 0) {
    throw new Error('No hay datos RF/IEM para los escenarios seleccionados.');
  }

  const availableWidth = pageWidth - (horizontalMargin * 2);
  const ratios = [0.11, 0.05, 0.095, 0.07, 0.10, 0.08, 0.045, 0.035, 0.035, 0.07, 0.10, 0.08, 0.045, 0.04];
  const columnStyles = ratios.reduce((acc, ratio, index) => {
    acc[index] = { cellWidth: availableWidth * ratio };
    return acc;
  }, {} as Record<number, { cellWidth: number }>);

  for (let index = 0; index < dayGroups.length; index += 1) {
    const group = dayGroups[index];
    const tableData = group.artists.map(buildRfIemTableRow);

    if (index > 0) {
      pdf.addPage('a4', 'landscape');
    }

    drawPageHeader(group.label);

    autoTable(pdf, {
      head: [[
        'Artista',
        'Esc.',
        'Horario',
        'RF Prov.',
        'Modelos RF',
        'Bandas RF',
        'Can RF',
        'HH',
        'BP',
        'IEM Prov.',
        'Modelos IEM',
        'Bandas IEM',
        'Can IEM',
        'BP IEM'
      ]],
      body: tableData,
      startY: 30,
      margin: {
        left: horizontalMargin,
        right: horizontalMargin,
        bottom: footerBandHeight,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: {
        fillColor: [240, 240, 245]
      },
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        overflow: 'linebreak',
      },
      rowPageBreak: 'avoid',
      columnStyles,
      didParseCell: (cellData) => {
        if (cellData.section !== 'body') return;
        const rowValues = tableData[cellData.row.index];
        if (!rowValues) return;

        const rfProvider = String(rowValues[3] || '');
        const iemProvider = String(rowValues[9] || '');
        const stageLabel = String(rowValues[1] || '');
        const rfColor = getProviderCellColor(rfProvider);
        const iemColor = getProviderCellColor(iemProvider);
        const stageColor = getStageCellColor(stageLabel);

        if (cellData.column.index >= 0 && cellData.column.index <= 2) {
          cellData.cell.styles.fillColor = stageColor;
          cellData.cell.styles.textColor = [30, 30, 30];
        }

        if (cellData.column.index >= 3 && cellData.column.index <= 8) {
          cellData.cell.styles.fillColor = rfColor;
          cellData.cell.styles.textColor = [35, 35, 35];
        }

        if (cellData.column.index >= 9 && cellData.column.index <= 13) {
          cellData.cell.styles.fillColor = iemColor;
          cellData.cell.styles.textColor = [35, 35, 35];
        }
      },
    });
  }

  const addFooter = async () => {
    return new Promise<void>((resolve) => {
      const totalPages = pdf.getNumberOfPages();

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        pdf.setFontSize(8);
        pdf.setTextColor(100);

        const date = new Date().toLocaleDateString('es-ES');
        pdf.text(`Generado: ${date}`, horizontalMargin, pageHeight - 8);
        pdf.text(`Pagina ${i} de ${totalPages}`, pageWidth - horizontalMargin - 5, pageHeight - 8, { align: 'right' });
      }

      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';

      logo.onload = () => {
        const logoWidth = 50;
        const logoHeight = logoWidth * (logo.height / logo.width);

        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          const xPosition = (pageWidth - logoWidth) / 2;
          const yPosition = pageHeight - 5 - logoHeight;

          try {
            pdf.addImage(logo, 'PNG', xPosition, yPosition, logoWidth, logoHeight);
          } catch (error) {
            console.error(`Error adding logo on page ${i}:`, error);
          }
        }

        resolve();
      };

      logo.onerror = () => {
        resolve();
      };
    });
  };

  await addFooter();
  if (headerLogoObjectUrl) {
    URL.revokeObjectURL(headerLogoObjectUrl);
  }

  return pdf.output('blob');
};
