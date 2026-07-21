import { CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import { parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { normalizeDept, type Dept } from '@/utils/tasks';
import { formatInJobTimezone, utcToLocalInput } from '@/utils/timezoneUtils';

export const DEPARTMENT_LABELS: Record<string, string> = {
  sound: 'Sonido',
  lights: 'Luces',
  video: 'Vídeo',
  production: 'Producción',
  administrative: 'Administración',
};

export const DEPARTMENT_OPTIONS: Dept[] = [
  'sound',
  'lights',
  'video',
  'production',
  'administrative',
];

export const PRIORITY_LABELS: Record<number, { label: string; class: string }> = {
  1: { label: 'Alta', class: 'bg-red-500/10 text-red-600 border-red-500/20' },
  2: { label: 'Media', class: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  3: { label: 'Baja', class: 'bg-green-500/10 text-green-600 border-green-500/20' },
};

export const STATUS_ICONS: Record<string, React.ReactNode> = {
  not_started: <CircleDashed className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En progreso',
  completed: 'Completada',
};

/** Safe normalizeDept wrapper that defaults to sound for page-level routing. */
export function normalizeDeptOrDefault(raw: string | null): Dept {
  return normalizeDept(raw) ?? 'sound';
}

export const MADRID_TZ = 'Europe/Madrid';

export function formatDateMadrid(isoDate: string): string {
  return formatInJobTimezone(isoDate, 'dd/MM/yyyy', MADRID_TZ);
}

export function formatDateTimeMadrid(isoDate: string): string {
  return formatInJobTimezone(isoDate, 'dd/MM/yyyy HH:mm', MADRID_TZ);
}

export function dateInputValue(isoDate: string): string {
  return utcToLocalInput(isoDate, MADRID_TZ).slice(0, 10);
}

export function isOverdueMadrid(isoDate: string): boolean {
  const madridNow = toZonedTime(new Date(), MADRID_TZ);
  const madridDue = toZonedTime(parseISO(isoDate), MADRID_TZ);
  return madridDue < madridNow;
}
