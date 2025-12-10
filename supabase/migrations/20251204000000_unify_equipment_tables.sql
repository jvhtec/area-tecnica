-- Unify equipment_models and equipment tables
-- This migration consolidates the two equipment tables into one unified table
-- and adds resource_id for future flex integration

BEGIN;

-- ============================================================================
-- PRE-FLIGHT VALIDATION
-- ============================================================================

-- Check for ID collisions between equipment_models and equipment tables
DO $$
DECLARE
  v_collision_count INTEGER;
  v_collision_ids TEXT;
BEGIN
  SELECT COUNT(*), string_agg(em.id::text, ', ')
  INTO v_collision_count, v_collision_ids
  FROM equipment_models em
  WHERE EXISTS (SELECT 1 FROM equipment e WHERE e.id = em.id);

  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 'ID collision detected: % records would be lost. IDs: %',
      v_collision_count, LEFT(v_collision_ids, 200);
  END IF;

  RAISE NOTICE 'Pre-flight check: No ID collisions detected ✓';
END $$;

-- Validate all categories in equipment_models can be cast to equipment_category enum
DO $$
DECLARE
  v_invalid_categories TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT category) INTO v_invalid_categories
  FROM equipment_models
  WHERE category NOT IN (
    SELECT unnest(enum_range(NULL::equipment_category))::text
  );

  IF array_length(v_invalid_categories, 1) > 0 THEN
    RAISE EXCEPTION 'Invalid categories found that cannot be cast to equipment_category enum: %',
      v_invalid_categories;
  END IF;

  RAISE NOTICE 'Pre-flight check: All categories are valid ✓';
END $$;

-- ============================================================================
-- STEP 1: Add new columns to equipment table
-- ============================================================================
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

-- ============================================================================
-- STEP 2: Create indexes for better query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS equipment_resource_id_idx ON equipment(resource_id)
  WHERE resource_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS equipment_manufacturer_idx ON equipment(manufacturer)
  WHERE manufacturer IS NOT NULL;

CREATE INDEX IF NOT EXISTS equipment_image_id_idx ON equipment(image_id)
  WHERE image_id IS NOT NULL;

-- Add unique constraint on resource_id (allowing NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS equipment_resource_id_unique_idx
  ON equipment(resource_id)
  WHERE resource_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Migrate data from equipment_models to equipment
-- ============================================================================
-- All equipment_models are sound department equipment
INSERT INTO equipment (id, name, category, department, created_at, updated_at)
SELECT
  id,
  name,
  category::equipment_category, -- Cast text to enum (validated in pre-flight)
  'sound' as department,
  created_at,
  updated_at
FROM equipment_models;
-- Note: No WHERE NOT EXISTS needed - pre-flight validated no collisions

-- ============================================================================
-- STEP 4: Log migration statistics
-- ============================================================================
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

  -- Calculate migrated count (sound department items)
  SELECT COUNT(*) INTO v_migrated_count FROM equipment WHERE department = 'sound';

  RAISE NOTICE 'Equipment tables unification complete:';
  RAISE NOTICE '  Equipment models migrated: %', v_equipment_models_count;
  RAISE NOTICE '  Sound department equipment: %', v_migrated_count;
  RAISE NOTICE '  Total equipment after migration: %', v_total_equipment;
  RAISE NOTICE '  ✓ resource_id field added for flex integration';
  RAISE NOTICE '  ✓ manufacturer field added for equipment details';
  RAISE NOTICE '  ✓ image_id field added for flex images';
  RAISE NOTICE '  ✓ All equipment_models data migrated to equipment table';
END $$;

-- ============================================================================
-- STEP 5: Deprecate equipment_models table (SAFE - can be rolled back)
-- ============================================================================
-- Instead of dropping, we rename the table for safety
-- This allows rollback if issues are discovered post-deployment
-- The table can be permanently dropped after 30 days of successful operation

ALTER TABLE equipment_models RENAME TO equipment_models_deprecated_20251204;

COMMENT ON TABLE equipment_models_deprecated_20251204 IS
  'DEPRECATED: Data migrated to equipment table on 2025-12-04. Safe to drop after 30 days if no issues reported. To rollback: ALTER TABLE equipment_models_deprecated_20251204 RENAME TO equipment_models;';

RAISE NOTICE '✓ equipment_models table renamed to equipment_models_deprecated_20251204';
RAISE NOTICE '✓ Equipment tables successfully unified';
RAISE NOTICE '✓ ROLLBACK: To restore, run: ALTER TABLE equipment_models_deprecated_20251204 RENAME TO equipment_models;';

COMMIT;
