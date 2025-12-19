-- Create table for Comunidad de Madrid regional holidays
-- This table stores official non-working days for the Comunidad de Madrid
-- Used to determine when house techs are NOT expected at the warehouse

CREATE TABLE IF NOT EXISTS madrid_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL UNIQUE, -- Format: YYYY-MM-DD
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_madrid_holidays_date ON madrid_holidays(date);
CREATE INDEX IF NOT EXISTS idx_madrid_holidays_year ON madrid_holidays(year);

-- Add RLS policies (readable by authenticated users, writable by admin/management only)
ALTER TABLE madrid_holidays ENABLE ROW LEVEL SECURITY;

-- Everyone can read holidays
CREATE POLICY "Anyone can view Madrid holidays"
  ON madrid_holidays FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and management can insert/update/delete
CREATE POLICY "Admins and management can manage Madrid holidays"
  ON madrid_holidays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Insert 2025 Comunidad de Madrid holidays
INSERT INTO madrid_holidays (date, name, year) VALUES
  ('2025-01-01', 'Año Nuevo', 2025),
  ('2025-01-06', 'Epifanía del Señor (Reyes)', 2025),
  ('2025-04-17', 'Jueves Santo', 2025),
  ('2025-04-18', 'Viernes Santo', 2025),
  ('2025-05-01', 'Fiesta del Trabajo', 2025),
  ('2025-05-02', 'Fiesta de la Comunidad de Madrid', 2025),
  ('2025-07-25', 'Santiago Apóstol', 2025),
  ('2025-08-15', 'Asunción de la Virgen', 2025),
  ('2025-10-12', 'Fiesta Nacional de España', 2025),
  ('2025-11-01', 'Todos los Santos', 2025),
  ('2025-12-06', 'Día de la Constitución Española', 2025),
  ('2025-12-08', 'Inmaculada Concepción', 2025),
  ('2025-12-25', 'Natividad del Señor (Navidad)', 2025)
ON CONFLICT (date) DO NOTHING;

-- Insert 2026 Comunidad de Madrid holidays
INSERT INTO madrid_holidays (date, name, year) VALUES
  ('2026-01-01', 'Año Nuevo', 2026),
  ('2026-01-06', 'Epifanía del Señor (Reyes)', 2026),
  ('2026-04-02', 'Jueves Santo', 2026),
  ('2026-04-03', 'Viernes Santo', 2026),
  ('2026-05-01', 'Fiesta del Trabajo', 2026),
  ('2026-05-02', 'Fiesta de la Comunidad de Madrid', 2026),
  ('2026-07-25', 'Santiago Apóstol', 2026),
  ('2026-08-15', 'Asunción de la Virgen', 2026),
  ('2026-10-12', 'Fiesta Nacional de España', 2026),
  ('2026-11-01', 'Todos los Santos', 2026),
  ('2026-12-06', 'Día de la Constitución Española', 2026),
  ('2026-12-08', 'Inmaculada Concepción', 2026),
  ('2026-12-25', 'Natividad del Señor (Navidad)', 2026)
ON CONFLICT (date) DO NOTHING;

-- Create a function to check if a date is a Madrid working day
-- Returns true if the date is a working day (not weekend, not holiday)
CREATE OR REPLACE FUNCTION is_madrid_working_day(check_date TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  day_of_week INTEGER;
  is_holiday BOOLEAN;
BEGIN
  -- Check if it's a weekend (0 = Sunday, 6 = Saturday)
  day_of_week := EXTRACT(DOW FROM check_date::DATE);
  IF day_of_week IN (0, 6) THEN
    RETURN false;
  END IF;

  -- Check if it's a holiday
  SELECT EXISTS(
    SELECT 1 FROM madrid_holidays
    WHERE date = check_date AND is_active = true
  ) INTO is_holiday;

  IF is_holiday THEN
    RETURN false;
  END IF;

  -- It's a working day
  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a helper function to get all Madrid holidays for a year
CREATE OR REPLACE FUNCTION get_madrid_holidays(holiday_year INTEGER DEFAULT NULL)
RETURNS TABLE (
  date TEXT,
  name TEXT,
  year INTEGER
) AS $$
BEGIN
  IF holiday_year IS NULL THEN
    RETURN QUERY
    SELECT h.date, h.name, h.year
    FROM madrid_holidays h
    WHERE h.is_active = true
    ORDER BY h.date;
  ELSE
    RETURN QUERY
    SELECT h.date, h.name, h.year
    FROM madrid_holidays h
    WHERE h.year = holiday_year AND h.is_active = true
    ORDER BY h.date;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE madrid_holidays IS 'Official non-working days for Comunidad de Madrid. Used to determine warehouse working days for house techs.';
COMMENT ON FUNCTION is_madrid_working_day IS 'Returns true if the given date is a working day in Madrid (not weekend, not holiday)';
COMMENT ON FUNCTION get_madrid_holidays IS 'Returns all active Madrid holidays, optionally filtered by year';
