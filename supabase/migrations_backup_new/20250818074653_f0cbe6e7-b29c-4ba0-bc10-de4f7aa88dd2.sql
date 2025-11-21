-- 1) Enable RLS and restrict access on inventory view/table
ALTER TABLE IF EXISTS public.current_stock_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read current stock levels" ON public.current_stock_levels;
CREATE POLICY "Authenticated can view current stock levels"
ON public.current_stock_levels
FOR SELECT
TO authenticated
USING (true);

-- 2) Replace overly-permissive SELECT policies with authenticated-only access
-- equipment
DROP POLICY IF EXISTS "All users can view equipment" ON public.equipment;
CREATE POLICY "Authenticated users can view equipment"
ON public.equipment
FOR SELECT
TO authenticated
USING (true);

-- equipment_models
DROP POLICY IF EXISTS "Everyone can view equipment models" ON public.equipment_models;
CREATE POLICY "Authenticated users can view equipment models"
ON public.equipment_models
FOR SELECT
TO authenticated
USING (true);

-- global_availability_presets
DROP POLICY IF EXISTS "All users can view global presets" ON public.global_availability_presets;
CREATE POLICY "Authenticated users can view global presets"
ON public.global_availability_presets
FOR SELECT
TO authenticated
USING (true);

-- hoja_de_ruta_templates (keep active filter but require auth)
DROP POLICY IF EXISTS "All users can view active templates" ON public.hoja_de_ruta_templates;
CREATE POLICY "Authenticated users can view active templates"
ON public.hoja_de_ruta_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- flex_folders
DROP POLICY IF EXISTS "Enable read access for all users" ON public.flex_folders;
CREATE POLICY "Authenticated users can view flex folders"
ON public.flex_folders
FOR SELECT
TO authenticated
USING (true);

-- 3) Address linter warnings: add search_path to functions missing it
CREATE OR REPLACE FUNCTION public.create_timesheets_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    job_start_date date;
    job_end_date date;
    work_date date;
BEGIN
    -- Get job dates
    SELECT DATE(start_time), DATE(end_time) 
    INTO job_start_date, job_end_date
    FROM jobs 
    WHERE id = NEW.job_id;
    
    -- Create timesheets for each day of the job
    work_date := job_start_date;
    WHILE work_date <= job_end_date LOOP
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            work_date,
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;
        
        work_date := work_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_tour_date_job()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- If this is a job with a tour_date_id, ensure it has the correct job_type and tour_id
  IF NEW.tour_date_id IS NOT NULL THEN
    -- Set job_type to 'tourdate' if not already set
    IF NEW.job_type != 'tourdate' THEN
      NEW.job_type := 'tourdate';
    END IF;
    
    -- Set tour_id from the tour_date if not already set
    IF NEW.tour_id IS NULL THEN
      SELECT tour_id INTO NEW.tour_id 
      FROM tour_dates 
      WHERE id = NEW.tour_date_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
