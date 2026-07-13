CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(6);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'transport_requests'
      AND constraint_name = 'transport_requests_subrental_scope_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ),
  'transport requests can only reference a sub-rental from the same job and department'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sub_rentals'
      AND constraint_name = 'sub_rentals_id_job_department_key'
      AND constraint_type = 'UNIQUE'
  ),
  'sub-rental job and department scope is a valid foreign-key target'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'transport_requests'
      AND indexname = 'uq_transport_requests_active_subrental'
      AND indexdef ILIKE '%UNIQUE INDEX%'
      AND indexdef ILIKE '%(subrental_id)%'
      AND indexdef ILIKE '%subrental_id IS NOT NULL%'
      AND indexdef ILIKE '%status <> ''cancelled''%'
  ),
  'only one active transport request can represent a sub-rental'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transport_requests'
      AND column_name = 'is_hoja_relevant'
      AND is_nullable = 'NO'
      AND column_default = 'true'
  ),
  'transport requests carry a non-null hoja de ruta relevance flag defaulting to true'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'logistics_events'
      AND constraint_name = 'logistics_events_transport_request_scope_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ),
  'logistics events can only reference a transport request from the same job'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'logistics_events'
      AND indexname = 'idx_logistics_events_transport_request_id'
      AND indexdef ILIKE '%(transport_request_id)%'
  ),
  'transport request fulfillment lookups on logistics events are indexed'
);

SELECT * FROM finish();
