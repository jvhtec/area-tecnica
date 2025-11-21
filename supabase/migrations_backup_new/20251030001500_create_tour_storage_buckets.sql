-- Create storage buckets for Tour features
-- Idempotent: safe to run multiple times

-- tour-documents: stores PDFs and documents associated with tours
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-documents',
  'tour-documents',
  false,
  104857600, -- 100MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/msword', -- .doc
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- tour-logos: stores logo assets for tours
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-logos',
  'tour-logos',
  false,
  52428800, -- 50MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS policies for these buckets are defined in earlier migrations
-- (see 20250818082817_6baa66d0-cbe5-4de7-b8b5-42af8491211a.sql)

