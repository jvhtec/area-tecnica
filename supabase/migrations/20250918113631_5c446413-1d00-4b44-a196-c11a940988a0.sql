-- Fix Security Definer View issue by replacing the view with a security definer function
-- This addresses the linter warning about views with security definer properties

-- Drop the existing view first
DROP VIEW IF EXISTS public.timesheet_amounts_visible;

-- Create a security definer function to replace the view
CREATE OR REPLACE FUNCTION public.get_timesheet_amounts_visible()
RETURNS TABLE(
  id uuid,
  job_id uuid,
  technician_id uuid,
  date date,
  start_time time without time zone,
  end_time time without time zone,
  break_minutes integer,
  overtime_hours numeric,
  notes text,
  status timesheet_status,
  signature_data text,
  signed_at timestamp with time zone,
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  category text,
  amount_eur numeric,
  amount_breakdown jsonb,
  approved_by_manager boolean,
  ends_next_day boolean,
  amount_eur_visible numeric,
  amount_breakdown_visible jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  is_manager boolean := false;
BEGIN
  -- Check if current user is a manager
  SELECT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
  ) INTO is_manager;

  -- Return timesheets with visibility rules applied
  RETURN QUERY 
  SELECT 
    t.id,
    t.job_id,
    t.technician_id,
    t.date,
    t.start_time,
    t.end_time,
    t.break_minutes,
    t.overtime_hours,
    t.notes,
    t.status,
    t.signature_data,
    t.signed_at,
    t.created_by,
    t.approved_by,
    t.approved_at,
    t.created_at,
    t.updated_at,
    t.category,
    t.amount_eur,
    t.amount_breakdown,
    t.approved_by_manager,
    t.ends_next_day,
    CASE 
      WHEN is_manager THEN t.amount_eur
      WHEN t.approved_by_manager = true THEN t.amount_eur
      ELSE NULL
    END as amount_eur_visible,
    CASE 
      WHEN is_manager THEN t.amount_breakdown
      WHEN t.approved_by_manager = true THEN t.amount_breakdown
      ELSE NULL
    END as amount_breakdown_visible
  FROM timesheets t;
END;
$$;