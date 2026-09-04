import { GearMismatch, EquipmentNeeds } from './gearComparisonService';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import {
  BAND_TEXT_TOKEN,
  FESTIVAL_TEXT_TOKEN,
  MIXED_TEXT_TOKEN,
  type WirelessSystemPdf,
  formatInfrastructureForPdf,
  formatWiredMicsForPdf,
  formatWirelessSystemsForPdf,
} from '@/utils/pdf/artistTableFormatters';
import {
  distributeColumnWidths,
  drawEquipmentNeedsSection,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalFlag,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalSectionHeading,
  drawFestivalTimeline,
  drawFestivalTitleBlock,
  dropConstantColumns,
  FESTIVAL_INK,
  FESTIVAL_SOFT,
  festivalTableTheme,
  loadFestivalIssuerMark,
  setFestivalMonoText,
  setFestivalText,
  toWindowOffset,
  type FestivalGeometry,
  type TimelineFinding,
} from '@/utils/pdf/festival-report';

export interface ArtistTablePdfData {
  jobTitle: string;
  date: string;
  stage?: string;
  stageNames?: Record<number, string>;
  artists: Array<{
    name: string;
    stage: number;
    loadInTime?: string;
    showTime: { start: string; end: string };
    soundcheck?: { start: string; end: string };
    lineCheck?: { start: string; end: string };
    technical: {
      fohTech: boolean;
      monTech: boolean;
      // `model` / `providedBy` come from nullable `festival_artists` columns.
      fohConsole: { model: string | null; providedBy?: string | null };
      monConsole: { model: string | null; providedBy?: string | null };
      monitorsFromFoh?: boolean;
      fohWavesOutboard?: string;
      monWavesOutboard?: string;
      wireless: { systems: WirelessSystemPdf[]; providedBy?: string | null };
      iem: { systems: WirelessSystemPdf[]; providedBy?: string | null };
      monitors: { enabled: boolean; quantity: number };
    };
    extras: { sideFill: boolean; drumFill: boolean; djBooth: boolean };
    notes?: string;
    micKit: 'festival' | 'band' | 'mixed';
    wiredMics: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }>;
    infrastructure: {
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
      infrastructure_provided_by?: string;
    };
    riderMissing: boolean;
    gearMismatches?: GearMismatch[];
  }>;
  logoUrl?: string | null;
  includeGearConflicts?: boolean;
  equipmentNeeds?: EquipmentNeeds;
  /** False when the document is bound into a set that stamps its own folios. */
  paginate?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  festival: 'Festival',
  band: 'Banda',
  mixed: 'Mixto',
};

const stripProviderTokens = (value: string): string =>
  value
    .split(FESTIVAL_TEXT_TOKEN).join('')
    .split(BAND_TEXT_TOKEN).join('')
    .split(MIXED_TEXT_TOKEN).join('');

const formatConsole = (
  console: { model: string | null; providedBy?: string | null },
  techRequired: boolean,
  position: string,
): string => {
  const providedBy = console.providedBy ?? 'festival';
  const provider = PROVIDER_LABELS[providedBy] ?? providedBy;
  const tech = techRequired ? ' + técnico' : '';
  return `${position}: ${console.model || '—'} (${provider})${tech}`;
};

const formatConsoleSection = (technical: ArtistTablePdfData['artists'][number]['technical']): string => {
  const lines = [formatConsole(technical.fohConsole, technical.fohTech, 'FOH')];
  if (technical.fohWavesOutboard?.trim()) lines.push(`FOH W/O: ${technical.fohWavesOutboard.trim()}`);

  if (technical.monitorsFromFoh) {
    lines.push('MON: desde FOH');
  } else {
    lines.push(formatConsole(technical.monConsole, technical.monTech, 'MON'));
    if (technical.monWavesOutboard?.trim()) lines.push(`MON W/O: ${technical.monWavesOutboard.trim()}`);
  }
  return lines.join('\n');
};

const formatTimeRange = (range?: { start: string; end: string }): string =>
  range && (range.start || range.end) ? `${range.start || '—'} – ${range.end || '—'}` : '—';

