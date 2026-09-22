import type {
  AnnouncementsFeed,
  CrewAssignmentsFeed,
  Dept,
  DocProgressFeed,
  JobsOverviewFeed,
  LogisticsFeed,
  LogisticsItem,
  PendingActionsFeed,
  WallboardSnapshotFeed,
} from '@/features/wallboard/types';

export type {
  AnnouncementsFeed,
  CrewAssignmentsFeed,
  Dept,
  DocProgressFeed,
  JobsOverviewFeed,
  LogisticsFeed,
  LogisticsItem,
  PendingActionsFeed,
  WallboardSnapshotFeed,
} from '@/features/wallboard/types';

const DEPARTMENTS = new Set<Dept>(['sound', 'lights', 'video']);
const JOB_STATUSES = new Set(['green', 'yellow', 'red']);
const TIMESHEET_STATUSES = new Set(['submitted', 'draft', 'missing', 'approved', 'rejected']);
const DOC_STATES = new Set(['delivered', 'pending', 'missing']);
const PENDING_KINDS = new Set(['staffing', 'docs', 'timesheet']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringOrNull = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null;

const isOptionalStringOrNull = (value: unknown): value is string | null | undefined =>
  value === undefined || isStringOrNull(value);

const isDept = (value: unknown): value is Dept =>
  typeof value === 'string' && DEPARTMENTS.has(value as Dept);

const isDeptCounts = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return ['sound', 'lights', 'video'].every((dept) => typeof value[dept] === 'number')
    && (value.total === undefined || typeof value.total === 'number');
};

const isJobsOverviewJob = (job: unknown): boolean => {
  if (!isRecord(job) || !Array.isArray(job.departments) || !isRecord(job.docs)) return false;
  const locationIsValid = job.location === null
    || (isRecord(job.location) && isStringOrNull(job.location.name));
  const docsAreValid = Object.entries(job.docs).every(([dept, progress]) =>
    isDept(dept)
    && isRecord(progress)
    && typeof progress.have === 'number'
    && typeof progress.need === 'number');
  const checklistIsValid = job.docChecklist === undefined
    || (Array.isArray(job.docChecklist) && job.docChecklist.every((item) =>
      isRecord(item)
      && isDept(item.dept)
      && typeof item.key === 'string'
      && typeof item.label === 'string'
      && typeof item.state === 'string'
      && DOC_STATES.has(item.state)));

  return typeof job.id === 'string'
    && typeof job.title === 'string'
    && typeof job.start_time === 'string'
    && typeof job.end_time === 'string'
    && locationIsValid
    && job.departments.every(isDept)
    && isDeptCounts(job.crewAssigned)
    && isDeptCounts(job.crewNeeded)
    && docsAreValid
    && checklistIsValid
    && typeof job.status === 'string'
    && JOB_STATUSES.has(job.status)
    && isOptionalStringOrNull(job.color)
    && isOptionalStringOrNull(job.job_type);
};

const isJobsOverviewFeed = (value: unknown): value is JobsOverviewFeed => {
  if (!isRecord(value) || !Array.isArray(value.jobs)) return false;
  return value.jobs.every(isJobsOverviewJob);
};

const isCalendarFeed = (value: unknown): value is WallboardSnapshotFeed['calendar'] => {
  if (!isRecord(value) || !isJobsOverviewFeed(value)) return false;
  return isRecord(value.jobsByDate)
    && Object.values(value.jobsByDate).every((jobs) => Array.isArray(jobs) && jobs.every(isJobsOverviewJob))
    && isRecord(value.jobDateLookup)
    && Object.values(value.jobDateLookup).every((dateKey) => typeof dateKey === 'string')
    && isRecord(value.range)
    && typeof value.range.start === 'string'
    && typeof value.range.end === 'string'
    && typeof value.focusMonth === 'number'
    && typeof value.focusYear === 'number';
};

