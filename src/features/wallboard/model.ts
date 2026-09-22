import type {
  CalendarFeed,
  CrewAssignmentsFeed,
  Dept,
  DocChecklistItem,
  DocState,
  JobsOverviewFeed,
  JobsOverviewJob,
  LogisticsItem,
  PanelKey,
  PendingActionsFeed,
  PendingItem,
} from './types';

export const DEPARTMENTS: Dept[] = ['sound', 'lights', 'video'];

export const DEPT_LABELS: Record<Dept, string> = {
  sound: 'Sonido',
  lights: 'Luces',
  video: 'Vídeo',
};

/** Items per page for each paginated panel. Pages cut; nothing scrolls. */
export const PANEL_PAGE_SIZES = {
  overview: 4,
  docs: 8,
  crew: 2,
  logistics: 5,
  pending: 4,
} as const;

const CRITICAL_WINDOW_MS = 72 * 60 * 60 * 1000;

export type Urgency = 'crit' | 'warn' | 'ok';

export type JobReadiness = {
  urgency: Urgency;
  label: string;
  crewShort: number;
  docsOpen: number;
};

/** Combines staffing and documents into the status pill every panel shows. */
export function getJobReadiness(job: JobsOverviewJob, now: Date = new Date()): JobReadiness {
  const crewShort = job.departments.reduce(
    (sum, dept) => sum + Math.max(0, (job.crewNeeded[dept] ?? 0) - (job.crewAssigned[dept] ?? 0)),
    0,
  );
  const checklist = job.docChecklist ?? [];
  const docsMissing = checklist.filter((item) => item.state === 'missing').length;
  const docsOpen = checklist.filter((item) => item.state !== 'delivered').length;
  const startsSoon = new Date(job.start_time).getTime() - now.getTime() <= CRITICAL_WINDOW_MS;

  const urgency: Urgency =
    docsMissing > 0 || (crewShort > 0 && (startsSoon || job.status === 'red'))
      ? 'crit'
      : crewShort > 0 || docsOpen > 0 || job.status !== 'green'
        ? 'warn'
        : 'ok';

  const parts: string[] = [];
  if (crewShort > 0) parts.push(`FALTAN ${crewShort}`);
  if (docsOpen > 0) parts.push(`${docsOpen} ${docsOpen === 1 ? 'DOC' : 'DOCS'}`);
  const label = urgency === 'ok'
    ? 'LISTO'
    : [urgency === 'crit' ? 'CRÍTICO' : null, ...parts].filter(Boolean).join(' · ') || 'REVISAR';

  return { urgency, label, crewShort, docsOpen };
}

const URGENCY_ORDER: Record<Urgency, number> = { crit: 0, warn: 1, ok: 2 };

/** Most urgent first, then by start time. */
export function sortByUrgency(jobs: JobsOverviewJob[], now: Date = new Date()): JobsOverviewJob[] {
  return [...jobs].sort((a, b) => {
    const byUrgency = URGENCY_ORDER[getJobReadiness(a, now).urgency] - URGENCY_ORDER[getJobReadiness(b, now).urgency];
    return byUrgency || new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });
}

export function paginate<T>(items: T[], page: number, size: number): T[] {
  return items.slice(page * size, (page + 1) * size);
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/** Document columns shown in the Documentación panel, grouped by department. */
export function getDocColumns(jobs: JobsOverviewJob[]): Array<{ dept: Dept; key: string; label: string }> {
  const seen = new Map<string, { dept: Dept; key: string; label: string }>();
  jobs.forEach((job) => {
    (job.docChecklist ?? []).forEach((item) => {
      const id = `${item.dept}:${item.key}`;
      if (!seen.has(id)) seen.set(id, { dept: item.dept, key: item.key, label: shortDocLabel(item) });
    });
  });
  return DEPARTMENTS.flatMap((dept) => [...seen.values()].filter((column) => column.dept === dept));
}

/** Column headers need to be short: "Memoria técnica de sonido" → "Memoria". */
export function shortDocLabel(item: Pick<DocChecklistItem, 'key' | 'label'>): string {
  if (item.key === 'memoria') return 'Memoria';
  if (item.key === 'lista_material') return 'Material';
  if (item.key === 'soundvision') return 'SoundVision';
  return item.label;
}

export function docStateFor(job: JobsOverviewJob, dept: Dept, key: string): DocState | null {
  return job.docChecklist?.find((item) => item.dept === dept && item.key === key)?.state ?? null;
}

/** Jobs whose document requirements are known, soonest first. */
export function getDocJobs(overview: JobsOverviewFeed | null): JobsOverviewJob[] {
  return [...(overview?.jobs ?? [])]
    .filter((job) => (job.docChecklist?.length ?? 0) > 0)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export type PendingGroup = {
  key: string;
  title: string;
  color: string | null;
  startTime: string | null;
  items: PendingItem[];
  severity: 'red' | 'yellow';
};

/** Groups alerts by job, red groups first. Alerts from older feeds group by their text. */
export function groupPendingItems(items: PendingItem[]): PendingGroup[] {
  const groups = new Map<string, PendingGroup>();
  items.forEach((item) => {
    const key = item.jobId ?? item.text;
    const group: PendingGroup = groups.get(key) ?? {
      key,
      title: item.jobTitle ?? item.text,
      color: item.color ?? null,
      startTime: item.startTime ?? null,
      items: [],
      severity: 'yellow',
    };
    group.items.push(item);
    if (item.severity === 'red') group.severity = 'red';
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1));
}

export function getPendingTotals(items: PendingItem[]) {
  const sum = (predicate: (item: PendingItem) => boolean) =>
    items.filter(predicate).reduce((total, item) => total + (item.count ?? 1), 0);
  const staffingItems = items.filter((item) => item.kind === 'staffing');
  return {
    staffing: sum((item) => item.kind === 'staffing'),
    staffingJobs: new Set(staffingItems.map((item) => item.jobId)).size,
    docsMissing: sum((item) => item.kind === 'docs' && item.severity === 'red'),
    timesheets: sum((item) => item.kind === 'timesheet'),
    timesheetJobs: new Set(items.filter((item) => item.kind === 'timesheet').map((item) => item.jobId)).size,
    structured: items.every((item) => item.kind !== undefined),
  };
}

export const PENDING_TAGS: Record<NonNullable<PendingItem['kind']>, string> = {
  staffing: 'PERSONAL',
  docs: 'DOCS',
  timesheet: 'PARTES',
};

/** Human line for an alert inside its job group. */
export function describePendingItem(item: PendingItem): string {
  if (item.kind === 'staffing' && item.count !== undefined) {
    const dept = item.dept ? DEPT_LABELS[item.dept].toLowerCase() : '';
    return item.count === 1 ? `Falta 1 de ${dept}` : `Faltan ${item.count} de ${dept}`;
  }
  if (item.kind === 'docs' && item.detail) return item.detail;
  if (item.kind === 'timesheet' && item.count !== undefined) {
    return item.count === 1 ? '1 parte de horas vencido' : `${item.count} partes de horas vencidos`;
  }
  return item.text;
}

/** Logistics grouped by date key, keeping the feed order. */
export function groupLogisticsByDay(items: LogisticsItem[]): Array<{ dateKey: string; items: LogisticsItem[] }> {
  const groups: Array<{ dateKey: string; items: LogisticsItem[] }> = [];
  items.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && last.dateKey === item.date) last.items.push(item);
    else groups.push({ dateKey: item.date, items: [item] });
  });
  return groups;
}

