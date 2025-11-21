-- Add venue coordinates to main hoja_de_ruta table
ALTER TABLE public.hoja_de_ruta 
ADD COLUMN venue_latitude DECIMAL(10, 8),
ADD COLUMN venue_longitude DECIMAL(11, 8);

-- Add DNI field to staff table
ALTER TABLE public.hoja_de_ruta_staff 
ADD COLUMN dni TEXT;

-- Create accommodations table for hotels
CREATE TABLE public.hoja_de_ruta_accommodations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hoja_de_ruta_id UUID REFERENCES public.hoja_de_ruta(id) ON DELETE CASCADE,
    hotel_name TEXT NOT NULL,
    address TEXT,
    check_in TEXT,
    check_out TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room assignments table linked to accommodations
CREATE TABLE public.hoja_de_ruta_room_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    accommodation_id UUID REFERENCES public.hoja_de_ruta_accommodations(id) ON DELETE CASCADE,
    room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'twin', 'triple')),
    room_number TEXT,
    staff_member1_id TEXT, -- Store as text since we reference by index
    staff_member2_id TEXT, -- Store as text since we reference by index
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transport table for structured transport data
CREATE TABLE public.hoja_de_ruta_transport (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hoja_de_ruta_id UUID REFERENCES public.hoja_de_ruta(id) ON DELETE CASCADE,
    transport_type TEXT NOT NULL CHECK (transport_type IN ('trailer', '9m', '8m', '6m', '4m', 'furgoneta')),
    driver_name TEXT,
    driver_phone TEXT,
    license_plate TEXT,
    company TEXT CHECK (company IN ('pantoja', 'transluminaria', 'transcamarena', 'wild tour', 'camionaje', 'other')),
    date_time TIMESTAMP WITH TIME ZONE,
    has_return BOOLEAN DEFAULT FALSE,
    return_date_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create travel arrangements table for staff travel
CREATE TABLE public.hoja_de_ruta_travel_arrangements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hoja_de_ruta_id UUID REFERENCES public.hoja_de_ruta(id) ON DELETE CASCADE,
    transportation_type TEXT NOT NULL CHECK (transportation_type IN ('van', 'sleeper_bus', 'train', 'plane', 'RV')),
    pickup_address TEXT,
    pickup_time TEXT,
    flight_train_number TEXT,
    departure_time TEXT,
    arrival_time TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    plate_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.hoja_de_ruta_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoja_de_ruta_room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoja_de_ruta_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoja_de_ruta_travel_arrangements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for accommodations
CREATE POLICY "Users can view accommodations from their hojas de ruta" 
ON public.hoja_de_ruta_accommodations 
FOR SELECT 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid() OR h.approved_by = auth.uid()
    )
);

CREATE POLICY "Users can create accommodations for their hojas de ruta" 
ON public.hoja_de_ruta_accommodations 
FOR INSERT 
WITH CHECK (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can update accommodations for their hojas de ruta" 
ON public.hoja_de_ruta_accommodations 
FOR UPDATE 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can delete accommodations for their hojas de ruta" 
ON public.hoja_de_ruta_accommodations 
FOR DELETE 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

-- Create RLS policies for room assignments  
CREATE POLICY "Users can view room assignments from their accommodations" 
ON public.hoja_de_ruta_room_assignments 
FOR SELECT 
USING (
    accommodation_id IN (
        SELECT a.id FROM public.hoja_de_ruta_accommodations a
        JOIN public.hoja_de_ruta h ON a.hoja_de_ruta_id = h.id
        WHERE h.created_by = auth.uid() OR h.approved_by = auth.uid()
    )
);

CREATE POLICY "Users can create room assignments for their accommodations" 
ON public.hoja_de_ruta_room_assignments 
FOR INSERT 
WITH CHECK (
    accommodation_id IN (
        SELECT a.id FROM public.hoja_de_ruta_accommodations a
        JOIN public.hoja_de_ruta h ON a.hoja_de_ruta_id = h.id
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can update room assignments for their accommodations" 
ON public.hoja_de_ruta_room_assignments 
FOR UPDATE 
USING (
    accommodation_id IN (
        SELECT a.id FROM public.hoja_de_ruta_accommodations a
        JOIN public.hoja_de_ruta h ON a.hoja_de_ruta_id = h.id
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can delete room assignments for their accommodations" 
ON public.hoja_de_ruta_room_assignments 
FOR DELETE 
USING (
    accommodation_id IN (
        SELECT a.id FROM public.hoja_de_ruta_accommodations a
        JOIN public.hoja_de_ruta h ON a.hoja_de_ruta_id = h.id
        WHERE h.created_by = auth.uid()
    )
);

-- Create RLS policies for transport
CREATE POLICY "Users can view transport from their hojas de ruta" 
ON public.hoja_de_ruta_transport 
FOR SELECT 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid() OR h.approved_by = auth.uid()
    )
);

CREATE POLICY "Users can create transport for their hojas de ruta" 
ON public.hoja_de_ruta_transport 
FOR INSERT 
WITH CHECK (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can update transport for their hojas de ruta" 
ON public.hoja_de_ruta_transport 
FOR UPDATE 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can delete transport for their hojas de ruta" 
ON public.hoja_de_ruta_transport 
FOR DELETE 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

-- Create RLS policies for travel arrangements
CREATE POLICY "Users can view travel arrangements from their hojas de ruta" 
ON public.hoja_de_ruta_travel_arrangements 
FOR SELECT 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid() OR h.approved_by = auth.uid()
    )
);

CREATE POLICY "Users can create travel arrangements for their hojas de ruta" 
ON public.hoja_de_ruta_travel_arrangements 
FOR INSERT 
WITH CHECK (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can update travel arrangements for their hojas de ruta" 
ON public.hoja_de_ruta_travel_arrangements 
FOR UPDATE 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

CREATE POLICY "Users can delete travel arrangements for their hojas de ruta" 
ON public.hoja_de_ruta_travel_arrangements 
FOR DELETE 
USING (
    hoja_de_ruta_id IN (
        SELECT h.id FROM public.hoja_de_ruta h 
        WHERE h.created_by = auth.uid()
    )
);

-- Add triggers for updated_at columns
CREATE TRIGGER update_hoja_de_ruta_accommodations_updated_at
    BEFORE UPDATE ON public.hoja_de_ruta_accommodations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hoja_de_ruta_room_assignments_updated_at
    BEFORE UPDATE ON public.hoja_de_ruta_room_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hoja_de_ruta_transport_updated_at
    BEFORE UPDATE ON public.hoja_de_ruta_transport
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hoja_de_ruta_travel_arrangements_updated_at
    BEFORE UPDATE ON public.hoja_de_ruta_travel_arrangements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();