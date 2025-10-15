-- Fix: Remove public access to tour pricing structure
-- Security Issue: rate_cards_tour_2025_public_exposure

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rate_cards_tour_2025;

-- Create a new policy that restricts access to authenticated management users only
CREATE POLICY "Management and authenticated users can view tour rate cards"
ON public.rate_cards_tour_2025
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'management', 'house_tech', 'technician')
  )
);

-- Note: The existing "Management can manage tour rate cards" policy already handles INSERT/UPDATE/DELETE for admin/management roles