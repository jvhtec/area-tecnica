-- Add 'sector-pro' to allowed values in hoja_de_ruta_transport.company
DO $$
BEGIN
  -- Drop existing CHECK constraint if present
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'hoja_de_ruta_transport_company_check'
      AND table_name = 'hoja_de_ruta_transport'
      AND table_schema = 'public'
  ) THEN
    EXECUTE 'ALTER TABLE public.hoja_de_ruta_transport DROP CONSTRAINT hoja_de_ruta_transport_company_check';
  END IF;

  -- Recreate CHECK constraint including 'sector-pro'
  EXECUTE 'ALTER TABLE public.hoja_de_ruta_transport 
    ADD CONSTRAINT hoja_de_ruta_transport_company_check 
    CHECK (company IN (''pantoja'', ''transluminaria'', ''transcamarena'', ''wild tour'', ''camionaje'', ''other'', ''sector-pro''))';
END $$;
