-- Add payout override fields to jobs table
alter table jobs
  add column payout_override_enabled boolean not null default false,
  add column payout_override_amount_eur numeric(10,2) null,
  add column payout_override_set_by text null,
  add column payout_override_set_at timestamptz null;

-- Add comment for documentation
comment on column jobs.payout_override_enabled is 'When true, use payout_override_amount_eur instead of calculated totals';
comment on column jobs.payout_override_amount_eur is 'Manual override amount in EUR for total job payout';
comment on column jobs.payout_override_set_by is 'User ID who set the override';
comment on column jobs.payout_override_set_at is 'Timestamp when override was set';

-- Create RPC function to set job payout override with proper permissions
create or replace function set_job_payout_override(
  _job_id text,
  _enabled boolean,
  _amount_eur numeric default null
) returns json
language plpgsql
security definer
as $$
declare
  v_user_id text;
  v_user_role text;
  v_user_department text;
  v_job_department text;
  v_has_permission boolean := false;
  v_old_enabled boolean;
  v_old_amount numeric;
  v_new_enabled boolean;
  v_new_amount numeric;
  v_job_title text;
  v_job_start_time timestamptz;
  v_result json;
begin
  -- Get current user
  v_user_id := auth.uid()::text;
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

  -- Get job department (from the job's location or assigned technicians)
  -- For simplicity, we'll get it from the first assigned technician's department
  -- Admin users can override any job, management users can only override jobs in their department
  select p.department
  into v_job_department
  from job_assignments ja
  join profiles p on p.id = ja.technician_id
  where ja.job_id = _job_id
  limit 1;

  -- Check permissions
  -- Admin can override any job
  if v_user_role = 'admin' then
    v_has_permission := true;
  -- Management can only override jobs in their department
  elsif v_user_role = 'management' then
    if v_user_department is not null and v_job_department is not null and v_user_department = v_job_department then
      v_has_permission := true;
    elsif v_job_department is null then
      -- If job has no department assigned yet, allow management to override
      v_has_permission := true;
    end if;
  end if;

  if not v_has_permission then
    raise exception 'Permission denied: Only admin users and department managers can set job payout overrides';
  end if;

  -- Validate amount if enabled
  if _enabled and (_amount_eur is null or _amount_eur < 0) then
    raise exception 'Override amount must be a positive number when override is enabled';
  end if;

  -- Get current values and job info for email notification
  select
    payout_override_enabled,
    payout_override_amount_eur,
    title,
    start_time
  into
    v_old_enabled,
    v_old_amount,
    v_job_title,
    v_job_start_time
  from jobs
  where id = _job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  -- Update the job
  update jobs
  set
    payout_override_enabled = _enabled,
    payout_override_amount_eur = case when _enabled then _amount_eur else null end,
    payout_override_set_by = v_user_id,
    payout_override_set_at = now()
  where id = _job_id;

  -- Get the new values
  v_new_enabled := _enabled;
  v_new_amount := case when _enabled then _amount_eur else null end;

  -- Return result with old and new values for email notification
  v_result := json_build_object(
    'success', true,
    'job_id', _job_id,
    'job_title', v_job_title,
    'job_start_time', v_job_start_time,
    'actor_id', v_user_id,
    'old_override_enabled', v_old_enabled,
    'old_override_amount_eur', v_old_amount,
    'new_override_enabled', v_new_enabled,
    'new_override_amount_eur', v_new_amount,
    'timestamp', now()
  );

  return v_result;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function set_job_payout_override to authenticated;

comment on function set_job_payout_override is 'Set or update job payout override with permission checks. Returns JSON with old/new values for email notification.';
