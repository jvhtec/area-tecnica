-- rate_extras_2025 reads are management-only, as 20260904162000 intended.
--
-- That migration added rate_extras_2025_select_management but left the older
-- p_rate_extras_2025_public_select_0e3de6 (USING auth.uid() IS NOT NULL) in
-- place. Permissive policies are OR-ed, so every signed-in user, drivers and
-- the wallboard account included, could still read the whole extras catalog.
--
-- The only non-management reader was the technician's own view of their job
-- extras (JobExtrasEditor), which now takes its unit prices from the payout
-- view's extras breakdown (extras_total_for_job_tech, SECURITY DEFINER), the
-- same figures their payout is computed from.

drop policy if exists "p_rate_extras_2025_public_select_0e3de6" on public.rate_extras_2025;
