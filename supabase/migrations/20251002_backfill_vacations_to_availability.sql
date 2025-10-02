-- Backfill availability_schedules from existing approved vacation_requests by nudging updates
do $$
declare
  r record;
begin
  for r in (
    select id from public.vacation_requests where status = 'approved'
  ) loop
    -- This no-op update will fire the AFTER UPDATE trigger to (re)sync rows
    update public.vacation_requests set status = status where id = r.id;
  end loop;
end $$;