const formatMismatches = (mismatches: GearMismatch[] = []): string => {
  if (mismatches.length === 0) return 'Correcto';
  const errors = mismatches.filter((mismatch) => mismatch.severity === 'error').length;
  const warnings = mismatches.filter((mismatch) => mismatch.severity === 'warning').length;
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 'es'}`);
  if (warnings > 0) parts.push(`${warnings} aviso${warnings === 1 ? '' : 's'}`);
  return parts.join(', ');
};

const formatMicrophones = (artist: ArtistTablePdfData['artists'][number]): string => {
  if (artist.micKit === 'mixed') {
    return `Kit mixto\nFestival: ${formatWiredMicsForPdf(artist.wiredMics, artist.micKit)}`;
  }
  if (artist.micKit === 'festival') {
    return `Kit del festival\n${formatWiredMicsForPdf(artist.wiredMics, artist.micKit)}`;
  }
  return 'Kit de la banda';
};

const TABLE_HEAD = [
  'Artista',
  'Carga',
  'Show',
  'Prueba',
  'Line check',
  'Consolas',
  'RF / IEM',
  'Microfonía',
  'Monitores',
  'Infraestructura',
  'Extras',
  'Notas',
  'Rider',
  'Material',
];
const TABLE_WEIGHTS = [24, 13, 18, 17, 17, 32, 32, 27, 12, 20, 12, 24, 13, 16];
/** Artist, show and soundcheck never leave the table, even if they are uniform. */
const PROTECTED_COLUMNS = [0, 2, 3];

export const exportArtistTablePDF = async (data: ArtistTablePdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const stageName = data.stage && data.stage !== 'all'
    ? data.stageNames?.[Number.parseInt(data.stage, 10)] || `Escenario ${data.stage}`
    : 'Todos los escenarios';
  const showDate = new Date(data.date);
  const dateLabel = Number.isNaN(showDate.getTime())
    ? data.date
    : showDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  await loadFestivalIssuerMark();
  const clientLogo = data.logoUrl
    ? await loadImageWithTimeout(data.logoUrl, 'logotipo del festival')
    : null;

  const chrome = (): FestivalGeometry =>
    drawFestivalChrome(doc, {
      kind: 'programme',
      eventTitle: data.jobTitle,
      contextLabel: `${stageName} · ${dateLabel}`,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      paginate: false,
    });

  const geo = chrome();
  const { mm } = geo;

  let y = drawFestivalTitleBlock(doc, geo, {
    eyebrow: 'Programa del día  ·  Rev. A',
    title: data.jobTitle,
    subtitle: `${stageName} · ${dateLabel}`,
    clientLogo,
  });

  // Ordered along the programme day, not by clock string: a 01:00 show is the
  // last of the night, not the first of the morning.
  const showTimes = data.artists
    .map((artist) => artist.showTime?.start)
    .filter((value): value is string => Boolean(value))
    .map((start) => ({ start, offset: toWindowOffset(start) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.offset - b.offset)
    .map((entry) => entry.start);
  const pendingRiders = data.artists.filter((artist) => artist.riderMissing).length;

  y = drawFestivalMetaGrid(doc, geo, [
    { label: 'Artistas', value: String(data.artists.length) },
    { label: 'Primer show', value: showTimes[0] ?? '—' },
    { label: 'Último show', value: showTimes[showTimes.length - 1] ?? '—' },
    { label: 'Riders pendientes', value: pendingRiders > 0 ? String(pendingRiders) : 'Ninguno' },
  ], y);

  const ensureSpace = (required: number, current: number): number => {
    if (current + required <= geo.contentBottom) return current;
    doc.addPage();
    chrome();
    return geo.contentTop;
  };

  // --- 01 · Day programme -------------------------------------------------
  y = drawFestivalSectionHeading(doc, geo, 'Programa de la jornada', y, 1);

  if (data.artists.length === 0) {
    y = drawFestivalNilState(
      doc,
      geo,
      y,
      'No hay artistas programados en este escenario para esta fecha. Confirmado como jornada sin actividad, no pendiente de datos.',
    );
  } else {
    const laneHeight = data.artists.length > 12 ? 4.4 : 5.4;
    // Hour scale above the lanes and the key below, neither of which scales
    // with the number of artists.
    const timelineFurniture = 12 * mm;

    let remaining = data.artists.map((artist) => ({
      name: artist.name,
      show: artist.showTime,
      soundcheck: artist.soundcheck,
    }));
    const findings: TimelineFinding[] = [];
    const skipped: string[] = [];

    // A day with many artists is drawn across as many pages as it needs rather
    // than running the lanes down through the footer.
    while (remaining.length > 0) {
      const available = geo.contentBottom - y - timelineFurniture;
      const lanesThatFit = Math.floor(available / (laneHeight * mm));

      if (lanesThatFit < 1) {
        doc.addPage();
        chrome();
        y = geo.contentTop;
        continue;
      }

      const chunk = remaining.slice(0, lanesThatFit);
      remaining = remaining.slice(lanesThatFit);

      const timeline = drawFestivalTimeline(doc, geo, { entries: chunk, y, laneHeight });
      y = timeline.y;
      findings.push(...timeline.findings);
      skipped.push(...timeline.skipped);
    }

    for (const finding of findings) {
      y = ensureSpace(18 * mm, y);
      y = drawFestivalFlag(doc, geo, y, {
        label: finding.label,
        text: `${finding.name}: ${finding.message}`,
      });
    }

    if (skipped.length > 0) {
      y = ensureSpace(18 * mm, y);
      y = drawFestivalFlag(doc, geo, y, {
        label: 'Revisar',
        text: `Sin horarios registrados: ${skipped.join(', ')}. No aparecen en el gráfico hasta que se introduzcan.`,
      });
    }
  }

  // --- 02 · Detail table --------------------------------------------------
  const rows = data.artists.map((artist) => [
    artist.name,
    artist.loadInTime || '—',
    `${artist.showTime.start || '—'} – ${artist.showTime.end || '—'}`,
    formatTimeRange(artist.soundcheck),
    formatTimeRange(artist.lineCheck),
    formatConsoleSection(artist.technical),
    stripProviderTokens(
      `RF: ${formatWirelessSystemsForPdf(artist.technical.wireless.systems, artist.technical.wireless.providedBy ?? undefined)}\nIEM: ${formatWirelessSystemsForPdf(artist.technical.iem.systems, artist.technical.iem.providedBy ?? undefined, true)}`,
    ),
    formatMicrophones(artist),
    artist.technical.monitors.enabled ? `${artist.technical.monitors.quantity}` : 'Ninguno',
    formatInfrastructureForPdf(artist.infrastructure),
    [
      artist.extras.sideFill ? 'SF' : '',
      artist.extras.drumFill ? 'DF' : '',
      artist.extras.djBooth ? 'DJ' : '',
    ].filter(Boolean).join(', ') || 'Ninguno',
    artist.notes || 'Sin notas',
    artist.riderMissing ? 'Pendiente' : 'Completo',
    formatMismatches(artist.gearMismatches),
  ]);

  const trimmed = dropConstantColumns(TABLE_HEAD, rows, { protect: PROTECTED_COLUMNS });
  const weights = trimmed.keptIndexes.map((index) => TABLE_WEIGHTS[index]);

  if (rows.length > 0) {
    y = drawFestivalSectionHeading(doc, geo, 'Detalle por artista', y + 2 * mm, 2);

    autoTable(doc, {
      head: [trimmed.head],
      body: trimmed.rows,
      startY: y,
      ...festivalTableTheme(geo, { fontSize: 6.8, numericColumns: [] }),
      columnStyles: distributeColumnWidths(weights, geo.contentWidth),
      margin: { left: geo.left, right: geo.pageWidth - geo.right, top: geo.contentTop, bottom: geo.pageHeight - geo.contentBottom },
      rowPageBreak: 'avoid',
      didDrawPage: () => {
        chrome();
      },
    });

    y = getLastAutoTableY(doc, y) + 2 * mm;

    const constants = [
      { label: 'Escenario', value: stageName },
      { label: 'Fecha', value: dateLabel },
      ...trimmed.constants,
    ];
    y = drawFestivalConstantsLine(doc, geo, constants, y);
  }

  // --- 03 · Conflicts and shortfalls --------------------------------------
  if (data.includeGearConflicts) {
    const withConflicts = data.artists.filter(
      (artist) => (artist.gearMismatches?.length ?? 0) > 0,
    );

    if (withConflicts.length > 0) {
      y = ensureSpace(24 * mm, y + 4 * mm);
      y = drawFestivalSectionHeading(doc, geo, 'Conflictos de material', y, 3);

      for (const artist of withConflicts) {
        y = ensureSpace(12 * mm, y);
        setFestivalText(doc, FESTIVAL_INK, 8, 'bold');
        doc.text(artist.name, geo.left, y);
        y += 4.4 * mm;

        for (const mismatch of artist.gearMismatches ?? []) {
          setFestivalText(doc, FESTIVAL_INK, 7.2);
          const lines = doc.splitTextToSize(mismatch.message, geo.contentWidth - 8 * mm) as string[];
          y = ensureSpace(lines.length * 3.3 * mm + 4 * mm, y);

          setFestivalMonoText(doc, FESTIVAL_SOFT, 5.6, 'bold');
          doc.text(mismatch.severity === 'error' ? 'ERROR' : 'AVISO', geo.left, y, {
            charSpace: 0.2 * mm,
          });
          setFestivalText(doc, FESTIVAL_INK, 7.2);
          doc.text(lines, geo.left + 14 * mm, y, { lineHeightFactor: 1.25 });
          y += lines.length * 3.3 * mm;

          if (mismatch.details) {
            setFestivalText(doc, FESTIVAL_SOFT, 6.8);
            const detailLines = doc.splitTextToSize(mismatch.details, geo.contentWidth - 22 * mm) as string[];
            y = ensureSpace(detailLines.length * 3 * mm + 2 * mm, y);
            doc.text(detailLines, geo.left + 14 * mm, y, { lineHeightFactor: 1.2 });
            y += detailLines.length * 3 * mm;
          }
          y += 2 * mm;
        }
        y += 2 * mm;
      }
    }

    if (data.equipmentNeeds) {
      drawEquipmentNeedsSection(
        doc,
        geo,
        data.equipmentNeeds,
        y + 4 * mm,
        withConflicts.length > 0 ? 4 : 3,
        ensureSpace,
      );
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFestivalChrome(doc, {
      kind: 'programme',
      eventTitle: data.jobTitle,
      contextLabel: `${stageName} · ${dateLabel}`,
      issuer: `Sector-Pro  ·  ${data.jobTitle}`,
      pageNumber: page,
      totalPages,
      paginate: data.paginate !== false,
    });
  }

  return pdfToBlob(doc);
};
