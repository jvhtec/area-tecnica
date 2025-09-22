export type ActivityVisibility =
  | 'management'
  | 'house_plus_job'
  | 'job_participants'
  | 'actor_only';

export type ActivitySeverity = 'info' | 'success' | 'warn' | 'error';

export interface ActivityLogEntry {
  id: string;
  code: string;
  job_id: string | null;
  actor_id: string;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  visibility: ActivityVisibility;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityCatalogEntry {
  code: string;
  label: string;
  default_visibility: ActivityVisibility;
  severity: ActivitySeverity;
  toast_enabled: boolean;
  template?: string | null;
}

export interface ActivityPreferences {
  user_id: string;
  muted_codes: string[] | null;
  mute_toasts: boolean | null;
  created_at?: string;
  updated_at?: string;
}
