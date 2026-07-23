-- Validation uses a lighter lock than adding an immediately-valid FK and does
-- not block normal inserts, updates, or deletes on logistics_events.
alter table public.logistics_events
  validate constraint logistics_events_transport_request_scope_fkey;
