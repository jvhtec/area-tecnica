-- Secure tours and tour_dates tables
DROP POLICY IF EXISTS "Anyone can view tours" ON public.tours;
DROP POLICY IF EXISTS "Anyone can view tour dates" ON public.tour_dates;

-- Restrict to authenticated users only
CREATE POLICY "Authenticated users can view tours" 
ON public.tours 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view tour dates" 
ON public.tour_dates 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Management can still manage tours
CREATE POLICY "Management can manage tours" 
ON public.tours 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Management can manage tour dates" 
ON public.tour_dates 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));