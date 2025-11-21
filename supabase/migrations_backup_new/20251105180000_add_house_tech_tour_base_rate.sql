-- Add tour base rates for house techs
-- House techs can have different rates for house events vs tour events
-- Tours have two rate tiers: one for responsable category, one for tecnico/especialista

-- Add tour base rate columns
ALTER TABLE house_tech_rates
ADD COLUMN IF NOT EXISTS tour_base_responsable_eur NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS tour_base_other_eur NUMERIC(10, 2);

-- Add comments explaining the columns
COMMENT ON COLUMN house_tech_rates.tour_base_responsable_eur IS
'Tour base rate when house tech works as responsable on tour dates. If NULL, falls back to base_day_eur.';

COMMENT ON COLUMN house_tech_rates.tour_base_other_eur IS
'Tour base rate when house tech works as tecnico/especialista on tour dates. If NULL, falls back to base_day_eur.';
