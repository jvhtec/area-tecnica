-- Exclude house_tech from seeing timesheet amounts entirely
-- Managers always see; technicians see after manager approval; house_tech never sees

DROP FUNCTION IF EXISTS get_timesheet_with_visible_amounts(uuid);

CREATE OR REPLACE FUNCTION get_timesheet_with_visible_amounts(_timesheet_id uuid)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  technician_id uuid,
  date date,
  start_time time,
  end_time time,
  break_minutes integer,
  overtime_hours numeric(4,2),
  notes text,
  status timesheet_status,
  signature_data text,
  signed_at timestamptz,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  category text,
  amount_eur numeric(10,2),
  amount_breakdown jsonb,
  approved_by_manager boolean,
  amount_eur_visible numeric(10,2),
  amount_breakdown_visible jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_record record;
  is_manager boolean := false;
  is_house_tech boolean := false;
BEGIN
  -- Determine current user's role flags
  SELECT 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
    ) AS manager,
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role = 'house_tech'
    ) AS house_tech
  INTO is_manager, is_house_tech;

  -- Get the timesheet record
  SELECT * INTO t_record FROM timesheets WHERE timesheets.id = _timesheet_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    t_record.id,
    t_record.job_id,
    t_record.technician_id,
    t_record.date,
    t_record.start_time,
    t_record.end_time,
    t_record.break_minutes,
    t_record.overtime_hours,
    t_record.notes,
    t_record.status,
    t_record.signature_data,
    t_record.signed_at,
    t_record.created_by,
    t_record.approved_by,
    t_record.approved_at,
    t_record.created_at,
    t_record.updated_at,
    t_record.category,
    t_record.amount_eur,
    t_record.amount_breakdown,
    t_record.approved_by_manager,
    CASE 
      WHEN is_manager THEN t_record.amount_eur
      WHEN is_house_tech THEN NULL
      WHEN t_record.approved_by_manager = true THEN t_record.amount_eur
      ELSE NULL
    END as amount_eur_visible,
    CASE 
      WHEN is_manager THEN t_record.amount_breakdown
      WHEN is_house_tech THEN NULL
      WHEN t_record.approved_by_manager = true THEN t_record.amount_breakdown
      ELSE NULL
    END as amount_breakdown_visible;
END;
$$;
