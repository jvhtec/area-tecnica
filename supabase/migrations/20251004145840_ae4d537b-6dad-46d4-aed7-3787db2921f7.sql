-- Add the 2 new sound equipment categories to the enum
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'speakers';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'monitors';