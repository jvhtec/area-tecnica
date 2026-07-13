-- Kept as a standalone migration because PostgreSQL does not allow
-- CREATE INDEX CONCURRENTLY inside a transaction block.
create unique index concurrently transport_requests_id_job_key_idx
  on public.transport_requests (id, job_id);
