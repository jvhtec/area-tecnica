-- 2025 Timesheet Rate Calculator Implementation

-- 1) 2025 rate card (fixed values per spec)
CREATE TABLE IF NOT EXISTS rate_cards_2025 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('tecnico','especialista','responsable')),
  base_day_eur numeric(10,2) NOT NULL,      -- 240 / 270 / 320
  plus_10_12_eur numeric(10,2) NOT NULL,    -- 30 for all
  overtime_hour_eur numeric(10,2) NOT NULL, -- 20 / 20 / 25
  base_day_hours int NOT NULL DEFAULT 10,   -- up to 10h at base
  mid_tier_hours int NOT NULL DEFAULT 12,   -- 10–12 adds €30
  UNIQUE(category)
);

INSERT INTO rate_cards_2025 (category, base_day_eur, plus_10_12_eur, overtime_hour_eur)
VALUES
  ('tecnico',      240.00, 30.00, 20.00),
  ('especialista', 270.00, 30.00, 20.00),
  ('responsable',  320.00, 30.00, 25.00)
ON CONFLICT (category) DO UPDATE SET
  base_day_eur = EXCLUDED.base_day_eur,
  plus_10_12_eur = EXCLUDED.plus_10_12_eur,
  overtime_hour_eur = EXCLUDED.overtime_hour_eur;

-- 2) Extend timesheets with needed fields (no destructive changes)
ALTER TABLE timesheets 
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('tecnico','especialista','responsable')),
ADD COLUMN IF NOT EXISTS amount_eur numeric(10,2),
ADD COLUMN IF NOT EXISTS amount_breakdown jsonb,
ADD COLUMN IF NOT EXISTS approved_by_manager boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 3) Rounding helper: next hour only after >= 30 minutes
CREATE OR REPLACE FUNCTION minutes_to_hours_round_30(mins integer)
RETURNS integer 
LANGUAGE sql 
IMMUTABLE AS $$
  SELECT CASE
    WHEN mins IS NULL OR mins <= 0 THEN 0
    ELSE (mins / 60) + CASE WHEN (mins % 60) >= 30 THEN 1 ELSE 0 END
  END;
$$;

-- 4) Calculator RPC (computes & persists amount/breakdown)
CREATE OR REPLACE FUNCTION compute_timesheet_amount_2025(_timesheet_id uuid, _persist boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  t record;
  rc record;
  total_mins int;
  rounded_hours int;
  base_amount numeric(10,2) := 0;
  overtime_hours int := 0;
  overtime_amount numeric(10,2) := 0;
  total numeric(10,2) := 0;
  breakdown jsonb;
BEGIN
  SELECT * INTO t FROM timesheets WHERE id = _timesheet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Timesheet % not found', _timesheet_id; END IF;
  IF t.category IS NULL THEN RAISE EXCEPTION 'Timesheet % missing category', _timesheet_id; END IF;

  SELECT * INTO rc FROM rate_cards_2025 WHERE category = t.category;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rate card not found for %', t.category; END IF;

  -- Calculate total worked minutes = (end - start) - break
  total_mins := GREATEST(0, 
    CASE 
      WHEN t.start_time IS NOT NULL AND t.end_time IS NOT NULL THEN
        CAST(EXTRACT(epoch FROM (t.end_time::time - t.start_time::time)) AS int) / 60 - COALESCE(t.break_minutes,0)
      ELSE 0
    END
  );
  
  rounded_hours := minutes_to_hours_round_30(total_mins);

  -- Tiers:
  -- <= base_day_hours: base
  -- > base_day_hours and <= mid_tier_hours: base + plus_10_12
  -- > mid_tier_hours: base + plus_10_12 + overtime(rounded_hours - mid_tier_hours)
  IF rounded_hours <= rc.base_day_hours THEN
    base_amount := rc.base_day_eur;
  ELSIF rounded_hours <= rc.mid_tier_hours THEN
    base_amount := rc.base_day_eur + rc.plus_10_12_eur;
  ELSE
    base_amount := rc.base_day_eur + rc.plus_10_12_eur;
    overtime_hours := rounded_hours - rc.mid_tier_hours;
    overtime_amount := rc.overtime_hour_eur * overtime_hours;
  END IF;

  total := base_amount + overtime_amount;

  breakdown := jsonb_build_object(
    'category', t.category,
    'worked_minutes', total_mins,
    'worked_hours_rounded', rounded_hours,
    'base_day_hours', rc.base_day_hours,
    'mid_tier_hours', rc.mid_tier_hours,
    'base_amount_eur', ROUND(base_amount,2),
    'overtime_hours', overtime_hours,
    'overtime_hour_eur', rc.overtime_hour_eur,
    'overtime_amount_eur', ROUND(overtime_amount,2),
    'total_eur', ROUND(total,2),
    'notes', jsonb_build_array(
      'Rounding: next hour starts at ≥ 30 minutes',
      'No €30 deductions applied in math; conditions shown as disclaimers only',
      'House techs (in-house) rates will be implemented later'
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

-- 5) Visibility helper view: technicians only see amounts after manager approval; managers always see
DROP VIEW IF EXISTS timesheet_amounts_visible;
CREATE VIEW timesheet_amounts_visible AS
SELECT
  t.*,
  CASE
    WHEN EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'management'))
      THEN t.amount_eur
    WHEN t.approved_by_manager = true
      THEN t.amount_eur
    ELSE NULL
  END AS amount_eur_visible,
  CASE
    WHEN EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'management'))
      THEN t.amount_breakdown
    WHEN t.approved_by_manager = true
      THEN t.amount_breakdown
    ELSE NULL
  END AS amount_breakdown_visible
FROM timesheets t;

-- 6) RLS policies for new features
CREATE POLICY "Users can view visible timesheet amounts" ON timesheets
FOR SELECT USING (
  -- Allow access to timesheet data based on existing policies
  auth.uid() = technician_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
);

-- Enable RLS on rate cards (read-only for authenticated users)
ALTER TABLE rate_cards_2025 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rate cards" ON rate_cards_2025
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Management can manage rate cards" ON rate_cards_2025
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
);