import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getLastAutoTableY } from '@/utils/pdf/exportHelpers';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import {
  distributeColumnWidths,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalTitleBlock,
  festivalTableTheme,
  loadFestivalIssuerMark,
} from '@/utils/pdf/festival-report';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';

// Artist data interface for full schedule export
export interface FullScheduleArtist {
  name: string;
  date: string;
  stage: number;
  load_in_time?: string;
  show_start: string;
  show_end: string;
  soundcheck_start?: string;
  soundcheck_end?: string;
  soundcheck: boolean;
  line_check?: boolean;
  line_check_start?: string;
  line_check_end?: string;
}

export interface FullFestivalSchedulePdfData {
  jobTitle: string;
  artists: FullScheduleArtist[];
  stageNames?: Record<number, string>;
  logoUrl?: string;
  /** False when the document is bound into a set that stamps its own folios. */
  paginate?: boolean;
}

const TABLE_HEAD = ['Fecha', 'Día', 'Artista', 'Escenario', 'Carga', 'Show', 'Prueba', 'Line check'];
const TABLE_WEIGHTS = [18, 20, 54, 24, 16, 26, 24, 24];

/** A window that was not scheduled reads as an em dash, never as a blank cell. */
const timeWindow = (start?: string, end?: string, enabled = true): string =>
  enabled && start && end ? `${start} – ${end}` : '—';

export const exportFullFestivalSchedulePDF = async (
  data: FullFestivalSchedulePdfData,
): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  await loadFestivalIssuerMark();
  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  const sortedArtists = data.artists
    .filter((artist) => artist.show_start)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.show_start.localeCompare(b.show_start);
    });

  const uniqueDates = [...new Set(sortedArtists.map((artist) => artist.date))];
  const uniqueStages = [...new Set(sortedArtists.map((artist) => artist.stage))];
  const stageName = (stage: number): string => data.stageNames?.[stage] || `Escenario ${stage}`;

  const period = uniqueDates.length
    ? `${format(new Date(uniqueDates[0]), 'dd/MM/yyyy')} – ${format(
        new Date(uniqueDates[uniqueDates.length - 1]),
        'dd/MM/yyyy',
      )}`
    : 'Sin fechas';

  const chrome = (pageNumber?: number, totalPages?: number) =>
    drawFestivalChrome(doc, {
      kind: 'programme',
      kindLabel: 'Programa completo',
      eventTitle: data.jobTitle,
      contextLabel: period,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber,
      totalPages,
      paginate: data.paginate !== false,
    });

  const geo = chrome();

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'Programa completo del festival  ·  Rev. A',
    title: data.jobTitle,
    subtitle: period,
    clientLogo,
  });

  y = drawFestivalMetaGrid(doc, geo, [
    { label: 'Jornadas', value: String(uniqueDates.length) },
    { label: 'Actuaciones', value: String(sortedArtists.length) },
    { label: 'Escenarios', value: String(uniqueStages.length) },
    { label: 'Periodo', value: period },
  ], y);

  if (sortedArtists.length === 0) {
    drawFestivalNilState(
      doc,
      geo,
      y,
      'No hay actuaciones con horario de show confirmado. El programa está confirmado como vacío, no pendiente de planificación.',
    );
  } else {
    const body = sortedArtists.map((artist) => [
      format(new Date(artist.date), 'dd/MM/yy'),
      format(new Date(artist.date), 'EEEE', { locale: es }),
      artist.name,
      stageName(artist.stage),
      artist.load_in_time || '—',
      timeWindow(artist.show_start, artist.show_end),
      timeWindow(artist.soundcheck_start, artist.soundcheck_end, artist.soundcheck),
      timeWindow(artist.line_check_start, artist.line_check_end, artist.line_check),
    ]);

    autoTable(doc, {
      head: [TABLE_HEAD],
      body,
      startY: y,
      ...festivalTableTheme(geo, { fontSize: 6.8, numericColumns: [0, 4, 5, 6, 7] }),
      columnStyles: distributeColumnWidths(TABLE_WEIGHTS, geo.contentWidth),
      margin: {
        left: geo.left,
        right: geo.pageWidth - geo.right,
        top: geo.contentTop,
        bottom: geo.pageHeight - geo.contentBottom,
      },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) chrome();
      },
    });

    // The stages are the same on every row of a given day; naming them once
    // under the table keeps them out of the reader's way but still on the page.
    drawFestivalConstantsLine(
      doc,
      geo,
      [
        { label: 'Escenarios', value: uniqueStages.map(stageName).join('  ·  ') },
        { label: 'Actuaciones', value: String(sortedArtists.length) },
        { label: 'Generado', value: new Date().toLocaleDateString('es-ES') },
      ],
      getLastAutoTableY(doc, y) + 2,
    );
  }

  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    chrome(pageNumber, totalPages);
  }

  return doc.output('blob');
};
