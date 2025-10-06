-- Generalize presets RLS across departments and add optional tour association

-- Ensure the relevant tables have RLS enabled
ALTER TABLE IF EXISTS public.presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.preset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.day_preset_assignments ENABLE ROW LEVEL SECURITY;

-- Make created_by default to the current user for auditability
ALTER TABLE public.presets 
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Add optional tour association to presets
ALTER TABLE public.presets 
  ADD COLUMN IF NOT EXISTS tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_presets_tour_department ON public.presets(tour_id, department);

-- Set presets.department automatically from the current user's profile on insert
CREATE OR REPLACE FUNCTION public.presets_set_department_from_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  dep text;
BEGIN
  SELECT department INTO dep FROM public.profiles WHERE id = auth.uid();
  IF dep IS NOT NULL THEN
    NEW.department := dep;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_presets_department ON public.presets;
CREATE TRIGGER set_presets_department
  BEFORE INSERT ON public.presets
  FOR EACH ROW
  EXECUTE FUNCTION public.presets_set_department_from_user();

-- Drop legacy lights-only policies
DROP POLICY IF EXISTS "Lights department can view all presets" ON public.presets;
DROP POLICY IF EXISTS "Lights department can create presets" ON public.presets;
DROP POLICY IF EXISTS "Lights department can update presets" ON public.presets;
DROP POLICY IF EXISTS "Lights department can delete presets" ON public.presets;
DROP POLICY IF EXISTS "Lights department can manage preset items" ON public.preset_items;
DROP POLICY IF EXISTS "Lights department can manage preset assignments" ON public.day_preset_assignments;

-- Department-based policies for presets
CREATE POLICY "Department can view presets"
  ON public.presets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid()
        AND pf.department = public.presets.department
    )
  );

CREATE POLICY "Department can insert presets"
  ON public.presets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid()
        AND pf.department = public.presets.department
    )
  );

CREATE POLICY "Department can update presets"
  ON public.presets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid()
        AND pf.department = public.presets.department
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid()
        AND pf.department = public.presets.department
    )
  );

CREATE POLICY "Department can delete presets"
  ON public.presets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid()
        AND pf.department = public.presets.department
    )
  );

-- Department-based policies for preset_items (via parent preset)
CREATE POLICY "Department can manage preset items"
  ON public.preset_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 
      FROM public.presets pr 
      JOIN public.profiles pf ON pf.id = auth.uid()
      WHERE pr.id = public.preset_items.preset_id 
        AND pf.department = pr.department
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.presets pr 
      JOIN public.profiles pf ON pf.id = auth.uid()
      WHERE pr.id = public.preset_items.preset_id 
        AND pf.department = pr.department
    )
  );

-- Department-based policies for day_preset_assignments (via preset)
CREATE POLICY "Department can manage preset assignments"
  ON public.day_preset_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 
      FROM public.presets pr 
      JOIN public.profiles pf ON pf.id = auth.uid()
      WHERE pr.id = public.day_preset_assignments.preset_id 
        AND pf.department = pr.department
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.presets pr 
      JOIN public.profiles pf ON pf.id = auth.uid()
      WHERE pr.id = public.day_preset_assignments.preset_id 
        AND pf.department = pr.department
    )
  );

