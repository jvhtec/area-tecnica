import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
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
  id?: string;
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
const MADRID_TIMEZONE = 'Europe/Madrid';

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
  const utcDate = fromZonedTime(`${value}T00:00:00`, MADRID_TIMEZONE);
  return Number.isNaN(utcDate.getTime()) ? null : utcDate;
};

const toMadridIsoDate = (value: Date): string => format(toZonedTime(value, MADRID_TIMEZONE), 'yyyy-MM-dd');

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
    return toMadridIsoDate(parsedDate);
  }

  const madridDate = toZonedTime(parsedDate, MADRID_TIMEZONE);
  madridDate.setDate(madridDate.getDate() - 1);
  return format(madridDate, 'yyyy-MM-dd');
};

const formatFestivalDayLabel = (dayKey: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey;
  const parsed = parseIsoDate(dayKey);
  if (!parsed) return dayKey;
  return format(toZonedTime(parsed, MADRID_TIMEZONE), 'dd/MM/yyyy', { locale: es });
};

export const groupArtistsByFestivalDay = (artists: ArtistRfIemData[]): Array<{
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
    id: typeof (artist as { id?: unknown }).id === 'string' ? String((artist as { id?: unknown }).id) : undefined,
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
export const getProviderSummary = (systems: RfIemSystemData[]): string => {
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

export const getRfSystemChannels = (system: RfIemSystemData): number => {
  // Only use quantity_ch if it's a positive number (> 0)
  // When quantity_ch is undefined, toNumber() coerces it to 0, which would incorrectly
  // bypass the HH+BP fallback for systems that only have HH/BP data
  if (typeof system.quantity_ch === 'number' && system.quantity_ch > 0 && Number.isFinite(system.quantity_ch)) {
    return system.quantity_ch;
  }
  // Derive channels from handheld + bodypack counts
  const hh = typeof system.quantity_hh === 'number' && Number.isFinite(system.quantity_hh) ? system.quantity_hh : 0;
  const bp = typeof system.quantity_bp === 'number' && Number.isFinite(system.quantity_bp) ? system.quantity_bp : 0;
  return hh + bp;
};

export const getUniqueFormattedBands = (systems: RfIemSystemData[] = []): string => {
  const providers = [...new Set(systems.map((system) => toProvider(system.provided_by, 'festival')))];
  const isMixed = providers.length > 1;

  if (!isMixed) {
    return [...new Set(systems
      .map(sys => formatFrequencyBand(sys.band))
      .filter(Boolean)
    )].join(', ');
  }

  const bandsByProvider = new Map<'festival' | 'band' | 'mixed', Set<string>>();
  for (const system of systems) {
    const provider = toProvider(system.provided_by, 'festival');
    if (!bandsByProvider.has(provider)) {
      bandsByProvider.set(provider, new Set<string>());
    }
    const formattedBand = formatFrequencyBand(system.band);
    if (formattedBand) {
      bandsByProvider.get(provider)?.add(formattedBand);
    }
  }

  return [...bandsByProvider.entries()]
    .map(([provider, bands]) => {
      const providerToken = provider === 'festival' ? FESTIVAL_TEXT_TOKEN : provider === 'band' ? BAND_TEXT_TOKEN : MIXED_TEXT_TOKEN;
      const providerLabel = provider === 'festival' ? 'Festival' : provider === 'band' ? 'Banda' : 'Mixto';
      const formattedBands = [...bands].join(', ') || '-';
      return `${providerToken}${providerLabel}: ${formattedBands}`;
    })
    .join('\n');
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

export const formatModelWithCounts = (systems: RfIemSystemData[]): string => {
  const providers = [...new Set(systems.map((system) => toProvider(system.provided_by, 'festival')))];
  const isMixed = providers.length > 1;

  if (isMixed) {
    const byModelProvider = new Map<string, {
      provider: 'festival' | 'band' | 'mixed';
      model: string;
    }>();

    for (const system of systems) {
      const model = (system.model || '').trim() || 'Modelo sin nombre';
      const provider = toProvider(system.provided_by, 'festival');
      const key = `${provider}::${model}`;
      if (!byModelProvider.has(key)) {
        byModelProvider.set(key, { provider, model });
      }
    }

    return [...byModelProvider.values()]
      .map((entry) => {
        const providerToken = entry.provider === 'festival' ? FESTIVAL_TEXT_TOKEN : entry.provider === 'band' ? BAND_TEXT_TOKEN : MIXED_TEXT_TOKEN;
        const providerLabel = entry.provider === 'festival' ? 'Festival' : entry.provider === 'band' ? 'Banda' : 'Mixto';
        return `${providerToken}${providerLabel}: ${entry.model}`;
      })
      .join('\n');
  }

  const modelNames = new Set<string>();

  for (const system of systems) {
    const model = (system.model || '').trim() || 'Modelo sin nombre';
    modelNames.add(model);
  }

  return [...modelNames].join(', ');
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

export const formatMetricBreakdownByProvider = (
  systems: RfIemSystemData[],
  getMetric: (system: RfIemSystemData) => number,
): string | number => {
  const formatBandLabelForMetric = (band: FrequencyBandSelection | string | undefined): string => {
    if (!band) return '-';
    if (typeof band === 'string') {
      const match = band.trim().match(/^([A-Za-z0-9-]+)/);
      return match ? match[1] : band.trim();
    }
    if (typeof band.code === 'string' && band.code.trim().length > 0) {
      return band.code.trim();
    }
    const formatted = formatFrequencyBand(band);
    const match = formatted.match(/^([A-Za-z0-9-]+)/);
    return match ? match[1] : formatted;
  };

  const buildProviderMetricParts = (
    totals: Map<'festival' | 'band' | 'mixed', number>,
  ): { text: string; total: number } => {
    const orderedProviders: Array<'festival' | 'band' | 'mixed'> = ['festival', 'band', 'mixed'];
    const parts: string[] = [];
    let total = 0;
    for (const provider of orderedProviders) {
      const value = totals.get(provider);
      if (!value || value <= 0) continue;
      total += value;
      const suffix = provider === 'festival' ? 'F' : provider === 'band' ? 'B' : 'M';
      const token = provider === 'festival' ? FESTIVAL_TEXT_TOKEN : provider === 'band' ? BAND_TEXT_TOKEN : MIXED_TEXT_TOKEN;
      parts.push(`${token}${value}${suffix}`);
    }
    return { text: parts.join('+'), total };
  };

  const uniqueBandLabels = [...new Set(systems
    .map((system) => formatBandLabelForMetric(system.band))
    .filter((band) => band && band !== '-'))];

  if (uniqueBandLabels.length > 1) {
    const byBand = new Map<string, Map<'festival' | 'band' | 'mixed', number>>();
    for (const system of systems) {
      const metric = getMetric(system);
      if (!metric || metric <= 0) continue;
      const bandLabel = formatBandLabelForMetric(system.band);
      const provider = toProvider(system.provided_by, 'festival');
      if (!byBand.has(bandLabel)) {
        byBand.set(bandLabel, new Map());
      }
      const providerTotalsForBand = byBand.get(bandLabel)!;
      providerTotalsForBand.set(provider, (providerTotalsForBand.get(provider) || 0) + metric);
    }

    const lines: string[] = [];
    let grandTotal = 0;
    for (const [bandLabel, providerTotalsForBand] of byBand.entries()) {
      const { text, total } = buildProviderMetricParts(providerTotalsForBand);
      if (!text) continue;
      grandTotal += total;
      lines.push(`${bandLabel}: ${text}`);
    }

    if (lines.length === 0) return 0;
    lines.push(`(${grandTotal})`);
    return lines.join('\n');
  }

  const providerTotals = new Map<'festival' | 'band' | 'mixed', number>();

  for (const system of systems) {
    const provider = toProvider(system.provided_by, 'festival');
    const metric = getMetric(system);
    providerTotals.set(provider, (providerTotals.get(provider) || 0) + metric);
  }

  if (providerTotals.size <= 1) {
    return formatMetricBreakdown(systems, getMetric);
  }

  const { text, total } = buildProviderMetricParts(providerTotals);
  if (!text) return 0;
  const plainText = stripProviderTextTokens(text);
  if (!plainText.includes('+')) return total;
  return `${text} (${total})`;
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

export const FESTIVAL_TEXT_TOKEN = '__FESTIVAL_ITEM__';
export const BAND_TEXT_TOKEN = '__BAND_ITEM__';
export const MIXED_TEXT_TOKEN = '__MIXED_ITEM__';

export const hasProviderTextToken = (value: string): boolean =>
  value.includes(FESTIVAL_TEXT_TOKEN) || value.includes(BAND_TEXT_TOKEN) || value.includes(MIXED_TEXT_TOKEN);

export const stripProviderTextTokens = (value: string): string =>
  value.replaceAll(FESTIVAL_TEXT_TOKEN, '').replaceAll(BAND_TEXT_TOKEN, '').replaceAll(MIXED_TEXT_TOKEN, '');

const getProviderTokenType = (line: string): 'festival' | 'band' | 'mixed' | 'default' => {
  if (line.includes(FESTIVAL_TEXT_TOKEN)) return 'festival';
  if (line.includes(BAND_TEXT_TOKEN)) return 'band';
  if (line.includes(MIXED_TEXT_TOKEN)) return 'mixed';
  return 'default';
};

export const splitTokenizedSegments = (
  value: string,
): Array<{ text: string; provider: 'festival' | 'band' | 'mixed' | 'default' }> => {
  const segments: Array<{ text: string; provider: 'festival' | 'band' | 'mixed' | 'default' }> = [];
  const tokenPattern = /(__FESTIVAL_ITEM__|__BAND_ITEM__|__MIXED_ITEM__)/g;
  let activeProvider: 'festival' | 'band' | 'mixed' | 'default' = 'default';
  let lastIndex = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const token = match[0];
    const startIndex = match.index ?? 0;
    const textBeforeToken = value.slice(lastIndex, startIndex);
    if (textBeforeToken) {
      segments.push({ text: textBeforeToken, provider: activeProvider });
    }

    activeProvider = token === FESTIVAL_TEXT_TOKEN ? 'festival' : token === BAND_TEXT_TOKEN ? 'band' : token === MIXED_TEXT_TOKEN ? 'mixed' : 'default';
    lastIndex = startIndex + token.length;
  }

  const trailingText = value.slice(lastIndex);
  if (trailingText) {
    segments.push({ text: trailingText, provider: activeProvider });
  }

  return segments.filter((segment) => segment.text.length > 0);
};

const isMixedMetricValue = (value: string): boolean =>
  hasProviderTextToken(value) || /^\d+[FB](?:\+\d+[FB])+ \(\d+\)$/.test(value.trim());

const splitMixedMetricSegments = (value: string): Array<{ text: string; provider: 'festival' | 'band' | 'mixed' | 'default' }> => {
  return splitTokenizedSegments(value);
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

export const formatTimeRange = (start?: string, end?: string): string => {
  const safeStart = (start || '').trim();
  const safeEnd = (end || '').trim();
  if (!safeStart && !safeEnd) return '-';
  if (!safeStart) return `- ${safeEnd}`;
  if (!safeEnd) return `${safeStart} - -`;
  return `${safeStart} - ${safeEnd}`;
};

export const buildRfIemTableRow = (artist: ArtistRfIemData): Array<string | number> => {
  const totalRfChannels = formatMetricBreakdownByProvider(artist.wirelessSystems, getRfSystemChannels);
  const totalRfHH = formatMetricBreakdownByProvider(artist.wirelessSystems, (sys) => sys.quantity_hh || 0);
  const totalRfBP = formatMetricBreakdownByProvider(artist.wirelessSystems, (sys) => sys.quantity_bp || 0);
  const totalIemChannels = formatMetricBreakdownByProvider(artist.iemSystems, (sys) => sys.quantity_hh || sys.quantity || 0);
  const totalIemBodpacks = formatMetricBreakdownByProvider(artist.iemSystems, (sys) => sys.quantity_bp || 0);
  const rfModels = formatModelWithCounts(artist.wirelessSystems);
  const rfBands = getUniqueFormattedBands(artist.wirelessSystems);
  const iemModels = formatModelWithCounts(artist.iemSystems);
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
  const leftMargin = 10;
  const rightMargin = leftMargin;
  const tableStartY = 30;
  const footerBandHeight = 22;

  let headerLogoObjectUrl: string | undefined;
  let headerLogoFormat: 'PNG' | 'JPEG' = 'PNG';
  let headerLogoDimensions: { width: number; height: number } | undefined;
  if (data.logoUrl) {
    try {
      const response = await fetch(data.logoUrl);
      const logoBlob = await response.blob();
      headerLogoObjectUrl = URL.createObjectURL(logoBlob);
      headerLogoFormat = logoBlob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG';

      headerLogoDimensions = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
        const image = new Image();
        image.onload = () => {
          resolve({ width: image.width, height: image.height });
        };
        image.onerror = () => resolve(undefined);
        image.src = headerLogoObjectUrl as string;
      });
    } catch (err) {
      console.error('Error loading logo:', err);
    }
  }

  const drawPageHeader = (festivalDayLabel: string): void => {
    if (headerLogoObjectUrl && headerLogoDimensions && headerLogoDimensions.width > 0 && headerLogoDimensions.height > 0) {
      const maxLogoWidth = 40;
      const maxLogoHeight = 15;
      const scale = Math.min(
        maxLogoWidth / headerLogoDimensions.width,
        maxLogoHeight / headerLogoDimensions.height,
      );
      const drawWidth = headerLogoDimensions.width * scale;
      const drawHeight = headerLogoDimensions.height * scale;
      pdf.addImage(
        headerLogoObjectUrl,
        headerLogoFormat,
        pageWidth - drawWidth - rightMargin,
        10,
        drawWidth,
        drawHeight
      );
    }

    pdf.setTextColor(0);
    pdf.setFontSize(18);
    pdf.text(`${data.jobTitle} - Resumen RF e IEM`, leftMargin, 18);
    pdf.setFontSize(11);
    pdf.setTextColor(80);
    pdf.text(`Día festival: ${festivalDayLabel}`, leftMargin, 25);
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

  const availableWidth = pageWidth - leftMargin - rightMargin;
  const ratios = [0.10, 0.05, 0.09, 0.06, 0.095, 0.075, 0.05, 0.04, 0.04, 0.06, 0.095, 0.075, 0.06, 0.06];
  const ratioSum = ratios.reduce((sum, ratio) => sum + ratio, 0) || 1;
  const columnStyles = ratios.reduce((acc, ratio, index) => {
    acc[index] = { cellWidth: availableWidth * (ratio / ratioSum) };
    return acc;
  }, {} as Record<number, { cellWidth: number }>);

  for (let index = 0; index < dayGroups.length; index += 1) {
    const group = dayGroups[index];
    const tableData = group.artists.map(buildRfIemTableRow);
    const tokenizedCellText = new Map<string, string>();
    const mixedMetricText = new Map<string, string>();

    if (index > 0) {
      pdf.addPage('a4', 'landscape');
    }

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
      startY: tableStartY,
      margin: {
        left: leftMargin,
        right: rightMargin,
        top: tableStartY,
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
      didDrawPage: () => {
        drawPageHeader(group.label);
      },
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

        const cellText = Array.isArray(cellData.cell.text)
          ? cellData.cell.text.join('\n')
          : String(cellData.cell.text || '');
        const isMixedDetailColumn = (
          cellData.column.index === 4 ||
          cellData.column.index === 5 ||
          cellData.column.index === 10 ||
          cellData.column.index === 11
        );
        if (isMixedDetailColumn && hasProviderTextToken(cellText)) {
          tokenizedCellText.set(`${cellData.row.index}-${cellData.column.index}`, cellText);
          const visibleText = stripProviderTextTokens(cellText);
          cellData.cell.text = visibleText.split('\n');
          const fillColor = cellData.cell.styles.fillColor;
          if (Array.isArray(fillColor)) {
            cellData.cell.styles.textColor = [fillColor[0], fillColor[1], fillColor[2]];
          }
        }

        const isMetricColumn = (
          cellData.column.index === 6 ||
          cellData.column.index === 7 ||
          cellData.column.index === 8 ||
          cellData.column.index === 12 ||
          cellData.column.index === 13
        );
        if (isMetricColumn && isMixedMetricValue(cellText)) {
          mixedMetricText.set(`${cellData.row.index}-${cellData.column.index}`, cellText);
          const fillColor = cellData.cell.styles.fillColor;
          cellData.cell.text = [''];
          if (Array.isArray(fillColor)) {
            cellData.cell.styles.textColor = [fillColor[0], fillColor[1], fillColor[2]];
          }
        }
      },
      didDrawCell: (cellData) => {
        if (cellData.section !== 'body') return;
        const key = `${cellData.row.index}-${cellData.column.index}`;
        const metricText = mixedMetricText.get(key);
        if (metricText) {
          const docInstance = (cellData as any).doc;
          const cellPadding = typeof cellData.cell.styles.cellPadding === 'number'
            ? cellData.cell.styles.cellPadding
            : 2;
          const maxTextWidth = Math.max(0, cellData.cell.width - (cellPadding * 2));
          const maxTextHeight = Math.max(0, cellData.cell.height - (cellPadding * 2));
          const minFontSize = 7;
          let fontSize = Number(cellData.cell.styles.fontSize || 9);
          const lines = metricText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

          if (lines.length === 0) return;

          const lineSegments = lines.map((line) => splitMixedMetricSegments(line));
          const computeLineWidth = (segments: Array<{ text: string; provider: 'festival' | 'band' | 'mixed' | 'default' }>): number =>
            segments.reduce((sum, segment) => sum + docInstance.getTextWidth(segment.text), 0);

          while (fontSize > minFontSize) {
            docInstance.setFontSize(fontSize);
            const tooWide = lineSegments.some((segments) => computeLineWidth(segments) > maxTextWidth);
            const lineHeight = fontSize * 0.5;
            const tooTall = (lineHeight * lineSegments.length) > maxTextHeight;
            if (!tooWide && !tooTall) break;
            fontSize -= 0.3;
          }

          docInstance.setFontSize(fontSize);
          const lineHeight = fontSize * 0.5;
          const firstBaselineY = cellData.cell.y + cellPadding + (fontSize * 0.35);

          lineSegments.forEach((segments, lineIndex) => {
            const startX = cellData.cell.x + cellPadding;
            const baselineY = firstBaselineY + (lineIndex * lineHeight);
            let cursorX = startX;

            for (const segment of segments) {
              if (segment.provider === 'festival') {
                docInstance.setTextColor(72, 105, 136);
              } else if (segment.provider === 'mixed') {
                docInstance.setTextColor(22, 163, 74);
              } else {
                docInstance.setTextColor(35, 35, 35);
              }
              docInstance.text(segment.text, cursorX, baselineY);
              cursorX += docInstance.getTextWidth(segment.text);
            }
          });
          return;
        }

        const tokenizedText = tokenizedCellText.get(key);
        if (!tokenizedText) return;

        const docInstance = (cellData as any).doc;
        const cellPadding = typeof cellData.cell.styles.cellPadding === 'number'
          ? cellData.cell.styles.cellPadding
          : 2;
        const textX = cellData.cell.x + cellPadding;
        const maxTextWidth = Math.max(0, cellData.cell.width - (cellPadding * 2));
        const wrappedWithProvider: Array<{ providerType: 'festival' | 'band' | 'mixed' | 'default'; text: string }> = [];
        for (const rawLine of tokenizedText.split('\n')) {
          const providerType = getProviderTokenType(rawLine);
          const visibleLine = stripProviderTextTokens(rawLine);
          const wrappedLines: string[] = docInstance.splitTextToSize(visibleLine, maxTextWidth);
          for (const wrappedLine of wrappedLines) {
            wrappedWithProvider.push({ providerType, text: wrappedLine });
          }
        }

        if (wrappedWithProvider.length === 0) return;
        const usableHeight = Math.max(2, cellData.cell.height - (cellPadding * 2));
        const lineStep = usableHeight / wrappedWithProvider.length;
        let textY = cellData.cell.y + cellPadding + (lineStep * 0.8);
        const cellBottomLimit = cellData.cell.y + cellData.cell.height - 1;

        for (const line of wrappedWithProvider) {
          if (textY > cellBottomLimit) break;
          if (line.providerType === 'festival') {
            docInstance.setTextColor(72, 105, 136);
          } else if (line.providerType === 'mixed') {
            docInstance.setTextColor(22, 163, 74);
          } else {
            docInstance.setTextColor(35, 35, 35);
          }
          docInstance.text(line.text, textX, textY);
          textY += lineStep;
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
        pdf.text(`Generado: ${date}`, leftMargin, pageHeight - 8);
        pdf.text(`Pagina ${i} de ${totalPages}`, pageWidth - rightMargin, pageHeight - 8, { align: 'right' });
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
