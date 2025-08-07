-- Fix remaining database function security issues

-- Update remaining functions to use SET search_path = 'public'
CREATE OR REPLACE FUNCTION public.update_hoja_de_ruta_last_modified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    NEW.last_modified = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_vacation_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tour_dates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE tours 
  SET 
    start_date = subquery.min_date,
    end_date = subquery.max_date
  FROM (
    SELECT 
      tour_id,
      MIN(start_date) as min_date,
      MAX(end_date) as max_date
    FROM tour_dates 
    WHERE tour_id IS NOT NULL
    GROUP BY tour_id
  ) as subquery
  WHERE tours.id = subquery.tour_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_tour_start_end_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Update the tour's start_date and end_date based on all its tour_dates
  UPDATE tours 
  SET 
    start_date = (
      SELECT MIN(start_date) 
      FROM tour_dates 
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
    ),
    end_date = (
      SELECT MAX(end_date) 
      FROM tour_dates 
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
    )
  WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;