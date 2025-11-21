-- Ensure realtime replication for presets, preset_items, day_preset_assignments, sub_rentals and stock tables

-- Set REPLICA IDENTITY FULL so WAL includes old/new rows
ALTER TABLE IF EXISTS public.presets REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.preset_items REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.day_preset_assignments REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.sub_rentals REPLICA IDENTITY FULL;
-- Note: current_stock_levels is a view; REPLICA IDENTITY is not applicable.
-- Instead, track underlying tables such as equipment and sub_rentals.
ALTER TABLE IF EXISTS public.equipment REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication if it exists and tables are not already included
DO $$
DECLARE
  pub_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  IF pub_exists THEN
    -- Helper macro: add if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname='supabase_realtime')
        AND c.relname = 'presets'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.presets';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname='supabase_realtime')
        AND c.relname = 'preset_items'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.preset_items';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname='supabase_realtime')
        AND c.relname = 'day_preset_assignments'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.day_preset_assignments';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname='supabase_realtime')
        AND c.relname = 'sub_rentals'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sub_rentals';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname='supabase_realtime')
        AND c.relname = 'equipment'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment';
    END IF;
  END IF;
END $$;
