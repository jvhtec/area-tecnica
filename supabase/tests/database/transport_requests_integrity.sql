CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(3);

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

SELECT * FROM finish();
