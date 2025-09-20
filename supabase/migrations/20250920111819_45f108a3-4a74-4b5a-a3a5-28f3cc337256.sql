-- Create function to calculate job-level total amounts with visibility rules
CREATE OR REPLACE FUNCTION public.get_job_total_amounts(_job_id uuid, _user_role text DEFAULT NULL)
RETURNS TABLE(
  job_id uuid,
  total_approved_eur numeric,
  total_pending_eur numeric,
  breakdown_by_category jsonb,
  individual_amounts jsonb,
  user_can_see_all boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_manager boolean := false;
  user_has_approved_timesheet boolean := false;
BEGIN
  -- Check if current user is a manager
  SELECT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = current_user_id AND p.role IN ('admin', 'management')
  ) INTO is_manager;

  -- Check if user has any approved timesheet for this job (for visibility)
  SELECT EXISTS (
    SELECT 1 FROM timesheets t
    WHERE t.job_id = _job_id 
    AND t.technician_id = current_user_id 
    AND t.approved_by_manager = true
  ) INTO user_has_approved_timesheet;

  -- Return job totals with proper visibility
  RETURN QUERY
  WITH approved_timesheets AS (
    SELECT 
      t.*,
      p.first_name,
      p.last_name,
      p.role as user_role
    FROM timesheets t
    JOIN profiles p ON p.id = t.technician_id
    WHERE t.job_id = _job_id
    AND t.approved_by_manager = true
    AND t.amount_eur IS NOT NULL
  ),
  pending_timesheets AS (
    SELECT 
      t.*,
      p.first_name,
      p.last_name,
      p.role as user_role
    FROM timesheets t
    JOIN profiles p ON p.id = t.technician_id
    WHERE t.job_id = _job_id
    AND (t.approved_by_manager = false OR t.approved_by_manager IS NULL)
    AND t.status = 'submitted'
  ),
  category_totals AS (
    SELECT 
      COALESCE(t.category, 'unknown') as category,
      COUNT(*) as timesheet_count,
      SUM(COALESCE(t.amount_eur, 0)) as total_eur,
      jsonb_agg(
        jsonb_build_object(
          'technician_name', COALESCE(t.first_name || ' ' || t.last_name, 'Unknown'),
          'amount_eur', t.amount_eur,
          'date', t.date
        ) ORDER BY t.date
      ) as individual_entries
    FROM approved_timesheets t
    GROUP BY COALESCE(t.category, 'unknown')
  )
  SELECT 
    _job_id,
    COALESCE((SELECT SUM(amount_eur) FROM approved_timesheets), 0) as total_approved_eur,
    COALESCE((SELECT COUNT(*) FROM pending_timesheets), 0) as total_pending_eur,
    COALESCE(
      (SELECT jsonb_object_agg(category, jsonb_build_object(
        'count', timesheet_count,
        'total_eur', total_eur,
        'individual_entries', individual_entries
      )) FROM category_totals),
      '{}'::jsonb
    ) as breakdown_by_category,
    CASE 
      WHEN is_manager OR user_has_approved_timesheet THEN
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'technician_name', first_name || ' ' || last_name,
              'category', category,
              'amount_eur', amount_eur,
              'date', date
            ) ORDER BY date, first_name
          ) FROM approved_timesheets),
          '[]'::jsonb
        )
      ELSE '[]'::jsonb
    END as individual_amounts,
    (is_manager OR user_has_approved_timesheet) as user_can_see_all;
END;
$$;