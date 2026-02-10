-- Add per-document visibility controls and proper technician access to tour documents.
-- Goals:
--  - Tour documents are NOT implicitly visible to technicians.
--  - Management/admin can choose which docs are visible/downloadable by technicians.
--  - Technicians can upload docs if they are related to the tour (tour crew OR assigned to any job in the tour).
--  - Technicians assigned to any job in the tour (even if not in tour_assignments) can view/download visible docs.

-- -----------------------------------------------------------------------------
-- Schema: add visibility flag (mirrors job_documents.visible_to_tech)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tour_documents
ADD COLUMN IF NOT EXISTS visible_to_tech boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- RLS: tighten public.tour_documents
-- Existing prod policies were overly permissive for SELECT, causing techs to see
-- doc rows without storage access (confusing UX).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "p_tour_documents_public_select_819b06" ON public.tour_documents;
DROP POLICY IF EXISTS "p_tour_documents_public_insert_765422" ON public.tour_documents;
DROP POLICY IF EXISTS "p_tour_documents_public_update_dddd91" ON public.tour_documents;
DROP POLICY IF EXISTS "p_tour_documents_public_delete_6ae05b" ON public.tour_documents;

-- Select:
--  - admin/management/logistics: always
--  - technicians/house_tech: only when visible_to_tech AND (tour crew OR has active timesheets in tour)
CREATE POLICY "p_tour_documents_select"
ON public.tour_documents
FOR SELECT
USING (
  public.get_current_user_role() = ANY (ARRAY['admin','management','logistics'])
  OR (
    auth.uid() IS NOT NULL
    AND visible_to_tech = true
    AND (
      EXISTS (
        SELECT 1
        FROM public.tour_assignments ta
        WHERE ta.tour_id = tour_documents.tour_id
          AND ta.technician_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.timesheets ts
        JOIN public.jobs j ON j.id = ts.job_id
        LEFT JOIN public.tour_dates td ON td.id = j.tour_date_id
        WHERE ts.technician_id = auth.uid()
          AND ts.is_active = true
          AND (j.tour_id = tour_documents.tour_id OR td.tour_id = tour_documents.tour_id)
      )
    )
  )
);

-- Insert:
--  - admin/management/logistics: always
--  - technicians/house_tech: allowed only if related to the tour, must upload as themselves,
--    and must set visible_to_tech=true (so they can't create "hidden" docs).
CREATE POLICY "p_tour_documents_insert"
ON public.tour_documents
FOR INSERT
WITH CHECK (
  (
    public.get_current_user_role() = ANY (ARRAY['admin','management','logistics'])
  )
  OR (
    auth.uid() IS NOT NULL
    AND uploaded_by = auth.uid()
    AND visible_to_tech = true
    AND (
      EXISTS (
        SELECT 1
        FROM public.tour_assignments ta
        WHERE ta.tour_id = tour_documents.tour_id
          AND ta.technician_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.timesheets ts
        JOIN public.jobs j ON j.id = ts.job_id
        LEFT JOIN public.tour_dates td ON td.id = j.tour_date_id
        WHERE ts.technician_id = auth.uid()
          AND ts.is_active = true
          AND (j.tour_id = tour_documents.tour_id OR td.tour_id = tour_documents.tour_id)
      )
    )
  )
);

-- Update:
--  - admin/management only (used for visibility toggle / rename)
CREATE POLICY "p_tour_documents_update"
ON public.tour_documents
FOR UPDATE
USING (
  public.get_current_user_role() = ANY (ARRAY['admin','management'])
)
WITH CHECK (
  public.get_current_user_role() = ANY (ARRAY['admin','management'])
);

-- Delete:
--  - admin/management/logistics: always
--  - uploader: can delete their own document (useful for tech uploads)
CREATE POLICY "p_tour_documents_delete"
ON public.tour_documents
FOR DELETE
USING (
  public.get_current_user_role() = ANY (ARRAY['admin','management','logistics'])
  OR (auth.uid() IS NOT NULL AND uploaded_by = auth.uid())
);

-- -----------------------------------------------------------------------------
-- Storage RLS: bucket tour-documents
-- We gate storage access to match tour_documents visibility + assignment.
-- -----------------------------------------------------------------------------
-- SELECT (download/view): allow if referenced by a visible tour_documents row.
DROP POLICY IF EXISTS "p_storage_tour_documents_select_visible_to_tech" ON storage.objects;
CREATE POLICY "p_storage_tour_documents_select_visible_to_tech"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tour-documents'
  AND (
    public.get_current_user_role() = ANY (ARRAY['admin','management','logistics'])
    OR EXISTS (
      SELECT 1
      FROM public.tour_documents td
      WHERE td.file_path = storage.objects.name
        AND td.visible_to_tech = true
        AND (
          EXISTS (
            SELECT 1
            FROM public.tour_assignments ta
            WHERE ta.tour_id = td.tour_id
              AND ta.technician_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.timesheets ts
            JOIN public.jobs j ON j.id = ts.job_id
            LEFT JOIN public.tour_dates tdates ON tdates.id = j.tour_date_id
            WHERE ts.technician_id = auth.uid()
              AND ts.is_active = true
              AND (j.tour_id = td.tour_id OR tdates.tour_id = td.tour_id)
          )
        )
    )
  )
);

-- INSERT (upload): allow technicians when the object is under tours/<tourId>/ and they are related to that tour.
-- We validate the tourId from the path to avoid arbitrary writes.
DROP POLICY IF EXISTS "p_storage_tour_documents_insert_related_tour" ON storage.objects;
CREATE POLICY "p_storage_tour_documents_insert_related_tour"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tour-documents'
  AND (
    public.get_current_user_role() = ANY (ARRAY['admin','management','logistics'])
    OR (
      -- Path: tours/<tourId>/<file>
      split_part(name, '/', 1) = 'tours'
      AND split_part(name, '/', 2) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND (
        EXISTS (
          SELECT 1
          FROM public.tour_assignments ta
          WHERE ta.tour_id = (split_part(name, '/', 2))::uuid
            AND ta.technician_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.timesheets ts
          JOIN public.jobs j ON j.id = ts.job_id
          LEFT JOIN public.tour_dates tdates ON tdates.id = j.tour_date_id
          WHERE ts.technician_id = auth.uid()
            AND ts.is_active = true
            AND ((j.tour_id = (split_part(name, '/', 2))::uuid) OR (tdates.tour_id = (split_part(name, '/', 2))::uuid))
        )
      )
    )
  )
);

-- DELETE: allow management/logistics; allow uploader to delete via tour_documents row.
DROP POLICY IF EXISTS "p_storage_tour_documents_delete_uploader_or_mgmt" ON storage.objects;
CREATE POLICY "p_storage_tour_documents_delete_uploader_or_mgmt"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tour-documents'
  AND (
    public.get_current_user_role() = ANY (ARRAY['admin','management','logistics'])
    OR EXISTS (
      SELECT 1
      FROM public.tour_documents td
      WHERE td.file_path = storage.objects.name
        AND td.uploaded_by = auth.uid()
    )
  )
);
