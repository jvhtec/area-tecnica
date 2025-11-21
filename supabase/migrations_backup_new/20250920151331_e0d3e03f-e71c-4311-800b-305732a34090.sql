-- Phase 1: Create Universal Job Extras System

-- Create job_extra_type enum
DO $$ BEGIN
    CREATE TYPE job_extra_type AS ENUM ('travel_half', 'travel_full', 'day_off');
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- Create extras catalog table
CREATE TABLE IF NOT EXISTS rate_extras_2025 (
    extra_type job_extra_type PRIMARY KEY,
    amount_eur numeric(10,2) NOT NULL
);

-- Insert default rates
INSERT INTO rate_extras_2025(extra_type, amount_eur) VALUES
    ('travel_half', 50.00),
    ('travel_full', 100.00),
    ('day_off', 100.00)
ON CONFLICT (extra_type) DO UPDATE SET amount_eur = EXCLUDED.amount_eur;

-- Create job-level extras table
CREATE TABLE IF NOT EXISTS job_rate_extras (
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    extra_type job_extra_type NOT NULL,
    quantity int NOT NULL DEFAULT 0,
    amount_override_eur numeric(10,2), -- optional override; else use catalog
    updated_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, technician_id, extra_type),
    CHECK (quantity >= 0),
    -- Business guardrails
    CHECK ((extra_type <> 'travel_half') OR (quantity <= 2)),
    CHECK ((extra_type <> 'travel_full') OR (quantity <= 1)),
    CHECK ((extra_type <> 'day_off') OR (quantity <= 1))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_job_rate_extras_job ON job_rate_extras(job_id);
CREATE INDEX IF NOT EXISTS idx_job_rate_extras_tech ON job_rate_extras(technician_id);

-- Enable RLS
ALTER TABLE job_rate_extras ENABLE ROW LEVEL SECURITY;

-- Managers: full read/write
CREATE POLICY job_extras_mgr_read ON job_rate_extras
FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
));

CREATE POLICY job_extras_mgr_write ON job_rate_extras
FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
))
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
));

-- Technicians: read only their rows
CREATE POLICY job_extras_tech_read ON job_rate_extras
FOR SELECT USING (technician_id = auth.uid());

