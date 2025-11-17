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

export interface CrewAssignmentsFeed {
  jobs: Array<{
    id: string;
    title: string;
    crew: Array<{
      name: string;
      role: string;
      dept: Dept | null;
      timesheetStatus: 'submitted' | 'draft' | 'missing' | 'approved' | 'rejected';
    }>;
  }>;
}

export interface DocProgressFeed {
  jobs: Array<{
    id: string;
    title: string;
    departments: Array<{
      dept: Dept;
      have: number;
      need: number;
      missing: string[];
    }>;
  }>;
}

export interface PendingActionsFeed {
  items: Array<{ severity: 'red'|'yellow'; text: string }>;
}

export interface AnnouncementsFeed {
  announcements: Array<{ id: string; message: string; level: string; created_at: string; active: boolean }>;
}

export class WallboardApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export class WallboardApi {
  private token?: string;
  private base = "/functions/v1/wallboard-feed";
  constructor(token?: string) { this.token = token; }

  private headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`, { headers: this.headers() });
    if (!res.ok) {
      throw new WallboardApiError(`${path} failed`, res.status);
    }
    return res.json();
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
}

export async function exchangeWallboardToken(shared: string): Promise<{ token: string; expiresIn: number }> {
  const res = await fetch(`/functions/v1/wallboard-auth?wallboardToken=${encodeURIComponent(shared)}`);
  if (!res.ok) throw new Error(`wallboard-auth failed: ${res.status}`);
  return res.json();
}

