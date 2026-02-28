import { Plane, Wrench, Star, Moon, Mic } from 'lucide-react';
import type { JobDateType, LogisticsEventType, LogisticsTransportType, TimesheetStatus } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function translateTimesheetStatus(status: TimesheetStatus): string {
  switch (status) {
    case 'approved':
      return 'aprobado';
    case 'submitted':
      return 'enviado';
    case 'draft':
      return 'borrador';
    case 'missing':
      return 'faltante';
    case 'rejected':
      return 'rechazado';
    default:
      return status;
  }
}

export function formatJobTypeLabel(jobType?: string | null): string | null {
  const jt = (jobType || '').toLowerCase();
  switch (jt) {
    case 'single':
      return 'Evento único';
    case 'tour':
      return 'Gira';
    case 'tourdate':
      return 'Fecha de gira';
    case 'festival':
      return 'Festival';
    case 'ciclo':
      return 'Ciclo';
    case 'dryhire':
      return 'Dry hire';
    default:
      return null;
  }
}

export function formatJobDateTypeLabel(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const sameDay =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
  if (sameDay) return '1 día';
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / MS_PER_DAY) + 1);
  return `${days} días`;
}

export function getJobCardBackground(colorHex?: string | null, theme: 'light' | 'dark' = 'light'): string {
  if (colorHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorHex)) {
    let hex = colorHex.replace('#', '');
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((ch) => ch + ch)
        .join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const alpha = theme === 'light' ? 0.35 : 0.55;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return theme === 'light' ? '#f4f4f5' : '#020617';
}

export function getDateTypeForJobOnDay(
  job: { id: string; job_type?: string | null; start_time: string; end_time: string },
  day: Date
): JobDateType | null {
  const isTourdate = String(job.job_type || '').toLowerCase() === 'tourdate';
  if (!isTourdate) return null;
  const s = new Date(job.start_time);
  const e = new Date(job.end_time);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const sameDay = s.toDateString() === e.toDateString();
  if (!sameDay) return 'travel';
  const hours = (e.getTime() - s.getTime()) / 3600000;
  if (hours >= 6) return 'show';
  if (hours >= 3) return 'rehearsal';
  return 'setup';
}

export function getDateTypeIcon(type: JobDateType | null): JSX.Element | null {
  if (!type) return null;
  switch (type) {
    case 'travel':
      return <Plane className="w-4 h-4" />;
    case 'setup':
      return <Wrench className="w-4 h-4" />;
    case 'show':
      return <Star className="w-4 h-4" />;
    case 'off':
      return <Moon className="w-4 h-4" />;
    case 'rehearsal':
      return <Mic className="w-4 h-4" />;
    default:
      return null;
  }
}

export function getTransportIcon(
  transportType: LogisticsTransportType | null,
  eventType: LogisticsEventType | null,
  className?: string
): JSX.Element {
  const base = (transportType || '').toLowerCase();
  const evt = (eventType || '').toLowerCase();
  const isUnload = evt === 'unload';

  let vehicle = '🚚';
  if (base === 'rv') vehicle = '🏕️';
  else if (base === 'furgoneta' || base === 'van') vehicle = '🚐';
  else if (base === 'plane' || base === 'avion') vehicle = '✈️';
  else if (base === 'train') vehicle = '🚆';
  else if (base === 'trailer' || base === '9m' || base === '8m' || base === '6m' || base === '4m') vehicle = '🚛';

  const flip = isUnload;

  return (
    <span className={className} style={flip ? { display: 'inline-block', transform: 'scaleX(-1)' } : undefined}>
      {vehicle}
    </span>
  );
}
