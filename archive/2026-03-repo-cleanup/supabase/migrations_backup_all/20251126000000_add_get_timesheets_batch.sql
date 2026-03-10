-- Batch visibility-aware timesheet fetch to replace N+1 RPC calls
-- Returns the same shape as get_timesheet_with_visible_amounts but for an array of IDs

CREATE OR REPLACE FUNCTION public.get_timesheets_batch(
  _timesheet_ids uuid[],
  _user_id uuid DEFAULT auth.uid()
) RETURNS TABLE (
  id uuid,
  job_id uuid,
  technician_id uuid,
  date date,
  start_time time without time zone,
  end_time time without time zone,
  break_minutes integer,
  overtime_hours numeric,
  notes text,
  status public.timesheet_status,
  signature_data text,
  signed_at timestamptz,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  category text,
  amount_eur numeric,
  amount_breakdown jsonb,
  approved_by_manager boolean,
  ends_next_day boolean,
  amount_eur_visible numeric,
  amount_breakdown_visible jsonb
) 
SECURITY DEFINER
SET search_path = public
AS $$
  -- Reuse existing visibility rules and filter by requested IDs
  SELECT vis.*
  FROM public.get_timesheet_amounts_visible() AS vis
  WHERE vis.id = ANY (_timesheet_ids)
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_timesheets_batch(uuid[], uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_timesheets_batch(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_timesheets_batch(uuid[], uuid) TO service_role;
