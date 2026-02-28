DO $$
BEGIN
  ALTER TYPE public.job_type ADD VALUE IF NOT EXISTS 'ciclo';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

COMMENT ON TYPE public.job_type IS 'Job types: single, tour, festival, ciclo, dryhire, tourdate, evento. Evento jobs have rates locked to 12hr regardless of timesheet hours.';

CREATE OR REPLACE FUNCTION public.set_technician_payout_override(_job_id uuid, _technician_id uuid, _amount_eur numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_department text;
  v_tech_department text;
  v_has_permission boolean := false;
  v_old_amount numeric;
  v_new_amount numeric;
  v_job_title text;
  v_job_start_time timestamptz;
  v_job_type text;
  v_tech_name text;
  v_calculated_total numeric;
  v_result json;
begin
  -- Get current user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get user role and department
  select role, department
  into v_user_role, v_user_department
  from profiles
  where id = v_user_id;

  if v_user_role is null then
    raise exception 'User profile not found';
  end if;

  -- Get technician department and name
  select
    department,
    concat_ws(' ', first_name, last_name)
  into v_tech_department, v_tech_name
  from profiles
  where id = _technician_id;

  if v_tech_department is null then
    raise exception 'Technician not found or has no department';
  end if;

  -- Verify the technician is assigned to this job
  if not exists (
    select 1
    from job_assignments ja
    where ja.job_id = _job_id
      and ja.technician_id = _technician_id
  ) then
    raise exception 'Technician is not assigned to this job';
  end if;

  -- Check permissions
  -- Admin can override any assigned technician
  if v_user_role = 'admin' then
    v_has_permission := true;
  -- Management can only override technicians from their department
  elsif v_user_role = 'management' then
    if v_user_department is not null and v_user_department = v_tech_department then
      v_has_permission := true;
    end if;
  end if;

  if not v_has_permission then
    raise exception 'Permission denied: Only admin users and department managers can override technician payouts for their department';
  end if;

  -- Validate amount (numeric(10,2) allows max 99,999,999.99)
  if _amount_eur is null or _amount_eur < 0 then
    raise exception 'Override amount must be a non-negative number';
  end if;

  if _amount_eur > 99999999.99 then
    raise exception 'Override amount must not exceed 99,999,999.99 (database constraint)';
  end if;

  -- Get job info
  select title, start_time, job_type
  into v_job_title, v_job_start_time, v_job_type
  from jobs
  where id = _job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  -- Get current override value (if exists)
  select override_amount_eur
  into v_old_amount
  from job_technician_payout_overrides
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Get calculated total from base payout view (without any existing override)
  select total_eur
  into v_calculated_total
  from v_job_tech_payout_2025_base
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Upsert the override
  insert into job_technician_payout_overrides (
    job_id,
    technician_id,
    override_amount_eur,
    set_by,
    set_at,
    updated_at
  ) values (
    _job_id,
    _technician_id,
    _amount_eur,
    v_user_id,
    now(),
    now()
  )
  on conflict (job_id, technician_id)
  do update set
    override_amount_eur = _amount_eur,
    set_by = v_user_id,
    updated_at = now();

  v_new_amount := _amount_eur;

  -- Return result with old and new values for email notification
  v_result := json_build_object(
    'success', true,
    'job_id', _job_id,
    'job_title', v_job_title,
    'job_start_time', v_job_start_time,
    'job_type', v_job_type,
    'technician_id', _technician_id,
    'technician_name', v_tech_name,
    'technician_department', v_tech_department,
    'actor_id', v_user_id,
    'old_override_amount_eur', v_old_amount,
    'new_override_amount_eur', v_new_amount,
    'calculated_total_eur', v_calculated_total,
    'timestamp', now()
  );

  return v_result;
end;
$$;

COMMENT ON FUNCTION public.set_technician_payout_override(uuid, uuid, numeric) IS 'Set or update payout override for a specific technician on a job. Admin users can override any assigned technician. Department managers can only override technicians from their department.';

CREATE OR REPLACE FUNCTION public.remove_technician_payout_override(_job_id uuid, _technician_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_department text;
  v_tech_department text;
  v_has_permission boolean := false;
  v_old_amount numeric;
  v_job_title text;
  v_job_start_time timestamptz;
  v_job_type text;
  v_tech_name text;
  v_calculated_total numeric;
  v_result json;
begin
  -- Get current user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get user role and department
  select role, department
  into v_user_role, v_user_department
  from profiles
  where id = v_user_id;

  if v_user_role is null then
    raise exception 'User profile not found';
  end if;

  -- Get technician department and name
  select
    department,
    concat_ws(' ', first_name, last_name)
  into v_tech_department, v_tech_name
  from profiles
  where id = _technician_id;

  if v_tech_department is null then
    raise exception 'Technician not found or has no department';
  end if;

  -- Verify the technician is assigned to this job
  if not exists (
    select 1
    from job_assignments ja
    where ja.job_id = _job_id
      and ja.technician_id = _technician_id
  ) then
    raise exception 'Technician is not assigned to this job';
  end if;

  -- Check permissions
  -- Admin can remove any assigned technician override
  if v_user_role = 'admin' then
    v_has_permission := true;
  -- Management can only remove overrides for technicians from their department
  elsif v_user_role = 'management' then
    if v_user_department is not null and v_user_department = v_tech_department then
      v_has_permission := true;
    end if;
  end if;

  if not v_has_permission then
    raise exception 'Permission denied: Only admin users and department managers can remove technician payout overrides for their department';
  end if;

  -- Get current override value
  select override_amount_eur
  into v_old_amount
  from job_technician_payout_overrides
  where job_id = _job_id
    and technician_id = _technician_id;

  if v_old_amount is null then
    raise exception 'No override exists for this technician';
  end if;

  -- Get job info
  select title, start_time, job_type
  into v_job_title, v_job_start_time, v_job_type
  from jobs
  where id = _job_id;

  -- Get calculated total from base payout view (without any existing override)
  select total_eur
  into v_calculated_total
  from v_job_tech_payout_2025_base
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Delete the override
  delete from job_technician_payout_overrides
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Return result
  v_result := json_build_object(
    'success', true,
    'job_id', _job_id,
    'job_title', v_job_title,
    'job_start_time', v_job_start_time,
    'job_type', v_job_type,
    'technician_id', _technician_id,
    'technician_name', v_tech_name,
    'technician_department', v_tech_department,
    'actor_id', v_user_id,
    'old_override_amount_eur', v_old_amount,
    'new_override_amount_eur', null,
    'calculated_total_eur', v_calculated_total,
    'timestamp', now()
  );

  return v_result;
end;
$$;

COMMENT ON FUNCTION public.remove_technician_payout_override(uuid, uuid) IS 'Remove payout override for a specific assigned technician on a job.';
