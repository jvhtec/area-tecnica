-- Create transport provider enum (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_provider_enum') THEN
    CREATE TYPE transport_provider_enum AS ENUM (
      'camionaje',
      'transluminaria',
      'the_wild_tour',
      'pantoja',
      'crespo',
      'montabi_dorado',
      'grupo_sese',
      'nacex',
      'sector_pro',
      'recogida_cliente'
    );
  END IF;
END $$;

-- Add column to logistics_events table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logistics_events'
    AND column_name = 'transport_provider'
  ) THEN
    ALTER TABLE logistics_events
    ADD COLUMN transport_provider transport_provider_enum;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN logistics_events.transport_provider IS 'Company or method handling the transport';
