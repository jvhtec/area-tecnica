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
  constructor(token?: string) { this.token = token; }

  // Prefer Supabase invoke to avoid dev-server rewrites returning HTML
  private async request<T>(path: string): Promise<T> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const headers = this.token ? { "x-wallboard-jwt": this.token } : {};
      const { data, error } = await supabase.functions.invoke('wallboard-feed', {
        body: { path },
        headers,
        responseType: 'json'
      } as any);
      if (error) throw error;
      return data as T;
    } catch (err) {
      const res = await fetch(`/functions/v1/wallboard-feed${path}`, {
        headers: this.token ? { "x-wallboard-jwt": this.token } : {},
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
}

export async function exchangeWallboardToken(shared: string): Promise<{ token: string; expiresIn: number }> {
  // Prefer Supabase Edge Function invoke to avoid CORS/base-path issues
  try {
    const mod = await import('@/integrations/supabase/client');
    const supabase = mod.supabase;
    const { data, error } = await supabase.functions.invoke('wallboard-auth', {
      body: { wallboardToken: shared },
    });
    if (error) throw error;
    if (data?.token) return data as { token: string; expiresIn: number };
  } catch (err) {
    console.warn('wallboard-auth invoke fallback to fetch:', err);
  }

  const res = await fetch(`/functions/v1/wallboard-auth?wallboardToken=${encodeURIComponent(shared)}`);
  if (!res.ok) throw new Error(`wallboard-auth failed: ${res.status}`);
  return res.json();
}
