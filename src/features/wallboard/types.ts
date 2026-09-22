import type { AnnouncementLevel } from '@/constants/announcementLevels';
import type { DateType } from '@/constants/dateTypes';
import type { Dept, DeptCounts } from '@/types/wallboard';

export type { Dept, DeptCounts } from '@/types/wallboard';

export type DocState = 'delivered' | 'pending' | 'missing';

/** One required document for one department of a job (see supabase wallboard-feed docRules). */
export interface DocChecklistItem {
  dept: Dept;
  key: string;
  label: string;
  state: DocState;
}

export interface JobsOverviewFeed {
  jobs: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: { name: string | null } | null;
    departments: Dept[];
    crewAssigned: DeptCounts;
    crewNeeded: DeptCounts;
    docs: Partial<Record<Dept, { have: number; need: number }>>;
    /** Per-document status. Absent on feeds served before document requirements shipped. */
    docChecklist?: DocChecklistItem[];
    status: 'green' | 'yellow' | 'red';
    color?: string | null;
    job_type?: string | null;
  }>;
}

export type JobsOverviewJob = JobsOverviewFeed['jobs'][number];

export type CalendarFeed = {
  jobs: JobsOverviewJob[];
  jobsByDate: Record<string, JobsOverviewJob[]>;
  jobDateLookup: Record<string, string>;
  range: { start: string; end: string };
  focusMonth: number;
  focusYear: number;
};

export type TimesheetStatus = 'submitted' | 'draft' | 'missing' | 'approved' | 'rejected';

export interface CrewAssignmentsFeed {
  jobs: Array<{
    id: string;
    title: string;
    jobType?: string | null;
    job_type?: string | null;
    start_time?: string;
    end_time?: string;
    color?: string | null;
    departments?: Dept[];
    crewNeeded?: DeptCounts;
    crew: Array<{
      name: string;
      role: string;
      dept: Dept | null;
      timesheetStatus: TimesheetStatus;
    }>;
  }>;
}

export interface DocProgressFeed {
  jobs: Array<{
    id: string;
    title: string;
    color?: string | null;
    jobType?: string | null;
    job_type?: string | null;
    start_time?: string;
    end_time?: string;
    departments: Array<{ dept: Dept; have: number; need: number; missing: string[] }>;
  }>;
}

export type PendingKind = 'staffing' | 'docs' | 'timesheet';

export interface PendingItem {
  severity: 'red' | 'yellow';
  /** Full sentence, kept for older clients. */
  text: string;
  kind?: PendingKind;
  jobId?: string;
  jobTitle?: string;
  color?: string | null;
  startTime?: string;
  dept?: Dept | null;
  count?: number;
  detail?: string | null;
}

export interface PendingActionsFeed {
  items: PendingItem[];
}

export interface AnnouncementsFeed {
  announcements: Array<{
    id: string;
    message: string;
    level: string;
    created_at: string;
    active: boolean;
  }>;
}

export interface LogisticsItem {
  id: string;
  date: string;
  time: string;
  title: string;
  transport_type: string | null;
  transport_provider?: string | null;
  plate: string | null;
  job_title?: string | null;
  procedure: string | null;
  loadingBay: string | null;
  departments: string[];
  color?: string | null;
  notes?: string | null;
}

export interface LogisticsFeed {
  items: LogisticsItem[];
}

export interface WallboardSnapshotFeed {
  schemaVersion: 1;
  generatedAt: string;
  presetSlug?: string | null;
  overview: JobsOverviewFeed;
  calendar: CalendarFeed;
  crew: CrewAssignmentsFeed;
  pending: PendingActionsFeed;
  logistics: LogisticsFeed;
  announcements: AnnouncementsFeed;
}

export type JobDateType = DateType;
export type LogisticsTransportType = 'trailer' | '9m' | '8m' | '6m' | '4m' | 'furgoneta' | 'rv' | string;
export type LogisticsEventType = 'load' | 'unload' | string;

export type TickerMessage = { message: string; level: AnnouncementLevel };

export type PanelKey = 'overview' | 'docs' | 'crew' | 'logistics' | 'pending' | 'calendar';
