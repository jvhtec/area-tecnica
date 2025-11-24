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

  // Prefer Supabase invoke to avoid dev-server rewrites returning HTML
  private async request<T>(path: string): Promise<T> {
    // Try supabase.functions.invoke first
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const headers: Record<string, string> = {};
      if (this.token) {
        headers["x-wallboard-jwt"] = this.token;
      }
      const { data, error } = await supabase.functions.invoke('wallboard-feed', {
        body: { path },
        headers,
      });
      if (error) {
        console.warn('wallboard-feed invoke error, falling back to fetch:', error);
        throw error;
      }
      return data as T;
    } catch (err) {
      // Fallback to direct fetch
      console.log('wallboard-feed fallback fetch for path:', path);
      const anon =
        (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
        (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers: Record<string, string> = {};
      // Always set x-wallboard-jwt if we have a token
      if (this.token) {
        headers["x-wallboard-jwt"] = this.token;
      }
      // Add anon key for Supabase routing (required for edge function access)
      if (anon) {
        headers["apikey"] = anon;
        // Only set Authorization if we don't have a wallboard token
        // to avoid confusion in the edge function authentication
        if (!this.token) {
          headers["Authorization"] = `Bearer ${anon}`;
        }
      }
      const res = await fetch(`/functions/v1/wallboard-feed${path}`, {
        method: 'GET',
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
  presetConfig(): Promise<PresetConfigFeed> {
    return this.request('/preset-config');
  }
}

export async function exchangeWallboardToken(shared: string, presetSlug?: string): Promise<{ token: string; expiresIn: number; preset?: string }> {
  // Prefer Supabase Edge Function invoke to avoid CORS/base-path issues
  try {
    const mod = await import('@/integrations/supabase/client');
    const supabase = mod.supabase;
    console.log('🔐 Attempting wallboard-auth via Supabase invoke...');
    const { data, error } = await supabase.functions.invoke('wallboard-auth', {
      body: { wallboardToken: shared, preset: presetSlug, presetSlug },
    });
    if (error) {
      console.warn('wallboard-auth invoke error:', error);
      throw error;
    }
    if (data?.token) {
      console.log('✅ wallboard-auth invoke successful');
      return data as { token: string; expiresIn: number; preset?: string };
    }
    // If no token in response, throw to trigger fallback
    throw new Error('No token in response');
  } catch (err) {
    console.warn('wallboard-auth invoke fallback to fetch:', err);
  }

  // Fallback to direct fetch
  console.log('🔄 Trying wallboard-auth via direct fetch...');
  const anon =
    (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
    (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

  let url = `/functions/v1/wallboard-auth?wallboardToken=${encodeURIComponent(shared)}`;
  if (presetSlug) {
    url += `&preset=${encodeURIComponent(presetSlug)}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (anon) {
    headers['apikey'] = anon;
    headers['Authorization'] = `Bearer ${anon}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`wallboard-auth failed: ${res.status} ${errorText}`);
  }

  const result = await res.json();
  if (!result?.token) {
    throw new Error('wallboard-auth returned no token');
  }

  console.log('✅ wallboard-auth fetch successful');
  return result;
}
