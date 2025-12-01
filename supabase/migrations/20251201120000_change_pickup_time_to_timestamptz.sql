-- Migration: Change pickup_time from time to timestamptz
-- This allows storing full date and time for pickup, not just time of day
--
-- IMPORTANT: This migration preserves existing time-of-day values by attaching
-- CURRENT_DATE during conversion. The resulting timestamp will be in the database
-- server's timezone (should be Europe/Madrid for this application).
--
-- TIMEZONE DEPENDENCY: This migration assumes the PostgreSQL server/session is
-- configured with timezone = 'Europe/Madrid'. Verify with:
--   SHOW timezone;
-- If needed, set explicitly before running:
--   SET timezone = 'Europe/Madrid';

-- Check if hoja_de_ruta_travel_arrangements table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'hoja_de_ruta_travel_arrangements'
  ) THEN
    -- Change pickup_time column from time to timestamptz
    -- Preserves existing time-of-day values by attaching CURRENT_DATE
    ALTER TABLE hoja_de_ruta_travel_arrangements
    ALTER COLUMN pickup_time TYPE timestamptz
    USING CASE
      WHEN pickup_time IS NOT NULL THEN (CURRENT_DATE + pickup_time)::timestamptz
      ELSE NULL
    END;

    RAISE NOTICE 'Successfully changed pickup_time to timestamptz in hoja_de_ruta_travel_arrangements';
  ELSE
    RAISE NOTICE 'Table hoja_de_ruta_travel_arrangements does not exist, skipping migration';
  END IF;
END $$;

-- Also check for the older table name hoja_de_ruta_travel if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'hoja_de_ruta_travel'
  ) THEN
    -- Change pickup_time column from time to timestamptz
    -- Preserves existing time-of-day values by attaching CURRENT_DATE
    ALTER TABLE hoja_de_ruta_travel
    ALTER COLUMN pickup_time TYPE timestamptz
    USING CASE
      WHEN pickup_time IS NOT NULL THEN (CURRENT_DATE + pickup_time)::timestamptz
      ELSE NULL
    END;

    RAISE NOTICE 'Successfully changed pickup_time to timestamptz in hoja_de_ruta_travel';
  ELSE
    RAISE NOTICE 'Table hoja_de_ruta_travel does not exist, skipping';
  END IF;
END $$;
