-- Attach the prebuilt unique index with only a short metadata lock, then add
-- the job-scoped FK without scanning logistics_events while writes are held.
alter table public.transport_requests
  add constraint transport_requests_id_job_key
  unique using index transport_requests_id_job_key_idx;

alter table public.logistics_events
  add constraint logistics_events_transport_request_scope_fkey
  foreign key (transport_request_id, job_id)
  references public.transport_requests (id, job_id)
  on delete set null (transport_request_id)
  not valid;
