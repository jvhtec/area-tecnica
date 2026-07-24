import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import {
  FESTIVAL_ACCENT,
  FESTIVAL_FAINT,
  FESTIVAL_MATRIX_ZERO,
  distributeColumnWidths,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  festivalTableTheme,
} from '@/utils/pdf/festival-report';

export interface WiredMicrophoneMatrixData {
  jobTitle: string;
  logoUrl?: string;
  artistsByDateAndStage: Map<string, Map<number, any[]>>;
  /** False when the document is bound into a set that stamps its own folios. */
  paginate?: boolean;
}

interface MatrixData {
  micModels: string[];
  artistNames: string[];
  quantities: Record<string, Record<string, number>>;
  /** Largest single-artist requirement — the constraint when shows are sequential. */
  peak: Record<string, number>;
  /** Sum across the whole day — the constraint only if everything is out at once. */
  total: Record<string, number>;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const formatMatrixDate = (dateString: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const [year, month, day] = dateString.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return `${WEEKDAYS[date.getDay()]}, ${Number(day)} de ${MONTHS[date.getMonth()]} de ${year}`;
};

/**
 * Builds the model × artist matrix.
 *
 * Two bases are reported because they differ by a lot and a reader cannot tell
 * which one they are looking at: `peak` is the largest single-artist demand
 * (shows are sequential, so this is what the stage must hold at any moment) and
 * `total` is the sum across the day.
 */
export const buildWiredMicrophoneMatrix = (artists: any[]): MatrixData => {
  const micModels = new Set<string>();
  const artistNames: string[] = [];
  const quantities: Record<string, Record<string, number>> = {};

  artists.forEach((artist, index) => {
    const artistName = artist?.name || `Artista ${index + 1}`;
    if (!artistNames.includes(artistName)) artistNames.push(artistName);
    if (!Array.isArray(artist?.wired_mics)) return;

    for (const entry of artist.wired_mics) {
      if (!entry || typeof entry !== 'object') continue;
      const model = String(entry.model ?? '').trim();
      const quantity = Number.parseInt(String(entry.quantity ?? 0), 10);
      if (!model || !Number.isFinite(quantity) || quantity <= 0) continue;

      micModels.add(model);
      quantities[model] ??= {};
      quantities[model][artistName] = (quantities[model][artistName] ?? 0) + quantity;
    }
  });

  const peak: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const model of micModels) {
    const perArtist = Object.values(quantities[model] ?? {});
    peak[model] = perArtist.length > 0 ? Math.max(...perArtist) : 0;
    total[model] = perArtist.reduce((sum, quantity) => sum + quantity, 0);
  }

  return {
    micModels: [...micModels].sort(),
    artistNames: artistNames.sort(),
    quantities,
    peak,
    total,
  };
};

