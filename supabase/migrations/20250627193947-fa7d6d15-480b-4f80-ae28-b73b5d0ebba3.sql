
-- Add 'mixed' to the provider_type enum
ALTER TYPE provider_type ADD VALUE 'mixed';

-- Update the mic_kit check constraint to include 'mixed'
ALTER TABLE festival_artists DROP CONSTRAINT IF EXISTS festival_artists_mic_kit_check;
ALTER TABLE festival_artists ADD CONSTRAINT festival_artists_mic_kit_check CHECK (mic_kit IN ('festival', 'band', 'mixed'));
