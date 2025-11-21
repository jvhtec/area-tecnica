-- Allow assigned technicians to view tour approval status
alter table if exists public.tours enable row level security;

-- Permit technicians (or any authenticated user) to select tours they are assigned to
-- either directly through tour_assignments or via job assignments on related jobs.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tours'
      and policyname = 'technicians_view_assigned_tours'
  ) then
    create policy technicians_view_assigned_tours on public.tours
      for select to authenticated
      using (
        exists (
          select 1
          from public.tour_assignments ta
          where ta.tour_id = tours.id
            and ta.technician_id = auth.uid()
        )
        or exists (
          select 1
          from public.job_assignments ja
          join public.jobs j on j.id = ja.job_id
          left join public.tour_dates td on td.id = j.tour_date_id
          where ja.technician_id = auth.uid()
            and (j.tour_id = tours.id or td.tour_id = tours.id)
        )
      );
  end if;
end $$;