export const exportWiredMicrophoneMatrixPDF = async (
  data: WiredMicrophoneMatrixData,
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  let context = '';
  const chrome = () =>
    drawFestivalChrome(doc, {
      kind: 'mics',
      eventTitle: data.jobTitle,
      contextLabel: context,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      paginate: false,
    });

  const geo = chrome();
  const { mm } = geo;

  const sections = [...data.artistsByDateAndStage.entries()].flatMap(([date, stages]) =>
    [...stages.entries()].map(([stage, artists]) => ({ date, stage, artists })),
  );

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'Microfonía cableada  ·  Rev. A',
    title: data.jobTitle,
    subtitle: 'Matriz de necesidades por modelo y artista',
    clientLogo,
  });

  const allArtists = sections.reduce((sum, section) => sum + section.artists.length, 0);
  y = drawFestivalMetaGrid(doc, geo, [
    { label: 'Jornadas', value: String(data.artistsByDateAndStage.size) },
    { label: 'Bloques', value: String(sections.length) },
    { label: 'Artistas', value: String(allArtists) },
    { label: 'Base', value: 'Pico y total' },
  ], y);

  if (sections.length === 0) {
    drawFestivalNilState(
      doc,
      geo,
      y,
      'Ningún artista solicita microfonía cableada del festival. Requerimiento confirmado como ninguno, no pendiente de rider.',
    );
  }

  sections.forEach((section, index) => {
    context = `${formatMatrixDate(section.date)} · Escenario ${section.stage}`;

    if (index > 0) {
      doc.addPage();
      chrome();
      y = geo.contentTop;
    }

    y = drawFestivalSectionHeading(doc, geo, context, y, index + 1);

    const matrix = buildWiredMicrophoneMatrix(section.artists);

    if (matrix.micModels.length === 0) {
      y = drawFestivalNilState(
        doc,
        geo,
        y,
        'Sin requerimientos de microfonía cableada en este bloque. Requerimiento confirmado como ninguno.',
      );
      return;
    }

    const head = ['Modelo', ...matrix.artistNames, 'Pico', 'Total'];
    const rows = matrix.micModels.map((model) => [
      model,
      ...matrix.artistNames.map((artist) => {
        const quantity = matrix.quantities[model]?.[artist] ?? 0;
        return quantity > 0 ? String(quantity) : FESTIVAL_MATRIX_ZERO;
      }),
      String(matrix.peak[model] ?? 0),
      String(matrix.total[model] ?? 0),
    ]);

    const peakColumn = head.length - 2;
    const totalColumn = head.length - 1;
    const highestPeak = Math.max(1, ...matrix.micModels.map((model) => matrix.peak[model] ?? 0));

    const artistWeight = Math.max(8, 90 / Math.max(matrix.artistNames.length, 1));
    const weights = [34, ...matrix.artistNames.map(() => artistWeight), 14, 14];

    const theme = festivalTableTheme(geo, {
      fontSize: 7,
      numericColumns: [
        ...matrix.artistNames.map((_, column) => column + 1),
        peakColumn,
        totalColumn,
      ],
    });

    autoTable(doc, {
      head: [head],
      body: rows,
      startY: y,
      ...theme,
      columnStyles: distributeColumnWidths(weights, geo.contentWidth),
      margin: {
        left: geo.left,
        right: geo.pageWidth - geo.right,
        top: geo.contentTop,
        bottom: geo.pageHeight - geo.contentBottom,
      },
      rowPageBreak: 'avoid',
      didParseCell: (hookData) => {
        theme.didParseCell(hookData);
        if (hookData.section === 'body' && hookData.cell.text[0] === FESTIVAL_MATRIX_ZERO) {
          hookData.cell.styles.textColor = FESTIVAL_FAINT as unknown as [number, number, number];
        }
      },
      willDrawCell: (hookData) => {
        // The peak bar is the one place the accent fills an area here, and it
        // earns it because the length of the fill is itself the datum.
        if (hookData.section !== 'body' || hookData.column.index !== peakColumn) return;
        const value = Number.parseInt(hookData.cell.text[0] ?? '0', 10);
        if (!Number.isFinite(value) || value <= 0) return;

        const barWidth = (hookData.cell.width - 2 * mm) * (value / highestPeak);
        doc.setFillColor(238, 214, 214);
        doc.rect(
          hookData.cell.x + hookData.cell.width - 1 * mm - barWidth,
          hookData.cell.y + 0.8 * mm,
          barWidth,
          hookData.cell.height - 1.6 * mm,
          'F',
        );
      },
      didDrawCell: (hookData) => {
        theme.didDrawCell(hookData);
        // A 1 px rule separates the summary columns from the artist columns.
        if (hookData.column.index === peakColumn) {
          doc.setDrawColor(...FESTIVAL_ACCENT);
          doc.setLineWidth(0.25 * mm);
          doc.line(
            hookData.cell.x,
            hookData.cell.y,
            hookData.cell.x,
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
      { label: 'Pico', value: 'mayor demanda de un solo artista — los shows son consecutivos' },
      { label: 'Total', value: 'suma de la jornada' },
    ], y);
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'mics',
      eventTitle: data.jobTitle,
      contextLabel: 'Microfonía cableada',
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber: page,
      totalPages,
      paginate: data.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};

/** Groups artists by date and then by stage, skipping records with no date. */
export const organizeArtistsByDateAndStage = (
  artists: any[],
): Map<string, Map<number, any[]>> => {
  const organized = new Map<string, Map<number, any[]>>();

  for (const artist of artists) {
    const date = artist?.date;
    if (!date) {
      console.warn(`Se omite "${artist?.name}" en la matriz de microfonía: no tiene fecha.`);
      continue;
    }

    const stage = artist.stage || 1;
    if (!organized.has(date)) organized.set(date, new Map());
    const stages = organized.get(date)!;
    if (!stages.has(stage)) stages.set(stage, []);
    stages.get(stage)!.push(artist);
  }

  return organized;
};
