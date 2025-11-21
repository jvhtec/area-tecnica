-- Phase 1: Transform presets table for shared equipment presets
-- Make user_id nullable (existing presets keep their user_id for now)
ALTER TABLE public.presets 
  ALTER COLUMN user_id DROP NOT NULL;

-- Add audit and template fields
ALTER TABLE public.presets 
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

-- Backfill created_by with user_id for existing records
UPDATE public.presets 
SET created_by = user_id 
WHERE created_by IS NULL AND user_id IS NOT NULL;

-- Phase 2: Update day_preset_assignments for multiple presets per date
-- Drop the unique constraint that prevents multiple presets per date
ALTER TABLE public.day_preset_assignments 
  DROP CONSTRAINT IF EXISTS day_preset_assignments_user_id_date_key;

-- Add assigned_by for audit trail
ALTER TABLE public.day_preset_assignments 
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- Phase 3: Create sub_rentals table for temporary stock increments
CREATE TABLE IF NOT EXISTS public.sub_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable RLS on sub_rentals
ALTER TABLE public.sub_rentals ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at on sub_rentals
CREATE TRIGGER set_sub_rentals_updated_at
  BEFORE UPDATE ON public.sub_rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 4: Update RLS policies for department-wide shared presets

-- Drop old restrictive policies on presets
DROP POLICY IF EXISTS "Users can manage own presets" ON public.presets;
DROP POLICY IF EXISTS "Users can view own presets" ON public.presets;

-- New policies: Lights department can manage all presets
CREATE POLICY "Lights department can view all presets"
  ON public.presets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND department = 'lights'
    )
  );

CREATE POLICY "Lights department can create presets"
  ON public.presets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND department = 'lights'
    )
  );

CREATE POLICY "Lights department can update presets"
  ON public.presets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND department = 'lights'
    )
  );

CREATE POLICY "Lights department can delete presets"
  ON public.presets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND department = 'lights'
    )
  );

-- Update preset_items policies to match
DROP POLICY IF EXISTS "Users can manage own preset items" ON public.preset_items;

CREATE POLICY "Lights department can manage preset items"
  ON public.preset_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND department = 'lights'
    )
  );

-- Update day_preset_assignments policies for department-wide access
DROP POLICY IF EXISTS "Users can manage day preset assignments" ON public.day_preset_assignments;

CREATE POLICY "Lights department can manage preset assignments"
  ON public.day_preset_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND department = 'lights'
    )
  );

-- Sub-rentals policies
CREATE POLICY "Lights department can manage sub-rentals"
  ON public.sub_rentals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND department = 'lights'
    )
  );

-- Create view for equipment availability including sub-rentals
CREATE OR REPLACE VIEW public.equipment_availability_with_rentals AS
SELECT 
  e.id as equipment_id,
  e.name as equipment_name,
  e.category,
  COALESCE(csl.current_quantity, 0) as base_quantity,
  COALESCE(
    (SELECT SUM(sr.quantity) 
     FROM public.sub_rentals sr 
     WHERE sr.equipment_id = e.id 
     AND CURRENT_DATE BETWEEN sr.start_date AND sr.end_date
    ), 0
  ) as rental_boost,
  COALESCE(csl.current_quantity, 0) + COALESCE(
    (SELECT SUM(sr.quantity) 
     FROM public.sub_rentals sr 
     WHERE sr.equipment_id = e.id 
     AND CURRENT_DATE BETWEEN sr.start_date AND sr.end_date
    ), 0
  ) as total_available
FROM public.equipment e
LEFT JOIN public.current_stock_levels csl ON csl.equipment_id = e.id;

-- Grant access to the view
GRANT SELECT ON public.equipment_availability_with_rentals TO authenticated;