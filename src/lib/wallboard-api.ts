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

  // Use fetch directly for wallboard authentication as invoke() doesn't pass custom headers
  private async request<T>(path: string): Promise<T> {
    // When authenticated with wallboard token, use fetch directly
    // supabase.functions.invoke() doesn't properly pass custom headers like x-wallboard-jwt
    if (this.token) {
      // Use full Supabase URL to avoid dev server interception
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      console.log('Making authenticated request to', path, 'with token length:', this.token.length);
      const res = await fetch(`${supabaseUrl}/functions/v1/wallboard-feed${path}`, {
        headers: {
          "Authorization": `Bearer ${supabaseKey}`, // Supabase platform requires this
          "apikey": supabaseKey,
          "x-wallboard-jwt": this.token // Our custom JWT for Edge Function
        },
        cache: 'no-store'
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`${path} failed (${res.status}):`, text);
        throw new WallboardApiError(`${path} failed`, res.status);
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await res.text();
        console.error(`${path} returned non-JSON:`, text);
        throw new WallboardApiError(`${path} returned non-JSON`, res.status);
      }
      return res.json();
    }

    // For unauthenticated requests, try invoke first (better for dev environments)
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('wallboard-feed', {
        body: { path },
        responseType: 'json'
      } as any);
      if (error) throw error;
      return data as T;
    } catch (err) {
      console.log('Falling back to fetch for', path);
      const res = await fetch(`/functions/v1/wallboard-feed${path}`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new WallboardApiError(`${path} failed`, res.status);
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
  presetConfig(): Promise<PresetConfigFeed> {
    return this.request('/preset-config');
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
