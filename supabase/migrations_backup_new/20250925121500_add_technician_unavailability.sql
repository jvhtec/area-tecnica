-- Technician Unavailability: core table, RLS, view, activity, realtime

-- 1) Table
create table if not exists public.technician_unavailability (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default true,
  reason text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_unavail_tech_time
  on public.technician_unavailability(technician_id, starts_at, ends_at);

-- updated_at trigger
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_technician_unavailability_updated_at') then
    create trigger trg_technician_unavailability_updated_at
    before update on public.technician_unavailability
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- 2) RLS
alter table public.technician_unavailability enable row level security;

-- Managers (admin/management) can read all
drop policy if exists unavail_mgr_read on public.technician_unavailability;
create policy unavail_mgr_read on public.technician_unavailability
for select using (
  exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() 
      and p.role in ('admin','management')
  )
);

-- Managers can write (optional; aligns with PRD configurable behavior)
drop policy if exists unavail_mgr_write on public.technician_unavailability;
create policy unavail_mgr_write on public.technician_unavailability
for all using (
  exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() 
      and p.role in ('admin','management')
  )
)
with check (true);

-- Technicians can CRUD own rows
drop policy if exists unavail_tech_crud on public.technician_unavailability;
create policy unavail_tech_crud on public.technician_unavailability
for all using (technician_id = auth.uid())
with check (technician_id = auth.uid());

-- 3) Overlap view for Assignment Matrix (per job, tech)
create or replace view public.assignment_matrix_unavailability_overlap as
select
  ja.job_id,
  ja.technician_id,
  exists (
    select 1
    from public.technician_unavailability u
    join public.jobs j on j.id = ja.job_id
    where u.technician_id = ja.technician_id
      and tstzrange(u.starts_at, u.ends_at, '[)') &&
          tstzrange(j.start_time, coalesce(j.end_time, j.start_time + interval '1 hour'), '[)')
  ) as is_unavailable,
  (
    select jsonb_agg(jsonb_build_object(
      'starts_at', u2.starts_at,
      'ends_at',   u2.ends_at,
      'reason',    u2.reason,
      'all_day',   u2.all_day
    ) order by u2.starts_at)
    from public.technician_unavailability u2
    join public.jobs j2 on j2.id = ja.job_id
    where u2.technician_id = ja.technician_id
      and tstzrange(u2.starts_at, u2.ends_at, '[)') &&
          tstzrange(j2.start_time, coalesce(j2.end_time, j2.start_time + interval '1 hour'), '[)')
  ) as overlaps_detail
from public.job_assignments ja;

-- 4) Activity events and catalog entries
-- Catalog entries (idempotent)
insert into public.activity_catalog(code, label, default_visibility, severity, toast_enabled, template) values
  ('availability.unavailable.created','Marked unavailable','management','info', true, '{actor_name} marked unavailable'),
  ('availability.unavailable.updated','Updated unavailable','management','info', false, '{actor_name} updated unavailability'),
  ('availability.unavailable.deleted','Removed unavailable','management','warn', true, '{actor_name} removed unavailability')
on conflict (code) do nothing;

-- Trigger functions
create or replace function public.trg_log_unavailability_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.log_activity(
    'availability.unavailable.created',
    null,
    'unavailability',
    new.id::text,
    jsonb_build_object(
      'technician_id', new.technician_id,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at,
      'all_day', new.all_day,
      'reason', coalesce(new.reason, '')
    )
  );
  return new;
end;$$;

create or replace function public.trg_log_unavailability_update()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.log_activity(
    'availability.unavailable.updated',
    null,
    'unavailability',
    new.id::text,
    jsonb_build_object(
      'technician_id', new.technician_id,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at,
      'all_day', new.all_day,
      'reason', coalesce(new.reason, '')
    )
  );
  return new;
end;$$;

create or replace function public.trg_log_unavailability_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.log_activity(
    'availability.unavailable.deleted',
    null,
    'unavailability',
    old.id::text,
    jsonb_build_object(
      'technician_id', old.technician_id,
      'starts_at', old.starts_at,
      'ends_at', old.ends_at,
      'all_day', old.all_day,
      'reason', coalesce(old.reason, '')
    )
  );
  return old;
end;$$;

-- Attach triggers (idempotent)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 't_ai_technician_unavailability_activity') then
    create trigger t_ai_technician_unavailability_activity
    after insert on public.technician_unavailability
    for each row execute function public.trg_log_unavailability_insert();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 't_au_technician_unavailability_activity') then
    create trigger t_au_technician_unavailability_activity
    after update on public.technician_unavailability
    for each row execute function public.trg_log_unavailability_update();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 't_ad_technician_unavailability_activity') then
    create trigger t_ad_technician_unavailability_activity
    after delete on public.technician_unavailability
    for each row execute function public.trg_log_unavailability_delete();
  end if;
end $$;

-- 5) Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table if not exists public.technician_unavailability';
  end if;
end $$;

