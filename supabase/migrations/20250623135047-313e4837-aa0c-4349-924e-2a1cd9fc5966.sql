
-- First, let's see what the current constraint allows by looking at existing categories
-- Then add wired_mics to the allowed categories

-- Drop the existing check constraint
ALTER TABLE equipment_models DROP CONSTRAINT IF EXISTS equipment_models_category_check;

-- Add a new constraint that includes wired_mics along with existing categories
ALTER TABLE equipment_models 
ADD CONSTRAINT equipment_models_category_check 
CHECK (category IN ('foh_console', 'mon_console', 'wireless', 'iem', 'wired_mics'));

-- Now add the microphone columns to festival_artists table
ALTER TABLE festival_artists 
ADD COLUMN mic_kit text DEFAULT 'band' CHECK (mic_kit IN ('festival', 'band')),
ADD COLUMN wired_mics jsonb DEFAULT '[]'::jsonb;

-- Add wired microphone models to equipment_models
INSERT INTO equipment_models (name, category) VALUES
('Shure SM58', 'wired_mics'),
('Shure SM57', 'wired_mics'),
('Shure Beta 58A', 'wired_mics'),
('Shure Beta 57A', 'wired_mics'),
('Sennheiser e935', 'wired_mics'),
('Sennheiser e945', 'wired_mics'),
('Sennheiser e906', 'wired_mics'),
('Audio-Technica AT2020', 'wired_mics'),
('Neumann KMS 105', 'wired_mics'),
('AKG D5', 'wired_mics'),
('Electro-Voice RE20', 'wired_mics'),
('Rode PodMic', 'wired_mics');
