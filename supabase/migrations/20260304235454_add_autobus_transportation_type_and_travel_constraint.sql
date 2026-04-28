-- Add "autobus" support for Hoja de Ruta travel arrangements.
-- Also align allowed text values with current app data variants.

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.transportation_type ADD VALUE IF NOT EXISTS 'autobus';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;

ALTER TABLE public.hoja_de_ruta_travel_arrangements
  DROP CONSTRAINT IF EXISTS hoja_de_ruta_travel_arrangements_transportation_type_check;

ALTER TABLE public.hoja_de_ruta_travel_arrangements
  ADD CONSTRAINT hoja_de_ruta_travel_arrangements_transportation_type_check
  CHECK (
    transportation_type = ANY (
      ARRAY[
        'van'::text,
        'autobus'::text,
        'sleeper_bus'::text,
        'train'::text,
        'plane'::text,
        'rv'::text,
        'RV'::text,
        'bus'::text,
        'own_means'::text
      ]
    )
  );
