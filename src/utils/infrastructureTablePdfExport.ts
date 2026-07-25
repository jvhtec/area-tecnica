import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
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
  drawFestivalTotalsRule,
  dropConstantColumns,
  FESTIVAL_INK,
  FESTIVAL_MATRIX_ZERO,
  FESTIVAL_SOFT,
  festivalTableTheme,
  loadFestivalIssuerMark,
  setFestivalMonoText,
  setFestivalText,
} from '@/utils/pdf/festival-report';

export interface InfrastructureItemData {
  type: 'cat6' | 'hma' | 'coax' | 'opticalcon_duo' | 'analog';
  enabled?: boolean;
  quantity: number;
}

export interface ArtistInfrastructureData {
  name: string;
  stage: number;
  providedBy: string;
  cat6: { enabled: boolean; quantity: number };
  hma: { enabled: boolean; quantity: number };
  coax: { enabled: boolean; quantity: number };
  opticalconDuo: { enabled: boolean; quantity: number };
  analog: number;
  other: string;
}

export interface InfrastructureTablePdfData {
  jobTitle: string;
  logoUrl?: string;
  artists: ArtistInfrastructureData[];
}

type RawInfrastructureArtist = Partial<ArtistInfrastructureData> & {
  infrastructure_provided_by?: string;
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProvider = (value: unknown): string => {
  if (value === 'festival') return 'Festival';
  if (value === 'band') return 'Banda';
  if (value === 'mixed') return 'Mixto';
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return 'Festival';
};

const asItem = (enabled: unknown, quantity: unknown, fallbackEnabled: unknown, fallbackQuantity: unknown) => ({
  enabled: Boolean(enabled ?? fallbackEnabled),
  quantity: toNumber(quantity ?? fallbackQuantity),
});

export const normalizeInfrastructureArtistInput = (artist: RawInfrastructureArtist): ArtistInfrastructureData => {
  return {
    name: typeof artist.name === 'string' && artist.name.trim().length > 0 ? artist.name : 'Unnamed Artist',
    stage: toNumber(artist.stage, 1),
    providedBy: normalizeProvider(artist.providedBy ?? artist.infrastructure_provided_by),
    cat6: asItem(artist.cat6?.enabled, artist.cat6?.quantity, artist.infra_cat6, artist.infra_cat6_quantity),
    hma: asItem(artist.hma?.enabled, artist.hma?.quantity, artist.infra_hma, artist.infra_hma_quantity),
    coax: asItem(artist.coax?.enabled, artist.coax?.quantity, artist.infra_coax, artist.infra_coax_quantity),
    opticalconDuo: asItem(
      artist.opticalconDuo?.enabled,
      artist.opticalconDuo?.quantity,
      artist.infra_opticalcon_duo,
      artist.infra_opticalcon_duo_quantity,
    ),
    analog: toNumber(artist.analog ?? artist.infra_analog),
    other: typeof artist.other === 'string'
      ? artist.other
      : typeof artist.other_infrastructure === 'string'
        ? artist.other_infrastructure
        : '',
  };
};

export const hasInfrastructureContent = (artist: ArtistInfrastructureData): boolean => {
  return (
    artist.cat6.enabled ||
    artist.hma.enabled ||
    artist.coax.enabled ||
    artist.opticalconDuo.enabled ||
    artist.analog > 0 ||
    artist.other.trim().length > 0
  );
};

export interface InfrastructureTablePdfOptions {
  /** False when the document is bound into a set that stamps its own folios. */
  paginate?: boolean;
}

const TABLE_HEAD = [
  'Artista',
  'Escenario',
  'Proporcionado por',
  'CAT6',
  'HMA',
  'Coax',
  'OpticalCON DUO',
  'Analógicas',
  'Otros',
];
const TABLE_WEIGHTS = [26, 12, 15, 8, 8, 8, 13, 10, 16];
const NUMERIC_HEADS = new Set(['CAT6', 'HMA', 'Coax', 'OpticalCON DUO', 'Analógicas']);

const quantityCell = (enabled: boolean, quantity: number): string =>
  enabled && quantity > 0 ? String(quantity) : FESTIVAL_MATRIX_ZERO;

export const exportInfrastructureTablePDF = async (
  data: InfrastructureTablePdfData & InfrastructureTablePdfOptions,
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const normalizedArtists = (data.artists || []).map((artist) =>
    normalizeInfrastructureArtistInput(artist as RawInfrastructureArtist),
  );

  if (normalizedArtists.length === 0) {
    throw new Error('No hay artistas para generar la tabla de infraestructura.');
  }

  const artistsByStage = new Map<number, ArtistInfrastructureData[]>();
  for (const artist of normalizedArtists) {
    if (!artistsByStage.has(artist.stage)) artistsByStage.set(artist.stage, []);
    artistsByStage.get(artist.stage)?.push(artist);
  }
  const stageNumbers = [...artistsByStage.keys()].sort((a, b) => a - b);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await loadFestivalIssuerMark();
  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  let currentStage = stageNumbers[0];
  const chrome = () =>
    drawFestivalChrome(doc, {
      kind: 'infra',
      eventTitle: data.jobTitle,
      contextLabel: `Escenario ${currentStage}`,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      paginate: false,
    });

  const geo = chrome();
  const { mm } = geo;

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'Infraestructura  ·  Rev. A',
    title: data.jobTitle,
    subtitle: 'Necesidades de tiradas por artista',
    clientLogo,
  });

  const withRequirements = normalizedArtists.filter(hasInfrastructureContent);
  y = drawFestivalMetaGrid(doc, geo, [
    { label: 'Artistas', value: String(normalizedArtists.length) },
    { label: 'Escenarios', value: String(stageNumbers.length) },
    { label: 'Con tiradas', value: String(withRequirements.length) },
    { label: 'Sin tiradas', value: String(normalizedArtists.length - withRequirements.length) },
  ], y);

  if (withRequirements.length === 0) {
    y = drawFestivalNilState(
      doc,
      geo,
      y,
      'Ningún artista solicita tiradas de infraestructura. Requerimiento confirmado como ninguno, no pendiente de rider.',
    );
  }

  stageNumbers.forEach((stageNum, index) => {
    currentStage = stageNum;
    const stageArtists = artistsByStage.get(stageNum) ?? [];

    if (index > 0) {
      doc.addPage();
      chrome();
      y = geo.contentTop;
    }

    y = drawFestivalSectionHeading(doc, geo, `Escenario ${stageNum}`, y, index + 1);

    const rows = stageArtists.map((artist) => [
      artist.name,
      `Escenario ${artist.stage}`,
      artist.providedBy,
      quantityCell(artist.cat6.enabled, artist.cat6.quantity),
      quantityCell(artist.hma.enabled, artist.hma.quantity),
      quantityCell(artist.coax.enabled, artist.coax.quantity),
      quantityCell(artist.opticalconDuo.enabled, artist.opticalconDuo.quantity),
      artist.analog > 0 ? String(artist.analog) : FESTIVAL_MATRIX_ZERO,
      artist.other || FESTIVAL_MATRIX_ZERO,
    ]);

    const trimmed = dropConstantColumns(TABLE_HEAD, rows, { protect: [0] });
    const weights = trimmed.keptIndexes.map((column) => TABLE_WEIGHTS[column]);
    const numericColumns = trimmed.head
      .map((head, column) => (NUMERIC_HEADS.has(head) ? column : -1))
      .filter((column) => column >= 0);

    autoTable(doc, {
      head: [trimmed.head],
      body: trimmed.rows,
      startY: y,
      ...festivalTableTheme(geo, { fontSize: 7.6, numericColumns }),
      columnStyles: distributeColumnWidths(weights, geo.contentWidth),
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
    });

    y = getLastAutoTableY(doc, y);

    // AutoTable stops within its own bottom margin, but the totals rule, the
    // totals line and the constants below it are drawn unconditionally — so
    // they get their own space check before anything is put on the page.
    const totalsBlockHeight = 18 * mm;
    if (y + totalsBlockHeight > geo.contentBottom) {
      doc.addPage();
      chrome();
      y = geo.contentTop;
    }

    // Totals row: units are stated once here, never on every cell.
    const totals = {
      cat6: stageArtists.reduce((sum, artist) => sum + (artist.cat6.enabled ? artist.cat6.quantity : 0), 0),
      hma: stageArtists.reduce((sum, artist) => sum + (artist.hma.enabled ? artist.hma.quantity : 0), 0),
      coax: stageArtists.reduce((sum, artist) => sum + (artist.coax.enabled ? artist.coax.quantity : 0), 0),
      optical: stageArtists.reduce((sum, artist) => sum + (artist.opticalconDuo.enabled ? artist.opticalconDuo.quantity : 0), 0),
      analog: stageArtists.reduce((sum, artist) => sum + artist.analog, 0),
    };

    drawFestivalTotalsRule(doc, geo, y);
    setFestivalText(doc, FESTIVAL_INK, 7.6, 'bold');
    doc.text('Total de tiradas', geo.left, y + 4.6 * mm);
    setFestivalMonoText(doc, FESTIVAL_INK, 7.4, 'bold');
    doc.text(
      `CAT6 ${totals.cat6}   ·   HMA ${totals.hma}   ·   COAX ${totals.coax}   ·   OPTICALCON ${totals.optical}   ·   ANALÓGICAS ${totals.analog}`,
      geo.right,
      y + 4.6 * mm,
      { align: 'right' },
    );
    y += 8 * mm;

    y = drawFestivalConstantsLine(doc, geo, trimmed.constants, y);
    y += 4 * mm;
  });

  setFestivalMonoText(doc, FESTIVAL_SOFT, 5.6);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'infra',
      eventTitle: data.jobTitle,
      contextLabel: 'Infraestructura',
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber: page,
      totalPages,
      paginate: data.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};
