import { supabase } from '@/integrations/supabase/client';
import type { ActivityLogEntry, ActivityPreferences } from './types';

interface ListActivityParams {
  jobId?: string;
  limit?: number;
  lt?: string;
}

export async function listActivity({ jobId, limit = 30, lt }: ListActivityParams): Promise<ActivityLogEntry[]> {
  let query = supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (jobId) {
    query = query.eq('job_id', jobId);
  }

  if (lt) {
    query = query.lt('created_at', lt);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as ActivityLogEntry[];
}

export async function markActivityRead(ids: string[], userId: string): Promise<void> {
  if (!ids.length) return;

  const rows = ids.map((id) => ({ user_id: userId, activity_id: id }));

  const { error } = await supabase
    .from('activity_reads')
    .insert(rows, { ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}

export async function getActivityPreferences(userId: string): Promise<ActivityPreferences | null> {
  const { data, error } = await supabase
    .from('activity_prefs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as ActivityPreferences | null) ?? null;
}

export async function updateActivityPreferences(
  userId: string,
  prefs: Partial<Pick<ActivityPreferences, 'muted_codes' | 'mute_toasts'>>
): Promise<ActivityPreferences> {
  const payload = {
    user_id: userId,
    muted_codes: prefs.muted_codes ?? null,
    mute_toasts: prefs.mute_toasts ?? null,
  };

  const { data, error } = await supabase
    .from('activity_prefs')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ActivityPreferences;
}
