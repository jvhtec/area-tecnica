import type { SupabaseClient } from '@supabase/supabase-js';

const DEPT_PREFIXES = new Set(['sound','lights','video','production','logistics','administrative']);

export const resolveJobDocBucket = (path: string) => {
  const first = (path || '').split('/')[0];
  return DEPT_PREFIXES.has(first) ? 'job_documents' : 'job-documents';
};

export const createSignedUrl = async (
  supabase: SupabaseClient,
  filePath: string,
  expiresInSeconds = 60
): Promise<string> => {
  const bucket = resolveJobDocBucket(filePath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Failed to generate signed URL');
  return data.signedUrl as string;
};

