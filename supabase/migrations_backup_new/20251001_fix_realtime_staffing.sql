-- Ensure realtime publication and replica identity for staffing tables (idempotent)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- staffing_requests
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where pr.prpubid = (select oid from pg_publication where pubname='supabase_realtime')
        and c.relname = 'staffing_requests'
        and n.nspname = 'public'
    ) then
      execute 'alter publication supabase_realtime add table public.staffing_requests';
    end if;

    -- staffing_events
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where pr.prpubid = (select oid from pg_publication where pubname='supabase_realtime')
        and c.relname = 'staffing_events'
        and n.nspname = 'public'
    ) then
      execute 'alter publication supabase_realtime add table public.staffing_events';
    end if;

    -- activity_log
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where pr.prpubid = (select oid from pg_publication where pubname='supabase_realtime')
        and c.relname = 'activity_log'
        and n.nspname = 'public'
    ) then
      execute 'alter publication supabase_realtime add table public.activity_log';
    end if;
  end if;
end $$;

-- Ensure REPLICA IDENTITY FULL (so old/new records are included in WAL)
alter table if exists public.staffing_requests replica identity full;
alter table if exists public.staffing_events replica identity full;
alter table if exists public.activity_log replica identity full;
