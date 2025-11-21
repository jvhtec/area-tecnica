-- Ensure legacy technician_availability participates in realtime publication (idempotent)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where pr.prpubid = (select oid from pg_publication where pubname='supabase_realtime')
        and c.relname = 'technician_availability'
        and n.nspname = 'public'
    ) then
      execute 'alter publication supabase_realtime add table public.technician_availability';
    end if;
  end if;
end $$;
