-- Create table for restaurant data in hoja de ruta
CREATE TABLE public.hoja_de_ruta_restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hoja_de_ruta_id UUID NOT NULL REFERENCES public.hoja_de_ruta(id) ON DELETE CASCADE,
  google_place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  rating DECIMAL(3,2),
  price_level INTEGER CHECK (price_level BETWEEN 1 AND 4),
  cuisine TEXT[],
  phone TEXT,
  website TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  distance INTEGER, -- distance in meters
  photos TEXT[], -- array of photo URLs
  is_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of hoja_de_ruta_id and google_place_id
  UNIQUE(hoja_de_ruta_id, google_place_id)
);

-- Enable Row Level Security
ALTER TABLE public.hoja_de_ruta_restaurants ENABLE ROW LEVEL SECURITY;

-- Create policies for restaurant access (same as parent hoja_de_ruta)
CREATE POLICY "Users can view restaurants for accessible hoja de ruta" 
ON public.hoja_de_ruta_restaurants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.hoja_de_ruta hdr
    WHERE hdr.id = hoja_de_ruta_restaurants.hoja_de_ruta_id
    AND (
      hdr.created_by = auth.uid()
      OR auth.uid() IN (
        SELECT ja.technician_id 
        FROM public.job_assignments ja 
        WHERE ja.job_id = hdr.job_id
      )
    )
  )
);

CREATE POLICY "Users can create restaurants for their hoja de ruta" 
ON public.hoja_de_ruta_restaurants 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hoja_de_ruta hdr
    WHERE hdr.id = hoja_de_ruta_restaurants.hoja_de_ruta_id
    AND (
      hdr.created_by = auth.uid()
      OR auth.uid() IN (
        SELECT ja.technician_id 
        FROM public.job_assignments ja 
        WHERE ja.job_id = hdr.job_id
      )
    )
  )
);

CREATE POLICY "Users can update restaurants for their hoja de ruta" 
ON public.hoja_de_ruta_restaurants 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.hoja_de_ruta hdr
    WHERE hdr.id = hoja_de_ruta_restaurants.hoja_de_ruta_id
    AND (
      hdr.created_by = auth.uid()
      OR auth.uid() IN (
        SELECT ja.technician_id 
        FROM public.job_assignments ja 
        WHERE ja.job_id = hdr.job_id
      )
    )
  )
);

CREATE POLICY "Users can delete restaurants for their hoja de ruta" 
ON public.hoja_de_ruta_restaurants 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.hoja_de_ruta hdr
    WHERE hdr.id = hoja_de_ruta_restaurants.hoja_de_ruta_id
    AND (
      hdr.created_by = auth.uid()
      OR auth.uid() IN (
        SELECT ja.technician_id 
        FROM public.job_assignments ja 
        WHERE ja.job_id = hdr.job_id
      )
    )
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hoja_de_ruta_restaurants_updated_at
  BEFORE UPDATE ON public.hoja_de_ruta_restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_hoja_de_ruta_restaurants_hoja_id ON public.hoja_de_ruta_restaurants(hoja_de_ruta_id);
CREATE INDEX idx_hoja_de_ruta_restaurants_place_id ON public.hoja_de_ruta_restaurants(google_place_id);
CREATE INDEX idx_hoja_de_ruta_restaurants_selected ON public.hoja_de_ruta_restaurants(is_selected) WHERE is_selected = true;