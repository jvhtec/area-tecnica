-- PA subsystem-aware presets and amplification calculator integration scaffolding
-- - Expand equipment_category enum for Flex category buckets
-- - Add subsystem/source metadata to preset_items for downstream mapping

-- 1) Expand equipment_category enum with PA-specific buckets
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'pa_mains';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'pa_outfill';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'pa_subs';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'pa_frontfill';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'pa_delays';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'pa_amp';

-- 2) Add subsystem metadata to preset items (logical PA grouping)
ALTER TABLE preset_items
  ADD COLUMN IF NOT EXISTS subsystem TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Enforce valid subsystem values when provided (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'preset_items_subsystem_valid'
      AND t.relname = 'preset_items'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE $constraint$
      ALTER TABLE public.preset_items
        ADD CONSTRAINT preset_items_subsystem_valid
        CHECK (
          subsystem IS NULL
          OR subsystem IN (
            'mains',
            'outs',
            'subs',
            'fronts',
            'delays',
            'other',
            'amplification'
          )
        )
    $constraint$;
  END IF;
END $$;

COMMENT ON COLUMN preset_items.subsystem IS 'Logical PA subsystem for this preset item (mains, outs, subs, fronts, delays, other, amplification).';
COMMENT ON COLUMN preset_items.source IS 'Origin of the preset item (e.g., manual entry, amp_calculator).';
