-- Create venues table
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  google_place_id TEXT UNIQUE,
  city TEXT NOT NULL,
  state_region TEXT,
  country TEXT NOT NULL,
  full_address TEXT,
  coordinates JSONB,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create soundvision_files table
CREATE TABLE IF NOT EXISTS public.soundvision_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soundvision_files ENABLE ROW LEVEL SECURITY;

-- Venues RLS Policies
CREATE POLICY "venues_select_authenticated"
  ON public.venues FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "venues_insert_authorized"
  ON public.venues FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management', 'house_tech', 'technician', 'logistics')
    )
  );

CREATE POLICY "venues_update_authorized"
  ON public.venues FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management', 'house_tech', 'technician', 'logistics')
    )
  );

CREATE POLICY "venues_delete_management"
  ON public.venues FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- SoundVision Files RLS Policies
CREATE POLICY "soundvision_files_select_authenticated"
  ON public.soundvision_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "soundvision_files_insert_authorized"
  ON public.soundvision_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management', 'house_tech', 'technician', 'logistics')
    )
  );

CREATE POLICY "soundvision_files_update_owner_or_management"
  ON public.soundvision_files FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

CREATE POLICY "soundvision_files_delete_management"
  ON public.soundvision_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Create indexes for performance
CREATE INDEX idx_venues_name ON public.venues USING gin(to_tsvector('english', name));
CREATE INDEX idx_venues_city ON public.venues(city);
CREATE INDEX idx_venues_country ON public.venues(country);
CREATE INDEX idx_venues_google_place_id ON public.venues(google_place_id);
CREATE INDEX idx_soundvision_files_venue_id ON public.soundvision_files(venue_id);
CREATE INDEX idx_soundvision_files_uploaded_at ON public.soundvision_files(uploaded_at DESC);
CREATE INDEX idx_soundvision_files_uploaded_by ON public.soundvision_files(uploaded_by);

-- Create upsert_venue function
CREATE OR REPLACE FUNCTION public.upsert_venue(
  p_name TEXT,
  p_google_place_id TEXT,
  p_city TEXT,
  p_state_region TEXT,
  p_country TEXT,
  p_full_address TEXT DEFAULT NULL,
  p_coordinates JSONB DEFAULT NULL,
  p_capacity INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id UUID;
BEGIN
  -- Try to find existing venue by google_place_id
  IF p_google_place_id IS NOT NULL THEN
    SELECT id INTO v_venue_id
    FROM venues
    WHERE google_place_id = p_google_place_id;
  END IF;

  -- If found, update it
  IF v_venue_id IS NOT NULL THEN
    UPDATE venues
    SET
      name = p_name,
      city = p_city,
      state_region = p_state_region,
      country = p_country,
      full_address = COALESCE(p_full_address, full_address),
      coordinates = COALESCE(p_coordinates, coordinates),
      capacity = COALESCE(p_capacity, capacity),
      updated_at = now()
    WHERE id = v_venue_id;
  ELSE
    -- Otherwise, insert new venue
    INSERT INTO venues (
      name,
      google_place_id,
      city,
      state_region,
      country,
      full_address,
      coordinates,
      capacity
    ) VALUES (
      p_name,
      p_google_place_id,
      p_city,
      p_state_region,
      p_country,
      p_full_address,
      p_coordinates,
      p_capacity
    )
    RETURNING id INTO v_venue_id;
  END IF;

  RETURN v_venue_id;
END;
$$;

-- Create trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_venues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trigger_update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_venues_updated_at();

-- Create storage bucket for soundvision files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'soundvision-files',
  'soundvision-files',
  false,
  104857600, -- 100MB
  ARRAY['application/octet-stream', 'application/zip', 'application/pdf', 'application/x-zip-compressed']
)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket RLS policies
CREATE POLICY "soundvision_storage_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'soundvision-files');

CREATE POLICY "soundvision_storage_insert_authorized"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'soundvision-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management', 'house_tech', 'technician', 'logistics')
    )
  );

CREATE POLICY "soundvision_storage_delete_management"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'soundvision-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );