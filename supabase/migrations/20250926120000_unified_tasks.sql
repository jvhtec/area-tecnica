-- Phase 1: Unified tasks schema (backward-compatible foundation)
-- NOTE: Review and adjust enums and RLS according to your environment

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('sound','lights','video')),
  code text not null,
  label text not null,
  order_index int2 not null default 0,
  required boolean not null default false,
  unique (department, code)
);

create table if not exists public.job_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null check (department in ('sound','lights','video')),
  task_type uuid references public.task_types(id),
  title text,
  assigned_to uuid references public.profiles(id),
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  due_at timestamptz,
  priority int2,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_task_documents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.job_tasks(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.job_department_personnel (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null check (department in ('sound','lights','video')),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (job_id, department)
);

-- Simple updated_at trigger for job_tasks
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists job_tasks_set_updated_at on public.job_tasks;
create trigger job_tasks_set_updated_at
before update on public.job_tasks
for each row execute function public.set_updated_at();

-- Compatibility views (Phase 2): map to unified table by department
create or replace view public.sound_job_tasks_v as
  select * from public.job_tasks where department = 'sound';
create or replace view public.lights_job_tasks_v as
  select * from public.job_tasks where department = 'lights';
create or replace view public.video_job_tasks_v as
  select * from public.job_tasks where department = 'video';

-- RLS placeholders (adjust for your roles)
alter table public.job_tasks enable row level security;
alter table public.job_task_documents enable row level security;
alter table public.job_department_personnel enable row level security;

-- Example policies (tighten as needed)
do $$ begin
  -- Read: all authenticated
  perform 1;
  exception when others then null;
end $$;

