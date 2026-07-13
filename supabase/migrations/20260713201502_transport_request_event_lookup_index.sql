-- Kept as a standalone migration because PostgreSQL does not allow
-- CREATE INDEX CONCURRENTLY inside a transaction block.
create index concurrently idx_logistics_events_transport_request_id
  on public.logistics_events (transport_request_id)
  where transport_request_id is not null;
