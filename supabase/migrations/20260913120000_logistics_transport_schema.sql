-- Logistics transport operations — schema and backfill.
--
-- Adds the operational demand metadata, links execution events to the request they fulfil,
-- and backfills the unambiguous legacy relationships. Consolidated from the incremental
-- migrations this feature was developed across; the department CHECK is written once at its
-- final value (every active department) rather than added narrow and widened later.

alter table public.transport_requests
  add column if not exists needed_at timestamptz,
  add column if not exists origin text,
  add column if not exists destination text,
  add column if not exists movement_type text not null default 'transfer',
  add column if not exists priority text not null default 'normal',
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_ref text,
  add column if not exists is_hoja_relevant boolean not null default true,
  add column if not exists planning_status text not null default 'requested';

alter table public.transport_requests
  drop constraint if exists transport_requests_movement_type_check,
  add constraint transport_requests_movement_type_check
    check (movement_type in ('transfer', 'pickup', 'delivery', 'return', 'other')),
  drop constraint if exists transport_requests_priority_check,
  add constraint transport_requests_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  drop constraint if exists transport_requests_source_type_check,
  add constraint transport_requests_source_type_check
    check (source_type in ('manual', 'subrental', 'tour', 'truck_planner')),
  drop constraint if exists transport_requests_planning_status_check,
  add constraint transport_requests_planning_status_check
    check (planning_status in ('requested', 'reviewing', 'planned', 'confirmed', 'completed', 'cancelled')),
  -- Mirrors ACTIVE_DEPARTMENTS in src/types/department.ts.
  drop constraint if exists transport_requests_department_check,
  add constraint transport_requests_department_check
    check (department = any (
      array['sound', 'lights', 'video', 'production', 'administrative', 'logistics']
    ));

-- Normalize terminal legacy rows before the active-source index is evaluated.
update public.transport_requests
set planning_status = case
  when status = 'cancelled' then 'cancelled'
  when status = 'fulfilled' then 'completed'
  else planning_status
end
where (status = 'cancelled' and planning_status <> 'cancelled')
   or (status = 'fulfilled' and planning_status <> 'completed');

-- Sub-rental demand carries a stable source identity.
update public.transport_requests
set source_type = 'subrental',
    source_ref = subrental_id::text
where subrental_id is not null
  and (source_type <> 'subrental' or source_ref is distinct from subrental_id::text);

create index if not exists idx_transport_requests_ops_queue
  on public.transport_requests(planning_status, needed_at, created_at)
  where planning_status not in ('completed', 'cancelled');

create unique index if not exists uq_transport_requests_active_source
  on public.transport_requests(job_id, department, source_type, source_ref)
  where source_ref is not null and planning_status not in ('completed', 'cancelled');

alter table public.logistics_events
  add column if not exists transport_request_id uuid;

alter table public.logistics_events
  drop constraint if exists logistics_events_transport_request_id_fkey,
  add constraint logistics_events_transport_request_id_fkey
    foreign key (transport_request_id)
    references public.transport_requests(id)
    on delete set null;

create index if not exists idx_logistics_events_transport_request_id
  on public.logistics_events(transport_request_id)
  where transport_request_id is not null;

-- A request may need several trucks, therefore several load/unload events may legitimately
-- execute the same request. Do not enforce one event type per request.
drop index if exists public.uq_logistics_events_transport_request_event_type;

-- Backfill pre-existing request/event pairs only where the old one-request-per-department
-- model makes the relationship unambiguous. Multiple events remain linked because a single
-- request may legitimately represent several vehicles.
with active_request as (
  select
    tr.job_id,
    tr.department,
    (array_agg(tr.id order by tr.created_at, tr.id::text))[1] as request_id
  from public.transport_requests tr
  where tr.status = 'requested'
  group by tr.job_id, tr.department
  having count(*) = 1
),
single_department_event as (
  select led.event_id, (array_agg(led.department))[1] as department
  from public.logistics_event_departments led
  group by led.event_id
  having count(*) = 1
),
candidates as (
  select le.id as event_id, ar.request_id
  from public.logistics_events le
  join single_department_event sde on sde.event_id = le.id
  join active_request ar on ar.job_id = le.job_id and ar.department = sde.department
  where le.transport_request_id is null
    and le.event_type in ('load', 'unload')
)
update public.logistics_events le
set transport_request_id = candidates.request_id
from candidates
where le.id = candidates.event_id;
