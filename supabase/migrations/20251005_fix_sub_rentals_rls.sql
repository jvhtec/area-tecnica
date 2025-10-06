-- Fix sub_rentals RLS to work across departments and set department automatically

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.sub_rentals ENABLE ROW LEVEL SECURITY;

-- Make created_by default to current auth uid for auditability
ALTER TABLE public.sub_rentals 
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Drop legacy lights-only policy
DROP POLICY IF EXISTS "Lights department can manage sub-rentals" ON public.sub_rentals;

-- Departmental policies
CREATE POLICY "Department can view sub_rentals"
  ON public.sub_rentals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
  );

CREATE POLICY "Department can insert sub_rentals"
  ON public.sub_rentals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
  );

CREATE POLICY "Department can update sub_rentals"
  ON public.sub_rentals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
  );

CREATE POLICY "Department can delete sub_rentals"
  ON public.sub_rentals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = public.sub_rentals.department
    )
  );

-- Keep sub_rentals.department consistent with equipment.department
CREATE OR REPLACE FUNCTION public.sub_rentals_set_department_from_equipment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always set department based on the selected equipment
  SELECT e.department INTO NEW.department
  FROM public.equipment e
  WHERE e.id = NEW.equipment_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sub_rentals_department ON public.sub_rentals;
CREATE TRIGGER set_sub_rentals_department
  BEFORE INSERT OR UPDATE OF equipment_id ON public.sub_rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.sub_rentals_set_department_from_equipment();

