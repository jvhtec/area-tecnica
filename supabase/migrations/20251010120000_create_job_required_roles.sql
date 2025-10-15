-- Crew staffing requirements per job/department/role
create table if not exists public.job_required_roles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null,
  role_code text not null,
  quantity integer not null default 0 check (quantity >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null
);

create unique index if not exists uq_job_required_roles_job_dept_role
  on public.job_required_roles(job_id, department, role_code);

create index if not exists idx_job_required_roles_job
  on public.job_required_roles(job_id);

comment on table public.job_required_roles is 'Required staffing slots for each job segmented by department and role code.';
comment on column public.job_required_roles.department is 'Department identifier (sound, lights, video, etc.).';
comment on column public.job_required_roles.role_code is 'Role code from the role registry expected for this job.';
comment on column public.job_required_roles.quantity is 'Number of technicians required for this role.';

alter table public.job_required_roles enable row level security;

drop policy if exists job_required_roles_manage on public.job_required_roles;
-- Allow admins/management to manage requirements
create policy job_required_roles_manage on public.job_required_roles
  for all to authenticated
  using (public.get_current_user_role() = any (array['admin'::text,'management'::text]))
  with check (public.get_current_user_role() = any (array['admin'::text,'management'::text]));

drop policy if exists job_required_roles_select on public.job_required_roles;
-- Authenticated users can read requirements for jobs they can access via assignments or elevated roles
create policy job_required_roles_select on public.job_required_roles
  for select to authenticated
  using (
    public.get_current_user_role() = any (array['admin'::text,'management'::text,'coordinator'::text,'logistics'::text])
    or exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_required_roles.job_id
        and ja.technician_id = auth.uid()
    )
  );

-- Maintain updated_at automatically
create or replace function public.trg_job_required_roles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_job_required_roles_set_updated_at on public.job_required_roles;
create trigger trg_job_required_roles_set_updated_at
  before update on public.job_required_roles
  for each row
  execute function public.trg_job_required_roles_set_updated_at();

-- Aggregated view for quick lookups per job/department
create or replace view public.job_required_roles_summary as
select
  job_id,
  department,
  sum(quantity) as total_required,
  jsonb_agg(
    jsonb_build_object(
      'role_code', role_code,
      'quantity', quantity,
      'notes', notes
    )
    order by role_code
  ) as roles
from public.job_required_roles
group by job_id, department;

grant select on public.job_required_roles to authenticated, service_role;
grant insert, update, delete on public.job_required_roles to authenticated;
grant all on public.job_required_roles to service_role;

grant select on public.job_required_roles_summary to authenticated, service_role;
