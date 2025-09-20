-- 1) Per-profile house tech rate store (hidden via RLS; managers only)
CREATE TABLE IF NOT EXISTS house_tech_rates (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  base_day_eur NUMERIC(10,2) NOT NULL,
  -- optional overrides; if null we fall back to category defaults
  plus_10_12_eur NUMERIC(10,2),
  overtime_hour_eur NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_house_rates_updated ON house_tech_rates(updated_at DESC);

ALTER TABLE house_tech_rates ENABLE ROW LEVEL SECURITY;

-- Managers can read/write; others cannot read at all.
CREATE POLICY house_rates_mgr_sel ON house_tech_rates
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')));

CREATE POLICY house_rates_mgr_ins ON house_tech_rates
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')));

CREATE POLICY house_rates_mgr_upd ON house_tech_rates
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')));

-- 2) Activity catalog entry for auditing rate changes
INSERT INTO activity_catalog(code, label, default_visibility, severity, toast_enabled, template) VALUES
('settings.house_rate.updated', 'House tech rate updated', 'management', 'info', true, '{actor_name} updated rate for {profile_name}')
ON CONFLICT (code) DO NOTHING;

-- 3) Helper view to get "effective" rates per timesheet:
--    start with category defaults (tecnico/especialista/responsable) and override from house_tech_rates if present.
CREATE OR REPLACE VIEW v_timesheet_effective_rate AS
SELECT
  t.id as timesheet_id,
  t.category,
  t.technician_id,
  -- defaults from rate_cards_2025
  rc.base_day_eur                            as base_day_default,
  rc.plus_10_12_eur                          as plus_10_12_default,
  rc.overtime_hour_eur                       as overtime_default,
  -- overrides (nullable)
  hr.base_day_eur                            as base_day_override,
  hr.plus_10_12_eur                          as plus_10_12_override,
  hr.overtime_hour_eur                       as overtime_override
FROM timesheets t
LEFT JOIN rate_cards_2025 rc ON rc.category = t.category
LEFT JOIN house_tech_rates hr ON hr.profile_id = t.technician_id;

-- 4) Update compute_timesheet_amount_2025 to use the effective rate:
CREATE OR REPLACE FUNCTION compute_timesheet_amount_2025(_timesheet_id UUID, _persist BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  t record;
  eff record;  -- effective rates row
  total_mins int;
  rounded_hours int;
  base_amount numeric(10,2) := 0;
  overtime_hours int := 0;
  overtime_amount numeric(10,2) := 0;
  total numeric(10,2) := 0;
  base_day_eur numeric(10,2);
  plus_10_12_eur numeric(10,2);
  overtime_hour_eur numeric(10,2);
  breakdown jsonb;
BEGIN
  SELECT * INTO t FROM timesheets WHERE id = _timesheet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Timesheet % not found', _timesheet_id; END IF;
  IF t.category IS NULL THEN RAISE EXCEPTION 'Timesheet % missing category', _timesheet_id; END IF;

  SELECT * INTO eff FROM v_timesheet_effective_rate WHERE timesheet_id = _timesheet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Effective rate not found (category %)', t.category; END IF;

  -- choose overrides when present; otherwise defaults
  base_day_eur     := COALESCE(eff.base_day_override,   eff.base_day_default);
  plus_10_12_eur   := COALESCE(eff.plus_10_12_override, eff.plus_10_12_default);
  overtime_hour_eur:= COALESCE(eff.overtime_override,   eff.overtime_default);

  -- Calculate total worked minutes = (end - start) - break
  -- Support shifts that extend into the next day
  total_mins := GREATEST(0,
    CASE
      WHEN t.start_time IS NOT NULL AND t.end_time IS NOT NULL THEN
        CAST(EXTRACT(
          epoch FROM (
            ((timestamp '2000-01-01' + t.end_time::time)
              + CASE WHEN COALESCE(t.ends_next_day, false) THEN interval '1 day' ELSE interval '0 day' END)
            - (timestamp '2000-01-01' + t.start_time::time)
          )
        ) AS int) / 60 - COALESCE(t.break_minutes, 0)
      ELSE 0
    END
  );
  
  rounded_hours := minutes_to_hours_round_30(total_mins);

  -- Tiers: <=10h base; 10-12h +30; >12h overtime for hours over 12
  IF rounded_hours <= 10 THEN
    base_amount := base_day_eur;
  ELSIF rounded_hours <= 12 THEN
    base_amount := base_day_eur + plus_10_12_eur;
  ELSE
    base_amount := base_day_eur + plus_10_12_eur;
    overtime_hours := rounded_hours - 12;
    overtime_amount := overtime_hour_eur * overtime_hours;
  END IF;

  total := base_amount + overtime_amount;

  breakdown := jsonb_build_object(
    'rate_source', CASE WHEN eff.base_day_override IS NOT NULL THEN 'profile_override' else 'category_default' END,
    'category', t.category,
    'worked_minutes', total_mins,
    'worked_hours_rounded', rounded_hours,
    'base_day_eur', ROUND(base_day_eur,2),
    'plus_10_12_eur', ROUND(plus_10_12_eur,2),
    'overtime_hour_eur', ROUND(overtime_hour_eur,2),
    'base_day_hours', 10,
    'mid_tier_hours', 12,
    'base_amount_eur', ROUND(base_amount - overtime_amount,2),
    'overtime_hours', overtime_hours,
    'overtime_amount_eur', ROUND(overtime_amount,2),
    'total_eur', ROUND(total,2),
    'notes', jsonb_build_array(
      'Rounding: next hour starts at ≥ 30 minutes',
      CASE WHEN eff.base_day_override IS NOT NULL THEN 'Using profile-specific rates' ELSE 'Using category default rates' END
    )
  );

  IF _persist THEN
    UPDATE timesheets
    SET amount_eur = ROUND(total,2),
        amount_breakdown = breakdown
    WHERE id = _timesheet_id;
  END IF;

  RETURN breakdown;
END;
$$;