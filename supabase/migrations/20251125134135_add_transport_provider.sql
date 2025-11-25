-- Create transport provider enum
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

-- Add column to logistics_events table
ALTER TABLE logistics_events
ADD COLUMN transport_provider transport_provider_enum;

-- Add comment for documentation
COMMENT ON COLUMN logistics_events.transport_provider IS 'Company or method handling the transport';
