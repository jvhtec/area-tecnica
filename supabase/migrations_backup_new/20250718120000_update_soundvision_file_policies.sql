BEGIN;

DROP POLICY IF EXISTS "soundvision_files_select_authenticated" ON public.soundvision_files;
CREATE POLICY "soundvision_files_select_authenticated"
  ON public.soundvision_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role IN ('admin', 'management')
          OR COALESCE(profiles.soundvision_access_enabled, false)
          OR (profiles.role = 'house_tech' AND profiles.department = 'sound')
        )
    )
  );

DROP POLICY IF EXISTS "soundvision_files_insert_authorized" ON public.soundvision_files;
CREATE POLICY "soundvision_files_insert_authorized"
  ON public.soundvision_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role IN ('admin', 'management')
          OR COALESCE(profiles.soundvision_access_enabled, false)
          OR (profiles.role = 'house_tech' AND profiles.department = 'sound')
        )
    )
  );

DROP POLICY IF EXISTS "soundvision_files_update_owner_or_management" ON public.soundvision_files;
CREATE POLICY "soundvision_files_update_authorized"
  ON public.soundvision_files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role IN ('admin', 'management')
          OR COALESCE(profiles.soundvision_access_enabled, false)
          OR (profiles.role = 'house_tech' AND profiles.department = 'sound')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role IN ('admin', 'management')
          OR COALESCE(profiles.soundvision_access_enabled, false)
          OR (profiles.role = 'house_tech' AND profiles.department = 'sound')
        )
    )
  );

COMMIT;
