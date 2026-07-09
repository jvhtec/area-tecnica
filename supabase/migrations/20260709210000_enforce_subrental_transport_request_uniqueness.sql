-- Persist the sub-rental relationship instead of treating a note marker as the
-- source of truth. The composite foreign key prevents direct table callers
-- from linking a request to a sub-rental from another job or department.

alter table public.sub_rentals
  add constraint sub_rentals_id_job_department_key
  unique (id, job_id, department);

alter table public.transport_requests
  add column subrental_id uuid;

alter table public.transport_requests
  add constraint transport_requests_subrental_scope_fkey
  foreign key (subrental_id, job_id, department)
  references public.sub_rentals (id, job_id, department)
  on delete set null (subrental_id);

-- Cancelled requests are historical. Exactly one active request may represent
-- a sub-rental, even when concurrent Edge Function invocations race.
create unique index uq_transport_requests_active_subrental
  on public.transport_requests (subrental_id)
  where subrental_id is not null
    and status <> 'cancelled';
