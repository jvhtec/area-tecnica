-- Add per-category base rates for custom_tech_rates
-- Allows house_tech (and any technician with overrides) to have different base day amounts
-- depending on job category (tecnico/especialista/responsable).

ALTER TABLE public.custom_tech_rates
  ADD COLUMN IF NOT EXISTS base_day_especialista_eur numeric,
  ADD COLUMN IF NOT EXISTS base_day_responsable_eur numeric,
  ADD COLUMN IF NOT EXISTS tour_base_especialista_eur numeric;
COMMENT ON COLUMN public.custom_tech_rates.base_day_especialista_eur IS
  'Optional base day override when category = especialista. Falls back to base_day_eur.';
COMMENT ON COLUMN public.custom_tech_rates.base_day_responsable_eur IS
  'Optional base day override when category = responsable. Falls back to base_day_especialista_eur/base_day_eur.';
COMMENT ON COLUMN public.custom_tech_rates.tour_base_especialista_eur IS
  'Optional tour base override when category = especialista. Falls back to tour_base_other_eur/base day overrides.';
COMMENT ON TABLE public.custom_tech_rates IS
  'Custom rate overrides for technicians. Applies to ANY technician (house_tech OR technician role) who needs custom rates different from the standard rate_cards_2025. When present, these rates take precedence over category-based rates. Supports per-category base day overrides for tecnico/especialista/responsable.';
