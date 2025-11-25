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

export interface LogisticsItem {
  id: string;
  date: string;
  time: string;
  title: string;
  transport_type: string | null;
  transport_provider: string | null; // NEW
  plate: string | null;
  job_title?: string | null;
  procedure: string | null;
  loadingBay: string | null;
  departments: string[];
  color?: string | null;
  notes?: string | null; // NEW
}

export interface LogisticsFeed {
  items: LogisticsItem[];
}

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
      const anon =
        (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
        (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers: Record<string, string> = this.token ? { "x-wallboard-jwt": this.token } : {};
      if (anon) {
        headers["Authorization"] = `Bearer ${anon}`;
      }
      const res = await fetch(`/functions/v1/wallboard-feed${path}`, {
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

  let url = `/functions/v1/wallboard-auth?wallboardToken=${encodeURIComponent(shared)}`;
  if (presetSlug) {
    url += `&preset=${encodeURIComponent(presetSlug)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wallboard-auth failed: ${res.status}`);
  return res.json();
}
