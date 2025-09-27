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
      timesheetStatus: 'submitted' | 'draft' | 'missing' | 'approved';
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

export class WallboardApi {
  private token?: string;
  private base = "/functions/v1/wallboard-feed";
  constructor(token?: string) { this.token = token; }

  private headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async jobsOverview(): Promise<JobsOverviewFeed> {
    const res = await fetch(`${this.base}/jobs-overview`, { headers: this.headers() });
    if (!res.ok) throw new Error(`jobs-overview failed: ${res.status}`);
    return res.json();
  }
  async crewAssignments(): Promise<CrewAssignmentsFeed> {
    const res = await fetch(`${this.base}/crew-assignments`, { headers: this.headers() });
    if (!res.ok) throw new Error(`crew-assignments failed: ${res.status}`);
    return res.json();
  }
  async docProgress(): Promise<DocProgressFeed> {
    const res = await fetch(`${this.base}/doc-progress`, { headers: this.headers() });
    if (!res.ok) throw new Error(`doc-progress failed: ${res.status}`);
    return res.json();
  }
  async pendingActions(): Promise<PendingActionsFeed> {
    const res = await fetch(`${this.base}/pending-actions`, { headers: this.headers() });
    if (!res.ok) throw new Error(`pending-actions failed: ${res.status}`);
    return res.json();
  }
  async announcements(): Promise<AnnouncementsFeed> {
    const res = await fetch(`${this.base}/announcements`, { headers: this.headers() });
    if (!res.ok) throw new Error(`announcements failed: ${res.status}`);
    return res.json();
  }
}

export async function exchangeWallboardToken(shared: string): Promise<{ token: string; expiresIn: number }> {
  const res = await fetch(`/functions/v1/wallboard-auth?wallboardToken=${encodeURIComponent(shared)}`);
  if (!res.ok) throw new Error(`wallboard-auth failed: ${res.status}`);
  return res.json();
}