const PROCEDURE_LABELS: Record<string, string> = {
  load: 'CARGA',
  unload: 'DESCARGA',
};

export function getProcedureLabel(procedure: string | null): { label: string; tone: 'load' | 'unload' | 'other' } {
  const key = (procedure ?? '').toLowerCase();
  if (key === 'load' || key === 'unload') return { label: PROCEDURE_LABELS[key], tone: key };
  return { label: key ? key.replace(/_/g, ' ').toUpperCase() : 'MOVIMIENTO', tone: 'other' };
}

const VEHICLE_LABELS: Record<string, string> = {
  trailer: 'Tráiler',
  '9m': 'Camión 9 m',
  '8m': 'Camión 8 m',
  '6m': 'Camión 6 m',
  '4m': 'Camión 4 m',
  furgoneta: 'Furgoneta',
  van: 'Furgoneta',
  rv: 'Autocaravana',
  plane: 'Avión',
  avion: 'Avión',
  train: 'Tren',
};

export function getVehicleLabel(transportType: string | null): string {
  if (!transportType) return 'Transporte';
  return VEHICLE_LABELS[transportType.toLowerCase()] ?? transportType;
}

export function getDeptLabel(value: string): string {
  return (DEPARTMENTS as string[]).includes(value) ? DEPT_LABELS[value as Dept] : value;
}

export const TIMESHEET_TAGS: Record<string, { label: string; tone: 'ok' | 'info' | 'warn' | 'crit' }> = {
  approved: { label: 'APROBADO', tone: 'ok' },
  submitted: { label: 'ENVIADO', tone: 'info' },
  draft: { label: 'BORRADOR', tone: 'warn' },
  rejected: { label: 'RECHAZADO', tone: 'crit' },
  missing: { label: 'FALTA PARTE', tone: 'crit' },
};

/** Number of pages a panel needs for the current data. */
export function getPanelPageCount(
  panel: PanelKey,
  data: {
    overview: JobsOverviewFeed | null;
    crew: CrewAssignmentsFeed | null;
    logistics: LogisticsItem[] | null;
    pending: PendingActionsFeed | null;
    calendar?: CalendarFeed | null;
  },
): number {
  switch (panel) {
    case 'overview':
      return pageCount(data.overview?.jobs.length ?? 0, PANEL_PAGE_SIZES.overview);
    case 'docs':
      return pageCount(getDocJobs(data.overview).length, PANEL_PAGE_SIZES.docs);
    case 'crew':
      return pageCount(data.crew?.jobs.length ?? 0, PANEL_PAGE_SIZES.crew);
    case 'logistics':
      return pageCount(data.logistics?.length ?? 0, PANEL_PAGE_SIZES.logistics);
    case 'pending':
      return pageCount(groupPendingItems(data.pending?.items ?? []).length, PANEL_PAGE_SIZES.pending);
    default:
      return 1;
  }
}

/** Share of a crew requirement that is filled, for the department bars. */
export function crewBar(assigned: number, needed: number): { width: string; color: string } {
  if (needed <= 0) return { width: assigned > 0 ? '100%' : '0%', color: 'var(--wb-ok)' };
  const ratio = Math.min(1, assigned / needed);
  const color = ratio >= 1 ? 'var(--wb-ok)' : ratio < 0.6 ? 'var(--wb-crit)' : '#d18a00';
  return { width: `${Math.max(4, ratio * 100)}%`, color };
}
