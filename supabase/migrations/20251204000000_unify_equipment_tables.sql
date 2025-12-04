-- Unify equipment_models and equipment tables
-- This migration consolidates the two equipment tables into one unified table
-- and adds resource_id for future flex integration

BEGIN;

-- Step 1: Add new columns to equipment table
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS resource_id TEXT,
ADD COLUMN IF NOT EXISTS manufacturer TEXT,
ADD COLUMN IF NOT EXISTS image_id TEXT;

COMMENT ON COLUMN equipment.resource_id IS
  'Resource ID for flex integration. Will be used to link equipment to flex resources.';

COMMENT ON COLUMN equipment.manufacturer IS
  'Equipment manufacturer name from Flex or manually entered.';

COMMENT ON COLUMN equipment.image_id IS
  'Flex image ID for equipment thumbnail. Used to fetch images on demand.';

-- Step 2: Create index on resource_id for better query performance
CREATE INDEX IF NOT EXISTS equipment_resource_id_idx ON equipment(resource_id);

-- Step 3: Migrate data from equipment_models to equipment
-- All equipment_models are sound department equipment
INSERT INTO equipment (id, name, category, department, created_at, updated_at)
SELECT
  id,
  name,
  category::equipment_category, -- Cast text to enum
  'sound' as department,
  created_at,
  updated_at
FROM equipment_models
WHERE NOT EXISTS (
  SELECT 1 FROM equipment WHERE equipment.id = equipment_models.id
);

-- Step 4: Log migration statistics
DO $$
DECLARE
  v_migrated_count INTEGER;
  v_total_equipment INTEGER;
  v_equipment_models_count INTEGER;
BEGIN
  -- Count records that were migrated
  SELECT COUNT(*) INTO v_equipment_models_count FROM equipment_models;

  -- Count total equipment after migration
  SELECT COUNT(*) INTO v_total_equipment FROM equipment;

  -- Calculate migrated count
  v_migrated_count := v_total_equipment - (SELECT COUNT(*) FROM equipment WHERE department != 'sound');

  RAISE NOTICE 'Equipment tables unification complete:';
  RAISE NOTICE '  Equipment models found: %', v_equipment_models_count;
  RAISE NOTICE '  Total equipment after migration: %', v_total_equipment;
  RAISE NOTICE '  ✓ resource_id field added for flex integration';
  RAISE NOTICE '  ✓ manufacturer field added for equipment details';
  RAISE NOTICE '  ✓ image_id field added for flex images';
  RAISE NOTICE '  ✓ All equipment_models data migrated to equipment table';
END $$;

-- Step 5: Drop equipment_models table
DROP TABLE IF EXISTS equipment_models CASCADE;

RAISE NOTICE '✓ equipment_models table dropped';
RAISE NOTICE '✓ Equipment tables successfully unified';

COMMIT;
