-- Ensure authenticated and anon can select rider data (RLS still applies)
GRANT SELECT ON public.festival_artist_files TO authenticated, anon, service_role;
GRANT SELECT ON public.festival_artists TO authenticated, anon, service_role;

-- Also grant usage/select on sequences if any are involved (defensive)
-- No sequence grants needed as id uses gen_random_uuid()

