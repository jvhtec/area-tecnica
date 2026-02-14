import { supabase } from "@/lib/supabase";

export type SignedUrlResult = { signedUrl: string | null };

export const resolveBucketForTaskDocs = (department?: 'sound'|'lights'|'video'|'production'|'administrative') => {
  // Keep compatibility with mixed bucket names during migration
  return 'task_documents';
};

export async function createSignedUrl(bucket: string, filePath: string, expiresIn = 3600): Promise<SignedUrlResult> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn);
  if (error) return { signedUrl: null };
  return { signedUrl: data?.signedUrl || null };
}

export async function download(bucket: string, filePath: string): Promise<Blob | null> {
  const { data } = await supabase.storage.from(bucket).download(filePath);
  return data || null;
}

export async function remove(bucket: string, filePath: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  return !error;
}

export async function upload(bucket: string, filePath: string, file: File | Blob): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
  return !error;
}
