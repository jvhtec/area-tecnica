import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import {
  distributeColumnWidths,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalMetaGrid,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  FESTIVAL_ACCENT,
  FESTIVAL_RULE,
  festivalTableTheme,
  loadFestivalIssuerMark,
} from '@/utils/pdf/festival-report';
import { formatFrequencyBand, type FrequencyBandSelection } from '@/lib/frequencyBands';
import { extractRfIemScheduleFields, formatRfIemScheduleCell } from '@/utils/rfIemScheduleFields';
import { groupArtistsByFestivalDay } from '@/utils/pdf/rfIemFestivalDays';
import type {
  ArtistRfIemData,
  RawArtistLike,
  RfIemSystemData,
  RfIemTablePdfData,
} from '@/utils/pdf/rfIemTableTypes';

export { formatTimeRange } from '@/utils/rfIemScheduleFields';
export { computeRfIemFestivalDayKey, groupArtistsByFestivalDay } from '@/utils/pdf/rfIemFestivalDays';
export type {
  ArtistRfIemData,
  RawArtistLike,
  RfIemSystemData,
  RfIemTablePdfData,
} from '@/utils/pdf/rfIemTableTypes';

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
    ...extractRfIemScheduleFields(artist),
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

export const FESTIVAL_TEXT_TOKEN = '__FESTIVAL_ITEM__';
export const BAND_TEXT_TOKEN = '__BAND_ITEM__';
export const MIXED_TEXT_TOKEN = '__MIXED_ITEM__';

export const hasProviderTextToken = (value: string): boolean =>
  value.includes(FESTIVAL_TEXT_TOKEN) || value.includes(BAND_TEXT_TOKEN) || value.includes(MIXED_TEXT_TOKEN);

export const stripProviderTextTokens = (value: string): string =>
  value
    .split(FESTIVAL_TEXT_TOKEN).join('')
    .split(BAND_TEXT_TOKEN).join('')
    .split(MIXED_TEXT_TOKEN).join('');

export const splitTokenizedSegments = (
  value: string,
): Array<{ text: string; provider: 'festival' | 'band' | 'mixed' | 'default' }> => {
  const pattern = new RegExp(`(${FESTIVAL_TEXT_TOKEN}|${BAND_TEXT_TOKEN}|${MIXED_TEXT_TOKEN})`);
  const parts = value.split(pattern).filter((part) => part.length > 0);
  const segments: Array<{ text: string; provider: 'festival' | 'band' | 'mixed' | 'default' }> = [];
  let provider: 'festival' | 'band' | 'mixed' | 'default' = 'default';

  for (const part of parts) {
    if (part === FESTIVAL_TEXT_TOKEN) {
      provider = 'festival';
    } else if (part === BAND_TEXT_TOKEN) {
      provider = 'band';
    } else if (part === MIXED_TEXT_TOKEN) {
      provider = 'mixed';
    } else {
      segments.push({ text: part, provider });
      provider = 'default';
    }
  }

  return segments;
};

/** Numeric metrics stay numbers so callers can total them; only tokens are stripped. */
const stripTokens = (value: string | number): string | number =>
  typeof value === 'number' ? value : stripProviderTextTokens(value);

export const buildRfIemTableRow = (artist: ArtistRfIemData): Array<string | number> => [
  artist.name,
  `Escenario ${artist.stage}`,
  formatRfIemScheduleCell(artist),
  getProviderSummary(artist.wirelessSystems),
  stripProviderTextTokens(formatModelWithCounts(artist.wirelessSystems)),
  stripProviderTextTokens(getUniqueFormattedBands(artist.wirelessSystems)),
  stripTokens((formatMetricBreakdownByProvider(artist.wirelessSystems, getRfSystemChannels))),
  stripTokens((formatMetricBreakdownByProvider(artist.wirelessSystems, (system) => system.quantity_hh || 0))),
  stripTokens((formatMetricBreakdownByProvider(artist.wirelessSystems, (system) => system.quantity_bp || 0))),
  getProviderSummary(artist.iemSystems),
  stripProviderTextTokens(formatModelWithCounts(artist.iemSystems)),
  stripProviderTextTokens(getUniqueFormattedBands(artist.iemSystems)),
  stripTokens((formatMetricBreakdownByProvider(artist.iemSystems, (system) => system.quantity_hh || system.quantity || 0))),
  stripTokens((formatMetricBreakdownByProvider(artist.iemSystems, (system) => system.quantity_bp || 0))),
];

/**
 * Eleven columns read as two groups of five are far easier than eleven columns,
 * so RF and IEM sit under spanning headers with a rule between the groups. The
 * page is already landscape — the last resort, not the first.
 */
