-- Departments can file several concurrent transport requests per job, so
-- fulfillment can no longer be inferred from department-wide load/unload
-- pairs: each logistics event now records which request it fulfils. Requests
-- also carry the requester's hoja de ruta intent so job-related transports
-- (e.g. subrental returns) can stay off the route sheet from the start.

alter table public.transport_requests
  add column is_hoja_relevant boolean not null default true;

comment on column public.transport_requests.is_hoja_relevant is
  'Requester intent: when false, logistics events created from this request default to being excluded from the hoja de ruta.';

alter table public.logistics_events
  add column transport_request_id uuid;

comment on column public.logistics_events.transport_request_id is
  'Transport request this event fulfils. Both a load and an unload event linked to a request mark it fulfilled.';
