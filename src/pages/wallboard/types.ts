import type { AnnouncementLevel } from '@/constants/announcementLevels';

export type Dept = 'sound' | 'lights' | 'video';

export interface JobsOverviewFeed {
  jobs: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: { name: string | null } | null;
    departments: Dept[];
    crewAssigned: Record<string, number>;
    crewNeeded: Record<string, number>;
    docs: Record<string, { have: number; need: number }>;
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
    start_time?: string;
    end_time?: string;
    color?: string | null;
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
    departments: Array<{ dept: Dept; have: number; need: number; missing: string[] }>;
  }>;
}

export interface PendingActionsFeed {
  items: Array<{ severity: 'red' | 'yellow'; text: string }>;
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

export type JobDateType = 'travel' | 'setup' | 'show' | 'off' | 'rehearsal';
export type LogisticsTransportType = 'trailer' | '9m' | '8m' | '6m' | '4m' | 'furgoneta' | 'rv' | string;
export type LogisticsEventType = 'load' | 'unload' | string;

export type TickerMessage = { message: string; level: AnnouncementLevel };

export type PanelKey = 'overview' | 'crew' | 'logistics' | 'pending' | 'calendar';

