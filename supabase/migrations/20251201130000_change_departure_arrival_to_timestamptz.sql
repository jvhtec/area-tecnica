-- Migration: Change departure_time and arrival_time from time to timestamptz
-- This completes the migration to full datetime for all travel time fields
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

-- Update hoja_de_ruta_travel_arrangements table
DO $$
DECLARE
  dep_col_type TEXT;
  arr_col_type TEXT;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'hoja_de_ruta_travel_arrangements'
  ) THEN
    -- Check current column types
    SELECT data_type INTO dep_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hoja_de_ruta_travel_arrangements'
      AND column_name = 'departure_time';

    SELECT data_type INTO arr_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hoja_de_ruta_travel_arrangements'
      AND column_name = 'arrival_time';

    -- Convert departure_time if still 'time without time zone'
    IF dep_col_type = 'time without time zone' THEN
      ALTER TABLE hoja_de_ruta_travel_arrangements
      ALTER COLUMN departure_time TYPE timestamptz
      USING CASE
        WHEN departure_time IS NOT NULL THEN (CURRENT_DATE + departure_time)::timestamptz
        ELSE NULL
      END;

      RAISE NOTICE 'Successfully changed departure_time to timestamptz in hoja_de_ruta_travel_arrangements';
    ELSE
      RAISE NOTICE 'departure_time is already timestamptz or has different type (%), skipping', dep_col_type;
    END IF;

    -- Convert arrival_time if still 'time without time zone'
    IF arr_col_type = 'time without time zone' THEN
      ALTER TABLE hoja_de_ruta_travel_arrangements
      ALTER COLUMN arrival_time TYPE timestamptz
      USING CASE
        WHEN arrival_time IS NOT NULL THEN (CURRENT_DATE + arrival_time)::timestamptz
        ELSE NULL
      END;

      RAISE NOTICE 'Successfully changed arrival_time to timestamptz in hoja_de_ruta_travel_arrangements';
    ELSE
      RAISE NOTICE 'arrival_time is already timestamptz or has different type (%), skipping', arr_col_type;
    END IF;
  ELSE
    RAISE NOTICE 'Table hoja_de_ruta_travel_arrangements does not exist, skipping migration';
  END IF;
END $$;

-- Also check for the older table name hoja_de_ruta_travel if it exists
DO $$
DECLARE
  dep_col_type TEXT;
  arr_col_type TEXT;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'hoja_de_ruta_travel'
  ) THEN
    -- Check current column types
    SELECT data_type INTO dep_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hoja_de_ruta_travel'
      AND column_name = 'departure_time';

    SELECT data_type INTO arr_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hoja_de_ruta_travel'
      AND column_name = 'arrival_time';

    -- Convert departure_time if still 'time without time zone'
    IF dep_col_type = 'time without time zone' THEN
      ALTER TABLE hoja_de_ruta_travel
      ALTER COLUMN departure_time TYPE timestamptz
      USING CASE
        WHEN departure_time IS NOT NULL THEN (CURRENT_DATE + departure_time)::timestamptz
        ELSE NULL
      END;

      RAISE NOTICE 'Successfully changed departure_time to timestamptz in hoja_de_ruta_travel';
    ELSE
      RAISE NOTICE 'departure_time is already timestamptz or has different type (%), skipping', dep_col_type;
    END IF;

    -- Convert arrival_time if still 'time without time zone'
    IF arr_col_type = 'time without time zone' THEN
      ALTER TABLE hoja_de_ruta_travel
      ALTER COLUMN arrival_time TYPE timestamptz
      USING CASE
        WHEN arrival_time IS NOT NULL THEN (CURRENT_DATE + arrival_time)::timestamptz
        ELSE NULL
      END;

      RAISE NOTICE 'Successfully changed arrival_time to timestamptz in hoja_de_ruta_travel';
    ELSE
      RAISE NOTICE 'arrival_time is already timestamptz or has different type (%), skipping', arr_col_type;
    END IF;
  ELSE
    RAISE NOTICE 'Table hoja_de_ruta_travel does not exist, skipping';
  END IF;
END $$;
