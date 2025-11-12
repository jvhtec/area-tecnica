-- ============================================================================
-- TOUR SCHEDULING AND TIMELINE SYSTEM
-- ============================================================================
-- This migration adds comprehensive tour scheduling and timeline management:
-- 1. Extends tours table with settings and metadata
-- 2. Extends hoja_de_ruta table with detailed itinerary data
-- 3. Creates tour_timeline_events table for non-show events
-- 4. Creates tour_travel_segments table for travel planning
-- 5. Creates tour_accommodations table for hotel management
-- 6. Creates tour_schedule_templates table for reusable schedules
-- 7. Sets up RLS policies and helper functions
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTEND TOURS TABLE
-- ============================================================================

-- Add tour-level settings and metadata
ALTER TABLE public.tours
ADD COLUMN IF NOT EXISTS tour_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS travel_plan JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tour_contacts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS default_timezone TEXT DEFAULT 'Europe/Madrid',
ADD COLUMN IF NOT EXISTS scheduling_preferences JSONB DEFAULT '{
  "buffer_time_minutes": 30,
  "teardown_hours": 2,
  "default_load_in_time": "09:00",
  "default_sound_check_duration": 60
}'::jsonb;

-- ============================================================================
-- SECTION 2: EXTEND HOJA_DE_RUTA TABLE
-- ============================================================================

