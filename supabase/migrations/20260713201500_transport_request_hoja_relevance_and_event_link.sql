-- Departments can file several concurrent transport requests per job, so
-- fulfillment can no longer be inferred from department-wide load/unload
-- pairs: each logistics event now records which request it fulfils. Requests
-- also carry the requester's hoja de ruta intent so job-related transports
-- (e.g. subrental returns) can stay off the route sheet from the start.

alter table public.transport_requests
  add column is_hoja_relevant boolean not null default true;

comment on column public.transport_requests.is_hoja_relevant is
  'Requester intent: when false, logistics events created from this request default to being excluded from the hoja de ruta.';

-- Scope the event link so a logistics event can only reference a request from
-- its own job (mirrors transport_requests_subrental_scope_fkey).
alter table public.transport_requests
  add constraint transport_requests_id_job_key
  unique (id, job_id);

alter table public.logistics_events
  add column transport_request_id uuid;

comment on column public.logistics_events.transport_request_id is
  'Transport request this event fulfils. Both a load and an unload event linked to a request mark it fulfilled.';

alter table public.logistics_events
  add constraint logistics_events_transport_request_scope_fkey
  foreign key (transport_request_id, job_id)
  references public.transport_requests (id, job_id)
  on delete set null (transport_request_id);

create index idx_logistics_events_transport_request_id
  on public.logistics_events (transport_request_id)
  where transport_request_id is not null;
