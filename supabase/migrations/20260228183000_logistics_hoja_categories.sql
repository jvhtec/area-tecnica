-- Add Hoja transport categories for logistics events and Hoja transport rows.

-- 1) Enum used by logistics + hoja transport category arrays
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'logistics_transport_category'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.logistics_transport_category AS ENUM (
      'sonido_madera',
      'sonido_escenario',
      'iluminacion_hierro',
      'iluminacion_aparatos',
      'video',
      'rigging_motores'
    );
  END IF;
END
$$;

-- 2) Source logistics events: categories selected in logistics UI
ALTER TABLE public.logistics_events
  ADD COLUMN IF NOT EXISTS hoja_categories public.logistics_transport_category[] NOT NULL DEFAULT '{}'::public.logistics_transport_category[];

UPDATE public.logistics_events
SET hoja_categories = '{}'::public.logistics_transport_category[]
WHERE hoja_categories IS NULL;

-- 3) Hoja transport rows: persisted copy/editable categories
ALTER TABLE public.hoja_de_ruta_transport
  ADD COLUMN IF NOT EXISTS logistics_categories public.logistics_transport_category[] NOT NULL DEFAULT '{}'::public.logistics_transport_category[];

UPDATE public.hoja_de_ruta_transport
SET logistics_categories = '{}'::public.logistics_transport_category[]
WHERE logistics_categories IS NULL;

-- Enforce max 3 categories in both tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'logistics_events_hoja_categories_max3'
      AND conrelid = 'public.logistics_events'::regclass
  ) THEN
    ALTER TABLE public.logistics_events
      ADD CONSTRAINT logistics_events_hoja_categories_max3
      CHECK (coalesce(array_length(hoja_categories, 1), 0) <= 3);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hoja_de_ruta_transport_logistics_categories_max3'
      AND conrelid = 'public.hoja_de_ruta_transport'::regclass
  ) THEN
    ALTER TABLE public.hoja_de_ruta_transport
      ADD CONSTRAINT hoja_de_ruta_transport_logistics_categories_max3
      CHECK (coalesce(array_length(logistics_categories, 1), 0) <= 3);
  END IF;
END
$$;

-- 4) Extend transport replace helper with category persistence + source sync
CREATE OR REPLACE FUNCTION public.replace_hoja_de_ruta_transport(
  p_hoja_de_ruta_id uuid,
  p_transport_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY invoker
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.hoja_de_ruta_transport
  WHERE hoja_de_ruta_id = p_hoja_de_ruta_id;

  IF coalesce(jsonb_typeof(p_transport_rows), 'null') = 'array'
     AND jsonb_array_length(coalesce(p_transport_rows, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.hoja_de_ruta_transport (
      hoja_de_ruta_id,
      transport_type,
      driver_name,
      driver_phone,
      license_plate,
      company,
      date_time,
      has_return,
      return_date_time,
      source_logistics_event_id,
      is_hoja_relevant,
      logistics_categories
    )
    SELECT
      p_hoja_de_ruta_id,
      r.transport_type,
      r.driver_name,
      r.driver_phone,
      r.license_plate,
      r.company,
      r.date_time,
      coalesce(r.has_return, false),
      r.return_date_time,
      r.source_logistics_event_id,
      coalesce(r.is_hoja_relevant, true),
      coalesce(r.logistics_categories::public.logistics_transport_category[], '{}'::public.logistics_transport_category[])
    FROM jsonb_to_recordset(coalesce(p_transport_rows, '[]'::jsonb)) AS r(
      transport_type text,
      driver_name text,
      driver_phone text,
      license_plate text,
      company text,
      date_time timestamptz,
      has_return boolean,
      return_date_time timestamptz,
      source_logistics_event_id uuid,
      is_hoja_relevant boolean,
      logistics_categories text[]
    );

    -- Keep source logistics event relevance/categories in sync for linked rows.
    UPDATE public.logistics_events le
    SET
      is_hoja_relevant = ht.is_hoja_relevant,
      hoja_categories = coalesce(ht.logistics_categories, '{}'::public.logistics_transport_category[]),
      updated_at = now()
    FROM public.hoja_de_ruta_transport ht
    WHERE ht.hoja_de_ruta_id = p_hoja_de_ruta_id
      AND ht.source_logistics_event_id IS NOT NULL
      AND le.id = ht.source_logistics_event_id;
  END IF;
END;
$$;
