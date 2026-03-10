-- Remove job-level override fields (they were added in the previous migration)
alter table jobs
  drop column if exists payout_override_enabled,
  drop column if exists payout_override_amount_eur,
  drop column if exists payout_override_set_by,
  drop column if exists payout_override_set_at;

-- Create table for per-technician payout overrides
create table if not exists job_technician_payout_overrides (
  job_id uuid not null references jobs(id) on delete cascade,
  technician_id uuid not null references profiles(id) on delete cascade,
  override_amount_eur numeric(10,2) not null check (override_amount_eur >= 0 and override_amount_eur <= 99999999.99),
  set_by uuid not null references profiles(id),
  set_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_id, technician_id)
);

-- Add indexes for performance
create index if not exists idx_job_tech_payout_overrides_job_id on job_technician_payout_overrides(job_id);
create index if not exists idx_job_tech_payout_overrides_tech_id on job_technician_payout_overrides(technician_id);
create index if not exists idx_job_tech_payout_overrides_set_by on job_technician_payout_overrides(set_by);

-- Enable RLS
alter table job_technician_payout_overrides enable row level security;

-- Drop existing policies if they exist (for idempotent migrations)
drop policy if exists "Users can view payout overrides for jobs they can see" on job_technician_payout_overrides;
drop policy if exists "Only admins and department managers can insert overrides" on job_technician_payout_overrides;
drop policy if exists "Only admins and department managers can update overrides" on job_technician_payout_overrides;
drop policy if exists "Only admins and department managers can delete overrides" on job_technician_payout_overrides;

-- RLS policies
create policy "Users can view payout overrides for jobs they can see"
  on job_technician_payout_overrides for select
  using (
    -- Technicians can view their own overrides on jobs they're assigned to
    exists (
      select 1 from job_assignments ja
      where ja.job_id = job_technician_payout_overrides.job_id
        and ja.technician_id = auth.uid()
    )
    or
    -- Admin users have unconditional access
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
    or
    -- Management users can only view overrides for their department's technicians on assigned jobs
    (
      exists (
        select 1 from profiles p
        where p.id = auth.uid()
          and p.role = 'management'
          and p.department = (
            select department from profiles
            where id = job_technician_payout_overrides.technician_id
          )
      )
      and exists (
        select 1 from job_assignments ja
        where ja.job_id = job_technician_payout_overrides.job_id
          and ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

create policy "Only admins and department managers can insert overrides"
  on job_technician_payout_overrides for insert
  with check (
    -- Admin users have unconditional access
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
    or
    -- Management users can only insert for their department's technicians on assigned jobs
    (
      exists (
        select 1 from profiles p
        where p.id = auth.uid()
          and p.role = 'management'
          and p.department = (
            select department from profiles
            where id = job_technician_payout_overrides.technician_id
          )
      )
      and exists (
        select 1 from job_assignments ja
        where ja.job_id = job_technician_payout_overrides.job_id
          and ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

create policy "Only admins and department managers can update overrides"
  on job_technician_payout_overrides for update
  using (
    -- Admin users have unconditional access
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
    or
    -- Management users can only update for their department's technicians on assigned jobs
    (
      exists (
        select 1 from profiles p
        where p.id = auth.uid()
          and p.role = 'management'
          and p.department = (
            select department from profiles
            where id = job_technician_payout_overrides.technician_id
          )
      )
      and exists (
        select 1 from job_assignments ja
        where ja.job_id = job_technician_payout_overrides.job_id
          and ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  )
  with check (
    -- Admin users have unconditional access
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
    or
    -- Management users can only update for their department's technicians on assigned jobs
    (
      exists (
        select 1 from profiles p
        where p.id = auth.uid()
          and p.role = 'management'
          and p.department = (
            select department from profiles
            where id = job_technician_payout_overrides.technician_id
          )
      )
      and exists (
        select 1 from job_assignments ja
        where ja.job_id = job_technician_payout_overrides.job_id
          and ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

create policy "Only admins and department managers can delete overrides"
  on job_technician_payout_overrides for delete
  using (
    -- Admin users have unconditional access
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role = 'admin'
    )
    or
    -- Management users can only delete for their department's technicians on assigned jobs
    (
      exists (
        select 1 from profiles p
        where p.id = auth.uid()
          and p.role = 'management'
          and p.department = (
            select department from profiles
            where id = job_technician_payout_overrides.technician_id
          )
      )
      and exists (
        select 1 from job_assignments ja
        where ja.job_id = job_technician_payout_overrides.job_id
          and ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

-- Drop old function
drop function if exists set_job_payout_override(text, boolean, numeric);

-- Create new RPC function to set per-technician payout override
create or replace function set_technician_payout_override(
  _job_id uuid,
  _technician_id uuid,
  _amount_eur numeric
) returns json
language plpgsql
security definer
as $$
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

  -- Check permissions
  -- Admin can override any technician
  if v_user_role = 'admin' then
    v_has_permission := true;
  -- Management can only override technicians from their department
  elsif v_user_role = 'management' then
    if v_user_department is not null and v_user_department = v_tech_department then
      -- Also verify the technician is assigned to this job
      if exists (
        select 1
        from job_assignments ja
        where ja.job_id = _job_id
          and ja.technician_id = _technician_id
      ) then
        v_has_permission := true;
      else
        raise exception 'Technician is not assigned to this job';
      end if;
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
  select title, start_time
  into v_job_title, v_job_start_time
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

-- Create function to remove override
create or replace function remove_technician_payout_override(
  _job_id uuid,
  _technician_id uuid
) returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_department text;
  v_tech_department text;
  v_has_permission boolean := false;
  v_old_amount numeric;
  v_job_title text;
  v_job_start_time timestamptz;
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

  -- Check permissions
  -- Admin can remove any override
  if v_user_role = 'admin' then
    v_has_permission := true;
  -- Management can only remove overrides for technicians from their department
  elsif v_user_role = 'management' then
    if v_user_department is not null and v_user_department = v_tech_department then
      -- Also verify the technician is assigned to this job
      if exists (
        select 1
        from job_assignments ja
        where ja.job_id = _job_id
          and ja.technician_id = _technician_id
      ) then
        v_has_permission := true;
      else
        raise exception 'Technician is not assigned to this job';
      end if;
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
  select title, start_time
  into v_job_title, v_job_start_time
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

-- Grant execute permissions
grant execute on function set_technician_payout_override to authenticated;
grant execute on function remove_technician_payout_override to authenticated;

-- Add comments
comment on table job_technician_payout_overrides is 'Stores per-technician payout overrides. Department managers can override payouts for technicians in their department.';
comment on function set_technician_payout_override is 'Set or update payout override for a specific technician on a job. Admin users can override any technician. Department managers can only override technicians from their department.';
comment on function remove_technician_payout_override is 'Remove payout override for a specific technician on a job.';
