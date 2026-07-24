import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import { generateQRCode } from '@/utils/qrcode';
import {
  FESTIVAL_INK,
  FESTIVAL_SOFT,
  distributeColumnWidths,
  drawFestivalChrome,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  festivalTableTheme,
  setFestivalMonoText,
  setFestivalText,
} from '@/utils/pdf/festival-report';

export interface MissingRiderArtist {
  id: string;
  name: string;
  stage: number;
  stageName?: string;
  date: string;
  showTime: {
    start: string;
    end: string;
  };
  formUrl?: string;
  /** 'missing' = no rider received; 'outdated' = rider copied from a past show. */
  status?: 'missing' | 'outdated';
  /** For outdated riders, the source show date the rider was copied from. */
  copiedFromDate?: string;
}

export interface MissingRiderReportData {
  jobTitle: string;
  logoUrl?: string;
  artists: MissingRiderArtist[];
  /** False when the document is bound into a set that stamps its own folios. */
  paginate?: boolean;
}

const ACTION_ITEMS = [
  'Contactar con el artista para solicitar su rider técnico.',
  'Escanear el código QR para abrir su formulario técnico público.',
  'Hacer seguimiento con management o booking si no hay respuesta.',
  'Actualizar el sistema en cuanto se reciba cada rider.',
];

const formatShowDate = (value: string): string => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Sin fecha' : format(parsed, 'EEE, d MMM', { locale: es });
};

const formatStatus = (artist: MissingRiderArtist): string => {
  if (artist.status !== 'outdated') return 'Pendiente';
  if (!artist.copiedFromDate) return 'Desactualizado';
  const parsed = parseISO(artist.copiedFromDate);
  return Number.isNaN(parsed.getTime())
    ? 'Desactualizado'
    : `Desactualizado (de ${format(parsed, 'd MMM', { locale: es })})`;
};

export const exportMissingRiderReportPDF = async (data: MissingRiderReportData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  const chrome = () =>
    drawFestivalChrome(doc, {
      kind: 'riders',
      eventTitle: data.jobTitle,
      contextLabel: 'Riders pendientes',
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      paginate: false,
    });

  const geo = chrome();
  const { mm } = geo;

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'Riders pendientes  ·  Rev. A',
    title: data.jobTitle,
    subtitle: 'Riders técnicos no recibidos o copiados de una fecha anterior',
    clientLogo,
  });

  const missing = data.artists.filter((artist) => artist.status !== 'outdated').length;
  const outdated = data.artists.length - missing;

  y = drawFestivalMetaGrid(doc, geo, [
    { label: 'Pendientes', value: String(missing) },
    { label: 'Desactualizados', value: String(outdated) },
    { label: 'Total', value: String(data.artists.length) },
    { label: 'Emitido', value: format(new Date(), 'dd/MM/yyyy') },
  ], y);

  if (data.artists.length === 0) {
    drawFestivalNilState(
      doc,
      geo,
      y,
      'Todos los artistas tienen su rider técnico completo y vigente. No hay ninguna acción pendiente.',
    );
  } else {
    const qrCodes = await Promise.all(
      data.artists.map(async (artist) => {
        if (!artist.formUrl) return null;
        try {
          return await generateQRCode(artist.formUrl);
        } catch (error) {
          console.warn(`No se pudo generar el QR de ${artist.name}:`, error);
          return null;
        }
      }),
    );

    y = drawFestivalSectionHeading(doc, geo, 'Artistas afectados', y, 1);

    const rows = data.artists.map((artist, index) => [
      artist.name,
      artist.stageName || `Escenario ${artist.stage}`,
      formatShowDate(artist.date),
      formatStatus(artist),
      qrCodes[index] ? '' : 'Sin formulario',
    ]);

    autoTable(doc, {
      head: [['Artista', 'Escenario', 'Fecha', 'Estado', 'Formulario']],
      body: rows,
      startY: y,
      ...festivalTableTheme(geo, { fontSize: 7.8 }),
      bodyStyles: { minCellHeight: 16 * mm },
      columnStyles: distributeColumnWidths([30, 24, 18, 28, 22], geo.contentWidth),
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
      didDrawCell: (hookData) => {
        if (hookData.section !== 'body' || hookData.column.index !== 4) return;
        const qrDataUrl = qrCodes[hookData.row.index];
        if (!qrDataUrl) return;

        const size = Math.min(hookData.cell.width - 4 * mm, hookData.cell.height - 3 * mm, 14 * mm);
        const x = hookData.cell.x + (hookData.cell.width - size) / 2;
        const qrY = hookData.cell.y + 1.5 * mm;
        doc.addImage(qrDataUrl, 'PNG', x, qrY, size, size);

        const formUrl = data.artists[hookData.row.index]?.formUrl;
        if (formUrl) doc.link(x, qrY, size, size, { url: formUrl });
      },
    });

    y = getLastAutoTableY(doc, y) + 10 * mm;

    if (y + 34 * mm > geo.contentBottom) {
      doc.addPage();
      chrome();
      y = geo.contentTop;
    }

    y = drawFestivalSectionHeading(doc, geo, 'Acción requerida', y, 2);
    ACTION_ITEMS.forEach((item, index) => {
      setFestivalMonoText(doc, FESTIVAL_SOFT, 6, 'bold');
      doc.text(String(index + 1).padStart(2, '0'), geo.left, y);
      setFestivalText(doc, FESTIVAL_INK, 7.6);
      const lines = doc.splitTextToSize(item, geo.contentWidth - 9 * mm) as string[];
      doc.text(lines, geo.left + 9 * mm, y, { lineHeightFactor: 1.25 });
      y += lines.length * 3.4 * mm + 2.4 * mm;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'riders',
      eventTitle: data.jobTitle,
      contextLabel: 'Riders pendientes',
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber: page,
      totalPages,
      paginate: data.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};
