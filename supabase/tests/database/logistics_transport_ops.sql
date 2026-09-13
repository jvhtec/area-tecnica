CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(14);

SELECT has_column('public', 'transport_requests', 'planning_status', 'transport requests expose an operational planning lifecycle');
SELECT has_column('public', 'transport_requests', 'needed_at', 'transport requests store when transport is needed');
SELECT has_column('public', 'transport_requests', 'origin', 'transport requests store origin');
SELECT has_column('public', 'transport_requests', 'destination', 'transport requests store destination');
SELECT has_column('public', 'transport_requests', 'source_type', 'transport requests record their generating source');
SELECT has_column('public', 'logistics_events', 'transport_request_id', 'logistics events link to the request they execute');

SELECT has_function(
  'public',
  'save_transport_request',
  ARRAY['uuid', 'uuid', 'text', 'text', 'text', 'timestamp with time zone', 'text', 'text', 'text', 'text', 'boolean', 'text', 'text', 'jsonb'],
  'request plus vehicle items are saved atomically'
);
SELECT has_function(
  'public',
  'schedule_transport_request',
  ARRAY['uuid', 'date', 'time without time zone', 'date', 'time without time zone', 'text', 'text', 'text', 'text'],
  'logistics can atomically plan linked load and unload events'
);
SELECT has_function(
  'public',
  'set_transport_request_stage',
  ARRAY['uuid', 'text'],
  'transport request lifecycle transitions are server-owned'
);
SELECT has_function(
  'public',
  'list_transport_requests',
  ARRAY['uuid', 'text', 'boolean'],
  'the logistics inbox is served through an authorized read model'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'logistics_events'
      AND indexname = 'uq_logistics_events_transport_request_event_type'
      AND indexdef ILIKE '%UNIQUE INDEX%'
  ),
  'a request has at most one linked load and unload event'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'transport_requests'
      AND indexname = 'uq_transport_requests_active_source'
      AND indexdef ILIKE '%UNIQUE INDEX%'
  ),
  'generated request sources are idempotent'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'guard_transport_request_lifecycle'
      AND NOT tgisinternal
  ),
  'legacy clients cannot falsely fulfil requests from unrelated events'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'guard_logistics_event_transport_request_link'
      AND NOT tgisinternal
  ),
  'request/event links stay job-scoped'
);

SELECT * FROM finish();
