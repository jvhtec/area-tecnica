-- Phase 1: Extend equipment_category enum with amplificacion
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'amplificacion';

-- Phase 2: Add department column to equipment table
ALTER TABLE equipment 
ADD COLUMN department text NOT NULL DEFAULT 'lights'
CHECK (department IN ('sound', 'lights', 'video'));

CREATE INDEX idx_equipment_department ON equipment(department);

-- Migrate existing equipment data based on category
UPDATE equipment 
SET department = CASE
  WHEN category IN ('foh_console', 'mon_console', 'wireless', 'iem', 'wired_mics', 'speakers', 'monitors', 'amplificacion') THEN 'sound'
  ELSE 'lights'
END;

-- Phase 3: Add department column to presets table
ALTER TABLE presets 
ADD COLUMN department text NOT NULL DEFAULT 'lights'
CHECK (department IN ('sound', 'lights', 'video'));

CREATE INDEX idx_presets_department ON presets(department);

-- All existing presets default to lights department
UPDATE presets SET department = 'lights';

-- Phase 4: Add department column to sub_rentals table
ALTER TABLE sub_rentals 
ADD COLUMN department text NOT NULL DEFAULT 'lights'
CHECK (department IN ('sound', 'lights', 'video'));

CREATE INDEX idx_sub_rentals_department ON sub_rentals(department);

-- Infer department from linked equipment for existing sub_rentals
UPDATE sub_rentals sr
SET department = e.department
FROM equipment e
WHERE sr.equipment_id = e.id;