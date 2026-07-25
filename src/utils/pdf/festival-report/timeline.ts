import type jsPDF from 'jspdf';
import {
  FESTIVAL_ACCENT,
  FESTIVAL_FAINT,
  FESTIVAL_HAIRLINE,
  FESTIVAL_INK,
  FESTIVAL_RULE,
  FESTIVAL_SOFT,
  FESTIVAL_TIMELINE_SOUNDCHECK,
  setFestivalMonoText,
  setFestivalText,
  type FestivalGeometry,
} from './tokens';
import { drawFestivalHatch, type FestivalFlagLabel } from './components';
import { truncateToWidth } from './chrome';

/** The programme day runs 07:00 to 07:00, not midnight to midnight. */
export const TIMELINE_WINDOW_START_MINUTES = 7 * 60;
const MINUTES_PER_DAY = 24 * 60;
/** A soundcheck window longer than this is not a soundcheck window. */
const IMPLAUSIBLE_SOUNDCHECK_MINUTES = 6 * 60;

export interface TimelineEntry {
  name: string;
  show?: { start?: string | null; end?: string | null };
  soundcheck?: { start?: string | null; end?: string | null };
}

export interface TimelineFinding {
  name: string;
  label: FestivalFlagLabel;
  message: string;
}

/** Parses `HH:MM` / `HH:MM:SS` into minutes past midnight. */
export const parseClockMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = /^\s*(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/** Position of a clock time inside the 07:00→07:00 window, in minutes. */
export const toWindowOffset = (value: string | null | undefined): number | null => {
  const minutes = parseClockMinutes(value);
  if (minutes === null) return null;
  return (minutes - TIMELINE_WINDOW_START_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
};

interface Span {
  start: number;
  duration: number;
}

const toSpan = (
  start: string | null | undefined,
  end: string | null | undefined,
): Span | null => {
  const from = toWindowOffset(start);
  const to = toWindowOffset(end);
  if (from === null || to === null) return null;
  const duration = (to - from + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return { start: from, duration: duration === 0 ? 5 : duration };
};

/**
 * Inspects the day's entries and reports what a table of times cannot show:
 * soundchecks that run for most of a day, and soundchecks that start after
 * their own show. Bad data is never silently clamped to something plausible.
 */
export const collectTimelineFindings = (entries: TimelineEntry[]): TimelineFinding[] => {
  const findings: TimelineFinding[] = [];

  for (const entry of entries) {
    const show = toSpan(entry.show?.start, entry.show?.end);
    const soundcheck = toSpan(entry.soundcheck?.start, entry.soundcheck?.end);
    if (!soundcheck) continue;

    if (soundcheck.duration > IMPLAUSIBLE_SOUNDCHECK_MINUTES) {
      findings.push({
        name: entry.name,
        label: 'Revisar',
        message: `Ventana de prueba de sonido de ${Math.round(soundcheck.duration / 60)} h. Confirmar las horas reales con producción.`,
      });
    }

    if (show && soundcheck.start > show.start) {
      findings.push({
        name: entry.name,
        label: 'Conflicto',
        message: 'La prueba de sonido comienza después del inicio del show. Revisar el horario antes de publicarlo.',
      });
    }
  }

  return findings;
};

export interface TimelineOptions {
  entries: TimelineEntry[];
  y: number;
  /** Width reserved for the right-aligned lane labels. */
  labelWidth?: number;
  laneHeight?: number;
}

export interface TimelineResult {
  /** Y below the drawn chart. */
  y: number;
  findings: TimelineFinding[];
  /** Entries that carry no usable show or soundcheck times. */
  skipped: string[];
}

/**
 * Day programme lane chart. A table of times tells you when things happen; a
 * lane chart tells you what collides.
 */
export const drawFestivalTimeline = (
  doc: jsPDF,
  geo: FestivalGeometry,
  options: TimelineOptions,
): TimelineResult => {
  const { mm } = geo;
  const laneHeight = (options.laneHeight ?? 5.4) * mm;
  const labelWidth = (options.labelWidth ?? 34) * mm;
  const chartX = geo.left + labelWidth + 2 * mm;
  const chartWidth = geo.right - chartX;
  const perMinute = chartWidth / MINUTES_PER_DAY;

  const usable = options.entries.filter(
    (entry) => toSpan(entry.show?.start, entry.show?.end) || toSpan(entry.soundcheck?.start, entry.soundcheck?.end),
  );
  const skipped = options.entries
    .filter((entry) => !usable.includes(entry))
    .map((entry) => entry.name);

  let y = options.y;

  // Hour scale across the top, every three hours from 07:00.
  setFestivalMonoText(doc, FESTIVAL_SOFT, 5.2);
  for (let hour = 0; hour <= 24; hour += 3) {
    const x = chartX + hour * 60 * perMinute;
    const clock = String((TIMELINE_WINDOW_START_MINUTES / 60 + hour) % 24).padStart(2, '0');
    doc.text(`${clock}`, x, y, { align: hour === 24 ? 'right' : 'left' });
  }
  y += 2.4 * mm;

  const chartTop = y;
  const chartHeight = usable.length * laneHeight;

  doc.setDrawColor(...FESTIVAL_RULE);
  doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
  for (let hour = 0; hour <= 24; hour += 3) {
    const x = chartX + hour * 60 * perMinute;
    doc.line(x, chartTop, x, chartTop + chartHeight);
  }

  const findings = collectTimelineFindings(usable);
  const flagged = new Set(findings.map((finding) => finding.name));

  usable.forEach((entry, index) => {
    const laneY = chartTop + index * laneHeight;
    const barHeight = laneHeight * 0.56;
    const barY = laneY + (laneHeight - barHeight) / 2;

    doc.setFillColor(244, 241, 234);
    doc.rect(chartX, barY, chartWidth, barHeight, 'F');

    setFestivalText(doc, FESTIVAL_INK, 6.4);
    doc.text(
      truncateToWidth(doc, entry.name, labelWidth),
      geo.left + labelWidth,
      barY + barHeight * 0.78,
      { align: 'right' },
    );

    const soundcheck = toSpan(entry.soundcheck?.start, entry.soundcheck?.end);
    if (soundcheck) {
      drawSpan(doc, soundcheck, {
        x: chartX,
        y: barY,
        height: barHeight,
        width: chartWidth,
        perMinute,
        mm,
        hatched: flagged.has(entry.name),
        color: FESTIVAL_TIMELINE_SOUNDCHECK,
      });
    }

    const show = toSpan(entry.show?.start, entry.show?.end);
    if (show) {
      drawSpan(doc, show, {
        x: chartX,
        y: barY,
        height: barHeight,
        width: chartWidth,
        perMinute,
        mm,
        hatched: false,
        color: FESTIVAL_ACCENT,
      });
    }
  });

  y = chartTop + chartHeight + 3.5 * mm;

  doc.setDrawColor(...FESTIVAL_RULE);
  doc.setLineWidth(FESTIVAL_HAIRLINE * mm);
  doc.line(geo.left, y - 2 * mm, geo.right, y - 2 * mm);

  // Key: what the two bar colours mean, then anything flagged.
  doc.setFillColor(...FESTIVAL_TIMELINE_SOUNDCHECK);
  doc.rect(geo.left, y - 1.6 * mm, 5 * mm, 2 * mm, 'F');
  setFestivalMonoText(doc, FESTIVAL_SOFT, 5.4);
  doc.text('PRUEBA DE SONIDO', geo.left + 6.4 * mm, y, { charSpace: 0.18 * mm });
  const showKeyX = geo.left + 46 * mm;
  doc.setFillColor(...FESTIVAL_ACCENT);
  doc.rect(showKeyX, y - 1.6 * mm, 5 * mm, 2 * mm, 'F');
  setFestivalMonoText(doc, FESTIVAL_SOFT, 5.4);
  doc.text('SHOW', showKeyX + 6.4 * mm, y, { charSpace: 0.18 * mm });

  return { y: y + 4 * mm, findings, skipped };
};

const drawSpan = (
  doc: jsPDF,
  span: Span,
  context: {
    x: number;
    y: number;
    width: number;
    height: number;
    perMinute: number;
    mm: number;
    hatched: boolean;
    color: readonly [number, number, number];
  },
): void => {
  // A span that runs past the end of the window continues at its start.
  const segments: Array<{ from: number; to: number }> = [];
  const end = span.start + span.duration;
  if (end <= MINUTES_PER_DAY) {
    segments.push({ from: span.start, to: end });
  } else {
    segments.push({ from: span.start, to: MINUTES_PER_DAY });
    segments.push({ from: 0, to: end - MINUTES_PER_DAY });
  }

  for (const segment of segments) {
    const x = context.x + segment.from * context.perMinute;
    const width = Math.max(0.6 * context.mm, (segment.to - segment.from) * context.perMinute);
    if (context.hatched) {
      doc.setDrawColor(...FESTIVAL_FAINT);
      doc.setLineWidth(FESTIVAL_HAIRLINE * context.mm);
      doc.rect(x, context.y, width, context.height, 'S');
      drawFestivalHatch(doc, x, context.y, width, context.height, context.mm, FESTIVAL_ACCENT);
    } else {
      doc.setFillColor(...(context.color as [number, number, number]));
      doc.rect(x, context.y, width, context.height, 'F');
    }
  }
};