const isCrewAssignmentsFeed = (value: unknown): value is CrewAssignmentsFeed => {
  if (!isRecord(value) || !Array.isArray(value.jobs)) return false;

  return value.jobs.every((job) => {
    if (!isRecord(job) || !Array.isArray(job.crew)) return false;
    const crewIsValid = job.crew.every((member) =>
      isRecord(member)
      && typeof member.name === 'string'
      && typeof member.role === 'string'
      && (member.dept === null || isDept(member.dept))
      && typeof member.timesheetStatus === 'string'
      && TIMESHEET_STATUSES.has(member.timesheetStatus));

    return typeof job.id === 'string'
      && typeof job.title === 'string'
      && (job.departments === undefined || (Array.isArray(job.departments) && job.departments.every(isDept)))
      && (job.crewNeeded === undefined || isDeptCounts(job.crewNeeded))
      && isOptionalStringOrNull(job.jobType)
      && isOptionalStringOrNull(job.job_type)
      && (job.start_time === undefined || typeof job.start_time === 'string')
      && (job.end_time === undefined || typeof job.end_time === 'string')
      && isOptionalStringOrNull(job.color)
      && crewIsValid;
  });
};

const isPendingActionsFeed = (value: unknown): value is PendingActionsFeed =>
  isRecord(value)
  && Array.isArray(value.items)
  && value.items.every((item) =>
    isRecord(item)
    && (item.severity === 'red' || item.severity === 'yellow')
    && typeof item.text === 'string'
    && (item.kind === undefined || (typeof item.kind === 'string' && PENDING_KINDS.has(item.kind)))
    && (item.jobId === undefined || typeof item.jobId === 'string')
    && (item.count === undefined || typeof item.count === 'number')
    && (item.dept === undefined || item.dept === null || isDept(item.dept))
    && isOptionalStringOrNull(item.detail)
    && isOptionalStringOrNull(item.color));

const isLogisticsFeed = (value: unknown): value is LogisticsFeed =>
  isRecord(value)
  && Array.isArray(value.items)
  && value.items.every((item) =>
    isRecord(item)
    && typeof item.id === 'string'
    && typeof item.date === 'string'
    && typeof item.time === 'string'
    && typeof item.title === 'string'
    && isStringOrNull(item.transport_type)
    && isOptionalStringOrNull(item.transport_provider)
    && isStringOrNull(item.plate)
    && isOptionalStringOrNull(item.job_title)
    && isStringOrNull(item.procedure)
    && isStringOrNull(item.loadingBay)
    && Array.isArray(item.departments)
    && item.departments.every((dept) => typeof dept === 'string')
    && isOptionalStringOrNull(item.color)
    && isOptionalStringOrNull(item.notes));

const isAnnouncementsFeed = (value: unknown): value is AnnouncementsFeed =>
  isRecord(value)
  && Array.isArray(value.announcements)
  && value.announcements.every((announcement) =>
    isRecord(announcement)
    && typeof announcement.id === 'string'
    && typeof announcement.message === 'string'
    && typeof announcement.level === 'string'
    && typeof announcement.created_at === 'string'
    && typeof announcement.active === 'boolean');

const isWallboardSnapshotFeed = (value: unknown): value is WallboardSnapshotFeed => {
  if (!isRecord(value)) return false;

  return value.schemaVersion === 1
    && typeof value.generatedAt === 'string'
    && isOptionalStringOrNull(value.presetSlug)
    && isJobsOverviewFeed(value.overview)
    && isCalendarFeed(value.calendar)
    && isCrewAssignmentsFeed(value.crew)
    && isPendingActionsFeed(value.pending)
    && isLogisticsFeed(value.logistics)
    && isAnnouncementsFeed(value.announcements);
};

export interface PresetConfigFeed {
  config: {
    panel_order: string[] | null;
    panel_durations: Record<string, number> | null;
    rotation_fallback_seconds: number | null;
    highlight_ttl_seconds: number | null;
    ticker_poll_interval_seconds: number | null;
  };
  slug: string;
}

