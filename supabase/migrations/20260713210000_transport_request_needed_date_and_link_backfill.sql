-- Requests can state when the transport is needed, so logistics no longer has
-- to infer the date from the job or chase the requester.

alter table public.transport_requests
  add column needed_date date;

comment on column public.transport_requests.needed_date is
  'Date the requester needs the transport on. Pre-fills the logistics event date when the request is scheduled.';

-- Backfill the request link for events created before
-- logistics_events.transport_request_id existed, so in-flight requests can
-- still auto-fulfil once their counterpart event is created. Only unambiguous
-- cases are linked: single-department events whose job+department has exactly
-- one active request (the pre-link UI enforced one request per department, so
-- this covers every legacy in-flight request).
update public.logistics_events le
set transport_request_id = tr.id
from public.transport_requests tr
where le.transport_request_id is null
  and tr.status = 'requested'
  and le.job_id = tr.job_id
  and exists (
    select 1
    from public.logistics_event_departments led
    where led.event_id = le.id
      and led.department = tr.department
  )
  and (
    select count(*)
    from public.logistics_event_departments led2
    where led2.event_id = le.id
  ) = 1
  and not exists (
    select 1
    from public.transport_requests tr2
    where tr2.job_id = tr.job_id
      and tr2.department = tr.department
      and tr2.status = 'requested'
      and tr2.id <> tr.id
  );