const GROUP_HEAD = [
  { content: '', colSpan: 3, styles: { halign: 'left' as const } },
  { content: 'Radiofrecuencia', colSpan: 6, styles: { halign: 'left' as const } },
  { content: 'IEM', colSpan: 5, styles: { halign: 'left' as const } },
];
const COLUMN_HEAD = [
  'Artista',
  'Escenario',
  'Horario',
  'Proveedor',
  'Modelos',
  'Bandas',
  'Canales',
  'Mano',
  'Petacas',
  'Proveedor',
  'Modelos',
  'Bandas',
  'Canales',
  'Petacas',
];
const COLUMN_WEIGHTS = [11, 6, 10, 6, 10, 8, 5.5, 4.5, 5, 6, 10, 8, 5.5, 5];
/** First column of the IEM group — it carries the divider rule. */
const IEM_GROUP_START = 9;
const NUMERIC_COLUMNS = [6, 7, 8, 12, 13];

export const exportRfIemTablePDF = async (
  data: RfIemTablePdfData & { paginate?: boolean },
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const normalizedArtists = (data.artists || []).map((artist) =>
    normalizeRfIemArtistInput(artist as RawArtistLike),
  );
  const filteredArtists = normalizedArtists.filter(hasRfIemContent);

  if (filteredArtists.length === 0) {
    throw new Error('No hay datos RF/IEM para los escenarios seleccionados.');
  }

  const dayGroups = groupArtistsByFestivalDay(filteredArtists);
  if (dayGroups.length === 0) {
    throw new Error('No hay datos RF/IEM para los escenarios seleccionados.');
  }

  await loadFestivalIssuerMark();
  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  let dayLabel = dayGroups[0].label;
  const chrome = () =>
    drawFestivalChrome(doc, {
      kind: 'rf',
      eventTitle: data.jobTitle,
      contextLabel: dayLabel,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      paginate: false,
    });

  const geo = chrome();
  const { mm } = geo;

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'RF e IEM  ·  Rev. A',
    title: data.jobTitle,
    subtitle: 'Resumen de radiofrecuencia y monitorización personal',
    clientLogo,
  });

  y = drawFestivalMetaGrid(doc, geo, [
    { label: 'Artistas', value: String(filteredArtists.length) },
    { label: 'Jornadas', value: String(dayGroups.length) },
    { label: 'Sin RF ni IEM', value: String(normalizedArtists.length - filteredArtists.length) },
    { label: 'Emitido', value: new Date().toLocaleDateString('es-ES') },
  ], y);

  dayGroups.forEach((group, index) => {
    dayLabel = group.label;

    if (index > 0) {
      doc.addPage('a4', 'landscape');
      chrome();
      y = geo.contentTop;
    }

    y = drawFestivalSectionHeading(doc, geo, group.label, y, index + 1);

    const rows = group.artists.map(buildRfIemTableRow);
    const theme = festivalTableTheme(geo, { fontSize: 6.6, numericColumns: NUMERIC_COLUMNS });

    autoTable(doc, {
      head: [GROUP_HEAD, COLUMN_HEAD],
      body: rows,
      startY: y,
      ...theme,
      columnStyles: distributeColumnWidths(COLUMN_WEIGHTS, geo.contentWidth),
      margin: {
        left: geo.left,
        right: geo.pageWidth - geo.right,
        top: geo.contentTop,
        bottom: geo.pageHeight - geo.contentBottom,
      },
      rowPageBreak: 'avoid',
      didParseCell: (hookData) => {
        // The spanning row names the groups; it is set in the accent and is not
        // a column header, so it keeps its own left alignment.
        if (hookData.section === 'head' && hookData.row.index === 0) {
          hookData.cell.styles.textColor = FESTIVAL_ACCENT as unknown as [number, number, number];
          hookData.cell.styles.halign = 'left';
          return;
        }
        theme.didParseCell(hookData);
      },
      didDrawCell: (hookData) => {
        theme.didDrawCell(hookData);
        if (hookData.column.index === IEM_GROUP_START && hookData.section !== 'head') {
          doc.setDrawColor(...FESTIVAL_RULE);
          doc.setLineWidth(0.25 * mm);
          doc.line(
            hookData.cell.x - 1 * mm,
            hookData.cell.y,
            hookData.cell.x - 1 * mm,
            hookData.cell.y + hookData.cell.height,
          );
        }
      },
      didDrawPage: () => {
        chrome();
      },
    });

    y = getLastAutoTableY(doc, y) + 2 * mm;
    y = drawFestivalConstantsLine(doc, geo, [
      { label: 'Bandas', value: 'según la declaración del rider, pendientes de coordinación en obra' },
    ], y);
    y += 4 * mm;
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'rf',
      eventTitle: data.jobTitle,
      contextLabel: 'RF e IEM',
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber: page,
      totalPages,
      paginate: data.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};
