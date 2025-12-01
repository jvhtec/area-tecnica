-- Migration: Change departure_time and arrival_time from time to timestamptz
-- This completes the migration to full datetime for all travel time fields

-- Update hoja_de_ruta_travel_arrangements table
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'hoja_de_ruta_travel_arrangements'
  ) THEN
    -- Change departure_time column from time to timestamptz
    ALTER TABLE hoja_de_ruta_travel_arrangements
    ALTER COLUMN departure_time TYPE timestamptz
    USING CASE
      WHEN departure_time IS NOT NULL THEN (CURRENT_DATE + departure_time)::timestamptz
      ELSE NULL
    END;

    -- Change arrival_time column from time to timestamptz
    ALTER TABLE hoja_de_ruta_travel_arrangements
    ALTER COLUMN arrival_time TYPE timestamptz
    USING CASE
      WHEN arrival_time IS NOT NULL THEN (CURRENT_DATE + arrival_time)::timestamptz
      ELSE NULL
    END;

    RAISE NOTICE 'Successfully changed departure_time and arrival_time to timestamptz in hoja_de_ruta_travel_arrangements';
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
    -- Change departure_time column from time to timestamptz
    ALTER TABLE hoja_de_ruta_travel
    ALTER COLUMN departure_time TYPE timestamptz
    USING CASE
      WHEN departure_time IS NOT NULL THEN (CURRENT_DATE + departure_time)::timestamptz
      ELSE NULL
    END;

    -- Change arrival_time column from time to timestamptz
    ALTER TABLE hoja_de_ruta_travel
    ALTER COLUMN arrival_time TYPE timestamptz
    USING CASE
      WHEN arrival_time IS NOT NULL THEN (CURRENT_DATE + arrival_time)::timestamptz
      ELSE NULL
    END;

    RAISE NOTICE 'Successfully changed departure_time and arrival_time to timestamptz in hoja_de_ruta_travel';
  ELSE
    RAISE NOTICE 'Table hoja_de_ruta_travel does not exist, skipping';
  END IF;
END $$;
