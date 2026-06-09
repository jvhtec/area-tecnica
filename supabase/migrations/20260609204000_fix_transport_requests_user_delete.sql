-- User deletion follow-up:
-- transport_requests.created_by already has ON DELETE SET NULL, but the column
-- was still NOT NULL. Postgres cannot apply SET NULL unless the referencing
-- column accepts NULL, so users who created transport requests could not be
-- deleted.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transport_requests'
      AND column_name = 'created_by'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.transport_requests
      ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;
