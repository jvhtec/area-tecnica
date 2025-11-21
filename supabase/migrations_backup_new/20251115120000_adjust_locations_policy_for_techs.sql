-- Allow technicians assigned to a job to read its location details
-- in addition to the existing admin/management/wallboard access.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'locations'
      and policyname = 'wb_locations_select'
  ) then
    drop policy wb_locations_select on public.locations;
  end if;

  create policy wb_locations_select on public.locations
    for select to authenticated
    using (
      public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'wallboard'::text])
      or exists (
        select 1
        from public.jobs j
        join public.job_assignments ja on ja.job_id = j.id
        where j.location_id = locations.id
          and ja.technician_id = auth.uid()
          and coalesce(ja.status, 'accepted') <> 'declined'
      )
    );
end;
$$;
