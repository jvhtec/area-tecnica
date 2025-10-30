import { supabase } from '@/lib/supabase';

/**
 * Upload a Tour Schedule PDF to the tour-documents bucket and insert DB record.
 * Returns the `file_path` stored and a public or signed URL to reference in messages.
 */
export async function uploadTourPdfWithRecord(
  tourId: string,
  pdfBlob: Blob,
  suggestedFileName: string
): Promise<{ file_path: string; url: string }> {
  const sanitize = (s: string) => s
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');

  const base = sanitize((suggestedFileName || 'tour_schedule.pdf').replace(/\.pdf$/i,'') || 'tour_schedule');
  const ts = new Date();
  const pad = (n:number)=> String(n).padStart(2,'0');
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}`;
  const fileName = `${base}_${stamp}.pdf`;
  const objectPath = `schedules/${tourId}/${fileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('tour-documents')
    .upload(objectPath, pdfBlob, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });
  if (uploadError) throw uploadError;

  // Insert DB record
  const { data: userRes } = await supabase.auth.getUser();
  const { error: dbError } = await supabase
    .from('tour_documents')
    .insert({
      tour_id: tourId,
      file_name: fileName,
      file_path: objectPath,
      file_type: 'application/pdf',
      file_size: pdfBlob.size,
      uploaded_by: userRes?.user?.id || null,
    });
  if (dbError) throw dbError;

  // Always return a signed URL (bucket is private)
  const { data: signed, error: sigErr } = await supabase.storage
    .from('tour-documents')
    .createSignedUrl(objectPath, 3600);
  if (sigErr || !signed?.signedUrl) {
    throw sigErr || new Error('Failed to create URL for uploaded tour PDF');
  }
  return { file_path: objectPath, url: signed.signedUrl };
}
