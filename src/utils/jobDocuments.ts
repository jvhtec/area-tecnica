import type { SupabaseClient } from '@supabase/supabase-js';

const DEPT_PREFIXES = new Set(['sound','lights','video','production','logistics','administrative']);

export const resolveJobDocLocation = (path: string) => {
  const normalized = (path || '').replace(/^\/+/, '');
  const segments = normalized.split('/');
  const first = segments[0] ?? '';
  if (first === 'soundvision-files') {
    const sanitizedPath = segments.slice(1).join('/');
    return {
      bucket: 'soundvision-files',
      path: sanitizedPath,
    } as const;
  }

  return {
    bucket: DEPT_PREFIXES.has(first) ? 'job_documents' : 'job-documents',
    path: normalized,
  } as const;
};

export const resolveJobDocBucket = (path: string) => resolveJobDocLocation(path).bucket;

export const createSignedUrl = async (
  supabase: SupabaseClient,
  filePath: string,
  expiresInSeconds = 60
): Promise<string> => {
  const { bucket, path } = resolveJobDocLocation(filePath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Failed to generate signed URL');
  return data.signedUrl as string;
};