export class WallboardApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function getFunctionsBaseUrl(): string {
  const configured = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  if (supabaseUrl) return `${supabaseUrl}/functions/v1`;
  throw new WallboardApiError('Supabase functions URL is not configured');
}

export class WallboardApi {
  private token?: string;
  private presetSlug?: string;
  constructor(token?: string, presetSlug?: string) {
    this.token = token;
    this.presetSlug = presetSlug?.trim().toLowerCase() || undefined;
  }

  // Prefer Supabase invoke to avoid dev-server rewrites returning HTML
  private async request<T>(path: string): Promise<T> {
    const { supabase } = await import('@/integrations/supabase/client');
    try {
      const headers: Record<string, string> = this.token ? { "x-wallboard-jwt": this.token } : {};
      const { data, error } = await supabase.functions.invoke('wallboard-feed', {
        body: { path, ...(this.presetSlug ? { presetSlug: this.presetSlug } : {}) },
        headers,
      });
      if (error) throw error;
      return data as T;
    } catch (err) {
      const anon =
        import.meta.env?.VITE_SUPABASE_ANON_KEY ||
        import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers: Record<string, string> = this.token ? { "x-wallboard-jwt": this.token } : {};
      const { data: sessionData } = await supabase.auth.getSession();
      const bearerToken = this.token ? anon : sessionData.session?.access_token ?? anon;
      if (bearerToken) {
        headers["Authorization"] = `Bearer ${bearerToken}`;
      }
      const presetQuery = this.presetSlug ? `?presetSlug=${encodeURIComponent(this.presetSlug)}` : '';
      const res = await fetch(`${getFunctionsBaseUrl()}/wallboard-feed${path}${presetQuery}`, {
        headers,
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new WallboardApiError(`${path} failed`, res.status);
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new WallboardApiError(`${path} returned non-JSON`, res.status);
      }
      return res.json();
    }
  }

  jobsOverview(): Promise<JobsOverviewFeed> {
    return this.request('/jobs-overview');
  }
  crewAssignments(): Promise<CrewAssignmentsFeed> {
    return this.request('/crew-assignments');
  }
  docProgress(): Promise<DocProgressFeed> {
    return this.request('/doc-progress');
  }
  pendingActions(): Promise<PendingActionsFeed> {
    return this.request('/pending-actions');
  }
  announcements(): Promise<AnnouncementsFeed> {
    return this.request('/announcements');
  }
  logistics(): Promise<LogisticsFeed> {
    return this.request('/logistics');
  }
  calendar(): Promise<JobsOverviewFeed> {
    return this.request('/calendar');
  }
  async snapshot(): Promise<WallboardSnapshotFeed> {
    const payload = await this.request<unknown>('/snapshot');
    if (!isWallboardSnapshotFeed(payload)) {
      throw new WallboardApiError('/snapshot returned a malformed payload');
    }
    return payload;
  }
  presetConfig(): Promise<PresetConfigFeed> {
    return this.request('/preset-config');
  }
}

export async function exchangeWallboardToken(shared: string, presetSlug?: string): Promise<{ token: string; expiresIn: number; preset?: string }> {
  // Prefer Supabase Edge Function invoke to avoid CORS/base-path issues
  try {
    const mod = await import('@/integrations/supabase/client');
    const supabase = mod.supabase;
    const { data, error } = await supabase.functions.invoke('wallboard-auth', {
      body: { wallboardToken: shared, preset: presetSlug, presetSlug },
    });
    if (error) throw error;
    if (data?.token) return data as { token: string; expiresIn: number };
  } catch (err) {
    console.warn('wallboard-auth invoke fallback to fetch:', err);
  }

  let url = `${getFunctionsBaseUrl()}/wallboard-auth?wallboardToken=${encodeURIComponent(shared)}`;
  if (presetSlug) {
    url += `&preset=${encodeURIComponent(presetSlug)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wallboard-auth failed: ${res.status}`);
  return res.json();
}
