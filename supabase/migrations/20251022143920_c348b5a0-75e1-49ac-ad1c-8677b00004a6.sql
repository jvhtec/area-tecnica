-- Update storage bucket to allow correct L-Acoustics Soundvision file types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/xml',
  'text/xml',
  'application/octet-stream'
]
WHERE id = 'soundvision-files';