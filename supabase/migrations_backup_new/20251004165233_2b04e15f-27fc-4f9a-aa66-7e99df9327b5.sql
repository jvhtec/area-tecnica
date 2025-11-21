-- Add missing sound categories to equipment_category enum
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'foh_console';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'mon_console';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'wireless';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'iem';
ALTER TYPE equipment_category ADD VALUE IF NOT EXISTS 'wired_mics';