-- Residency helper function
CREATE OR REPLACE FUNCTION needs_vehicle_disclaimer(_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(NULLIF(lower(trim(p.residencia)), 'madrid') IS NOT NULL, false)
    FROM profiles p WHERE p.id = _profile_id;
$$;

-- Extras total helper function
CREATE OR REPLACE FUNCTION extras_total_for_job_tech(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    WITH extras_rows AS (
        SELECT e.extra_type,
               e.quantity,
               COALESCE(e.amount_override_eur, r.amount_eur) as unit_eur,
               (COALESCE(e.amount_override_eur, r.amount_eur) * e.quantity)::numeric(10,2) as amount_eur
        FROM job_rate_extras e
        JOIN rate_extras_2025 r ON r.extra_type = e.extra_type
        WHERE e.job_id = _job_id AND e.technician_id = _tech_id AND e.quantity > 0
    )
    SELECT jsonb_build_object(
        'items', COALESCE(jsonb_agg(jsonb_build_object(
            'extra_type', extra_type, 
            'quantity', quantity, 
            'unit_eur', unit_eur, 
            'amount_eur', amount_eur
        )), '[]'::jsonb),
        'total_eur', COALESCE(sum(amount_eur), 0)::numeric
    )
    FROM extras_rows;
$$;

-- Update the tour quote function to include extras and disclaimer
CREATE OR REPLACE FUNCTION compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jtype job_type; st timestamptz; tour_group uuid;
  cat text; house boolean := false;
  base numeric(10,2); mult numeric(6,3) := 1.0; cnt int := 1;
  y int; w int;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
BEGIN
  -- Fetch job info
  SELECT job_type, start_time, tour_id
  INTO jtype, st, tour_group
  FROM jobs WHERE id = _job_id;

  IF NOT FOUND THEN RETURN jsonb_build_object('error','job_not_found'); END IF;
  IF jtype <> 'tourdate' THEN RETURN jsonb_build_object('error','not_tour_date'); END IF;

  -- House tech?
  house := is_house_tech(_tech_id);

  -- Resolve category (for non-house only)
  IF NOT house THEN
    -- 1) Check if we can map from assignment roles to categories
    SELECT 
      CASE 
        WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
        WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista' 
        WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
        ELSE null
      END INTO cat
    FROM job_assignments
    WHERE job_id = _job_id AND technician_id = _tech_id;

    -- 2) fallback: profile default
    IF cat IS NULL THEN
      SELECT default_timesheet_category INTO cat
      FROM profiles
      WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
    END IF;
    
    IF cat IS NULL THEN
      RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
    END IF;
  END IF;

  -- Base rate
  IF house THEN
    SELECT base_day_eur INTO base FROM house_tech_rates WHERE profile_id = _tech_id;
    IF base IS NULL THEN
      RETURN jsonb_build_object('error','house_rate_missing','profile_id',_tech_id);
    END IF;
    mult := 1.0;  -- no multipliers for house techs
  ELSE
    SELECT base_day_eur INTO base FROM rate_cards_tour_2025 WHERE category = cat;
    IF base IS NULL THEN
      RETURN jsonb_build_object('error','tour_base_missing','category',cat);
    END IF;
  END IF;

  -- Multiplier (non-house)
  IF NOT house THEN
    SELECT iso_year, iso_week INTO y, w FROM iso_year_week_madrid(st);

    -- Count tour date jobs for same tech, same tour, same ISO week
    SELECT count(*) INTO cnt
    FROM job_assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.technician_id = _tech_id
      AND j.job_type = 'tourdate'
      AND j.tour_id = tour_group
      AND (SELECT iso_year FROM iso_year_week_madrid(j.start_time)) = y
      AND (SELECT iso_week FROM iso_year_week_madrid(j.start_time)) = w;

    SELECT multiplier INTO mult
    FROM tour_week_multipliers_2025
    WHERE GREATEST(1,cnt) BETWEEN min_dates AND max_dates
    ORDER BY min_dates
    LIMIT 1;
    IF mult IS NULL THEN mult := 1.0; END IF;
  END IF;

  -- Calculate base total
  base := ROUND(base * mult, 2);

  -- Get extras
  extras := extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);

  -- Final total with extras
  final_total := ROUND(base + extras_total, 2);

  -- Vehicle disclaimer
  disclaimer := needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'end_time', st, -- placeholder
    'job_type', 'tourdate',
    'tour_id', tour_group,
    'title', '', -- placeholder
    'is_house_tech', house,
    'category', cat,
    'base_day_eur', base / GREATEST(mult, 1.0), -- original base before multiplier
    'week_count', GREATEST(1,cnt),
    'multiplier', mult,
    'iso_year', y,
    'iso_week', w,
    'total_eur', base, -- base total without extras
    'extras', extras,
    'extras_total_eur', extras_total,
    'total_with_extras_eur', final_total,
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE 
      WHEN disclaimer THEN 'Fuel/drive compensation may apply when using own vehicle. Coordinate with HR on a per-job basis.'
      ELSE NULL 
    END,
    'breakdown', jsonb_build_object(
      'base_calculation', jsonb_build_object(
        'base_day_eur', base / GREATEST(mult, 1.0),
        'multiplier', mult,
        'base_total_eur', base
      ),
      'extras_breakdown', extras,
      'final_total_eur', final_total
    )
  );
END;
$$;

-- Create non-tour payout view
DROP VIEW IF EXISTS v_job_tech_payout_2025;

CREATE OR REPLACE VIEW v_job_tech_payout_2025 AS
WITH ts AS (
  SELECT
    t.job_id,
    t.technician_id,
    sum(COALESCE(t.amount_eur,0)) FILTER (WHERE t.approved_by_manager = true) as timesheets_total_eur
  FROM timesheets t
  GROUP BY t.job_id, t.technician_id
),
ex AS (
  SELECT
    e.job_id,
    e.technician_id,
    (x->>'total_eur')::numeric as extras_total_eur,
    x as extras_breakdown
  FROM (
    SELECT DISTINCT job_id, technician_id, extras_total_for_job_tech(job_id, technician_id) as x
    FROM job_rate_extras
  ) q
),
job_rows AS (
  SELECT
    j.id as job_id,
    a.technician_id,
    COALESCE(ts.timesheets_total_eur, 0)::numeric as timesheets_total_eur,
    COALESCE(ex.extras_total_eur, 0)::numeric as extras_total_eur,
    (COALESCE(ts.timesheets_total_eur,0) + COALESCE(ex.extras_total_eur,0))::numeric as total_eur,
    ex.extras_breakdown,
    needs_vehicle_disclaimer(a.technician_id) as vehicle_disclaimer
  FROM jobs j
  JOIN job_assignments a ON a.job_id = j.id
  LEFT JOIN ts ON ts.job_id = j.id AND ts.technician_id = a.technician_id
  LEFT JOIN ex ON ex.job_id = j.id AND ex.technician_id = a.technician_id
  WHERE j.job_type <> 'tourdate'  -- non-tour jobs only
)
SELECT
  job_id, 
  technician_id,
  timesheets_total_eur,
  extras_total_eur,
  total_eur,
  extras_breakdown,
  vehicle_disclaimer,
  CASE WHEN vehicle_disclaimer THEN
    'Fuel/drive compensation may apply when using own vehicle. Coordinate with HR on a per-job basis.'
  ELSE NULL END as vehicle_disclaimer_text
FROM job_rows;