BEGIN;

-- 1) Extend equipment with printable identifiers
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS barcode_number text,
  ADD COLUMN IF NOT EXISTS stencil_number text;

-- 2) Store anonymous/public incident reports with captured identifiers
CREATE TABLE IF NOT EXISTS public.public_incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL,
  equipment_name text NOT NULL,
  department text NOT NULL,
  issue_description text NOT NULL,
  actions_taken text,
  reporter_name text,
  contact text,
  barcode_number text,
  stencil_number text,
  signature_data text NOT NULL,
  honeypot_value text,
  photo_path text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_title_snapshot text,
  job_status_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','triaged','dismissed']::text[])),
  triaged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  triaged_at timestamptz,
  triage_notes text,
  pdf_storage_path text,
  pdf_generated_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  triage_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'public'
);

CREATE INDEX IF NOT EXISTS idx_public_incident_reports_equipment_id ON public.public_incident_reports (equipment_id);
CREATE INDEX IF NOT EXISTS idx_public_incident_reports_status ON public.public_incident_reports (status);
CREATE INDEX IF NOT EXISTS idx_public_incident_reports_job_id ON public.public_incident_reports (job_id);
CREATE INDEX IF NOT EXISTS idx_public_incident_reports_created_at ON public.public_incident_reports (created_at DESC);

ALTER TABLE public.public_incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "public_incident_reports_select_admins" ON public.public_incident_reports
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin','management']::text[])
    )
  );

CREATE POLICY IF NOT EXISTS "public_incident_reports_insert_service_role" ON public.public_incident_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "public_incident_reports_update_admins" ON public.public_incident_reports
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin','management']::text[])
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin','management']::text[])
    )
  );

CREATE POLICY IF NOT EXISTS "public_incident_reports_delete_admins" ON public.public_incident_reports
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin']::text[])
    )
  );

-- 3) Dedicated storage bucket for anonymous uploads handled by Edge Functions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-incident-photos',
  'public-incident-photos',
  false,
  5242880,
  ARRAY['image/png','image/jpeg','image/heic','image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow Edge Functions (service role) to manage uploads
CREATE POLICY IF NOT EXISTS "service_role_manage_public_incident_photos" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'public-incident-photos' AND auth.role() = 'service_role'
  )
  WITH CHECK (
    bucket_id = 'public-incident-photos' AND auth.role() = 'service_role'
  );

-- Allow admins/management to review attachments directly from the UI
CREATE POLICY IF NOT EXISTS "admins_read_public_incident_photos" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'public-incident-photos' AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin','management']::text[])
      )
    )
  );

COMMIT;