-- Add day-specific itinerary and scheduling details
ALTER TABLE public.hoja_de_ruta
ADD COLUMN IF NOT EXISTS tour_date_id UUID REFERENCES public.tour_dates(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS hotel_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS restaurants_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS local_contacts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS venue_technical_specs JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS crew_calls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS alerts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS logistics_info JSONB DEFAULT '{}'::jsonb;

-- Create index on tour_date_id
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_tour_date_id ON public.hoja_de_ruta(tour_date_id);

-- ============================================================================
-- SECTION 3: CREATE TOUR_TIMELINE_EVENTS TABLE
-- ============================================================================

-- Store additional timeline events (travel days, days off, rehearsals, etc.)
CREATE TABLE IF NOT EXISTS public.tour_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'travel', 'day_off', 'rehearsal', 'meeting', 'other'
  title TEXT NOT NULL,
  description TEXT,

  -- Timing
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  timezone TEXT DEFAULT 'Europe/Madrid',
  all_day BOOLEAN DEFAULT false,

  -- Location
  location_id UUID REFERENCES public.locations(id),
  location_details TEXT,

  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Visibility
  visible_to_crew BOOLEAN DEFAULT true,
  departments TEXT[] DEFAULT '{}'::text[], -- empty means all departments

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tour_timeline_events_tour_id ON public.tour_timeline_events(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_timeline_events_date ON public.tour_timeline_events(date);
CREATE INDEX IF NOT EXISTS idx_tour_timeline_events_type ON public.tour_timeline_events(event_type);

-- ============================================================================
-- SECTION 4: CREATE TOUR_TRAVEL_SEGMENTS TABLE
-- ============================================================================

-- Detailed travel planning between tour dates
CREATE TABLE IF NOT EXISTS public.tour_travel_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,

  -- Segment routing
  from_tour_date_id UUID REFERENCES public.tour_dates(id) ON DELETE CASCADE,
  to_tour_date_id UUID REFERENCES public.tour_dates(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES public.locations(id),
  to_location_id UUID REFERENCES public.locations(id),

  -- Travel details
  transportation_type TEXT NOT NULL, -- 'bus', 'van', 'flight', 'train', 'ferry', 'truck'
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,

  -- Transportation details
  carrier_name TEXT,
  vehicle_details JSONB, -- bus company, flight number, train details, etc.

  -- Routing
  distance_km NUMERIC,
  estimated_duration_minutes INTEGER,
  route_notes TEXT,
  stops JSONB DEFAULT '[]'::jsonb, -- rest stops, fuel stops, etc.

  -- Crew logistics
  crew_manifest JSONB DEFAULT '[]'::jsonb, -- who's traveling on this segment
  luggage_truck BOOLEAN DEFAULT false,

  -- Costs
  estimated_cost_eur NUMERIC,
  actual_cost_eur NUMERIC,

  -- Status
  status TEXT DEFAULT 'planned', -- 'planned', 'confirmed', 'in_progress', 'completed', 'cancelled'

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tour_travel_segments_tour_id ON public.tour_travel_segments(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_travel_segments_from_date ON public.tour_travel_segments(from_tour_date_id);
CREATE INDEX IF NOT EXISTS idx_tour_travel_segments_to_date ON public.tour_travel_segments(to_tour_date_id);

-- ============================================================================
-- SECTION 5: CREATE TOUR_ACCOMMODATIONS TABLE
-- ============================================================================

-- Track hotel bookings and accommodations
CREATE TABLE IF NOT EXISTS public.tour_accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  tour_date_id UUID REFERENCES public.tour_dates(id) ON DELETE SET NULL,

  -- Hotel details
  hotel_name TEXT NOT NULL,
  hotel_address TEXT,
  hotel_phone TEXT,
  hotel_email TEXT,
  hotel_website TEXT,

  -- Location
  location_id UUID REFERENCES public.locations(id),
  latitude NUMERIC,
  longitude NUMERIC,

  -- Booking details
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  confirmation_number TEXT,

  -- Room allocation
  rooms_booked INTEGER DEFAULT 0,
  room_type TEXT,
  room_allocation JSONB DEFAULT '[]'::jsonb, -- assign rooms to crew members

  -- Services
  breakfast_included BOOLEAN DEFAULT false,
  parking_available BOOLEAN DEFAULT false,
  wifi_available BOOLEAN DEFAULT true,

  -- Costs
  rate_per_room_eur NUMERIC,
  total_cost_eur NUMERIC,

  -- Notes
  notes TEXT,
  special_requests TEXT,

  -- Status
  status TEXT DEFAULT 'tentative', -- 'tentative', 'confirmed', 'checked_in', 'checked_out', 'cancelled'

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),

  -- Constraints
  CONSTRAINT check_dates CHECK (check_out_date >= check_in_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tour_accommodations_tour_id ON public.tour_accommodations(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_accommodations_date ON public.tour_accommodations(tour_date_id);
CREATE INDEX IF NOT EXISTS idx_tour_accommodations_check_in ON public.tour_accommodations(check_in_date);

-- ============================================================================
-- SECTION 6: CREATE TOUR_SCHEDULE_TEMPLATES TABLE
-- ============================================================================

-- Reusable schedule templates for different show types
CREATE TABLE IF NOT EXISTS public.tour_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE,

  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'festival', 'theater', 'arena', 'club', 'outdoor'

  -- Template data
  default_schedule JSONB NOT NULL, -- ProgramDay[] structure
  default_crew_calls JSONB DEFAULT '[]'::jsonb,
  default_timing JSONB DEFAULT '{}'::jsonb,

  -- Sharing
  is_global BOOLEAN DEFAULT false, -- can be used across tours
  created_by UUID REFERENCES public.profiles(id),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tour_schedule_templates_tour_id ON public.tour_schedule_templates(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_schedule_templates_type ON public.tour_schedule_templates(template_type);

-- ============================================================================
-- SECTION 7: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.tour_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_travel_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_schedule_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 8: CREATE RLS POLICIES
-- ============================================================================

-- tour_timeline_events policies
DROP POLICY IF EXISTS tour_timeline_events_select ON public.tour_timeline_events;
CREATE POLICY tour_timeline_events_select
  ON public.tour_timeline_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_assignments
      WHERE tour_assignments.tour_id = tour_timeline_events.tour_id
      AND tour_assignments.technician_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS tour_timeline_events_management ON public.tour_timeline_events;
CREATE POLICY tour_timeline_events_management
  ON public.tour_timeline_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- tour_travel_segments policies
DROP POLICY IF EXISTS tour_travel_segments_select ON public.tour_travel_segments;
CREATE POLICY tour_travel_segments_select
  ON public.tour_travel_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_assignments
      WHERE tour_assignments.tour_id = tour_travel_segments.tour_id
      AND tour_assignments.technician_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS tour_travel_segments_management ON public.tour_travel_segments;
CREATE POLICY tour_travel_segments_management
  ON public.tour_travel_segments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- tour_accommodations policies
DROP POLICY IF EXISTS tour_accommodations_select ON public.tour_accommodations;
CREATE POLICY tour_accommodations_select
  ON public.tour_accommodations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_assignments
      WHERE tour_assignments.tour_id = tour_accommodations.tour_id
      AND tour_assignments.technician_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS tour_accommodations_management ON public.tour_accommodations;
CREATE POLICY tour_accommodations_management
  ON public.tour_accommodations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- tour_schedule_templates policies
DROP POLICY IF EXISTS tour_schedule_templates_select ON public.tour_schedule_templates;
CREATE POLICY tour_schedule_templates_select
  ON public.tour_schedule_templates FOR SELECT
  USING (
    is_global = true
    OR tour_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tour_assignments
      WHERE tour_assignments.tour_id = tour_schedule_templates.tour_id
      AND tour_assignments.technician_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS tour_schedule_templates_management ON public.tour_schedule_templates;
CREATE POLICY tour_schedule_templates_management
  ON public.tour_schedule_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- ============================================================================
-- SECTION 9: GRANTS
-- ============================================================================

GRANT SELECT ON public.tour_timeline_events TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.tour_timeline_events TO service_role;

GRANT SELECT ON public.tour_travel_segments TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.tour_travel_segments TO service_role;

GRANT SELECT ON public.tour_accommodations TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.tour_accommodations TO service_role;

GRANT SELECT ON public.tour_schedule_templates TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.tour_schedule_templates TO service_role;

-- ============================================================================
-- SECTION 10: CREATE TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Apply to all new tables
DROP TRIGGER IF EXISTS update_tour_timeline_events_updated_at ON public.tour_timeline_events;
CREATE TRIGGER update_tour_timeline_events_updated_at
  BEFORE UPDATE ON public.tour_timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tour_travel_segments_updated_at ON public.tour_travel_segments;
CREATE TRIGGER update_tour_travel_segments_updated_at
  BEFORE UPDATE ON public.tour_travel_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tour_accommodations_updated_at ON public.tour_accommodations;
CREATE TRIGGER update_tour_accommodations_updated_at
  BEFORE UPDATE ON public.tour_accommodations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tour_schedule_templates_updated_at ON public.tour_schedule_templates;
CREATE TRIGGER update_tour_schedule_templates_updated_at
  BEFORE UPDATE ON public.tour_schedule_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 11: HELPER FUNCTIONS
-- ============================================================================

-- Function to get complete tour timeline (shows + events)
CREATE OR REPLACE FUNCTION public.get_tour_complete_timeline(p_tour_id UUID)
RETURNS TABLE (
  event_date DATE,
  event_type TEXT,
  event_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  -- Tour dates (shows)
  SELECT
    td.date as event_date,
    'show'::TEXT as event_type,
    jsonb_build_object(
      'tour_date_id', td.id,
      'location', loc.name,
      'job_id', j.id,
      'venue_name', loc.name
    ) as event_data
  FROM public.tour_dates td
  LEFT JOIN public.locations loc ON loc.id = td.location_id
  LEFT JOIN public.jobs j ON j.tour_date_id = td.id
  WHERE td.tour_id = p_tour_id

  UNION ALL

  -- Additional timeline events
  SELECT
    tte.date as event_date,
    tte.event_type,
    jsonb_build_object(
      'id', tte.id,
      'title', tte.title,
      'description', tte.description,
      'start_time', tte.start_time,
      'end_time', tte.end_time,
      'all_day', tte.all_day,
      'location_details', tte.location_details,
      'metadata', tte.metadata
    ) as event_data
  FROM public.tour_timeline_events tte
  WHERE tte.tour_id = p_tour_id

  ORDER BY event_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tour_complete_timeline(UUID) TO authenticated, service_role;

-- Function to get tour schedule for a specific date
CREATE OR REPLACE FUNCTION public.get_tour_date_complete_info(p_tour_date_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tour_date', (SELECT row_to_json(td.*) FROM public.tour_dates td WHERE td.id = p_tour_date_id),
    'hoja_de_ruta', (SELECT row_to_json(hdr.*) FROM public.hoja_de_ruta hdr WHERE hdr.tour_date_id = p_tour_date_id),
    'accommodation', (SELECT row_to_json(ta.*) FROM public.tour_accommodations ta WHERE ta.tour_date_id = p_tour_date_id LIMIT 1),
    'travel_from', (
      SELECT jsonb_agg(row_to_json(tts.*))
      FROM public.tour_travel_segments tts
      WHERE tts.from_tour_date_id = p_tour_date_id
    ),
    'travel_to', (
      SELECT jsonb_agg(row_to_json(tts.*))
      FROM public.tour_travel_segments tts
      WHERE tts.to_tour_date_id = p_tour_date_id
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tour_date_complete_info(UUID) TO authenticated, service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
