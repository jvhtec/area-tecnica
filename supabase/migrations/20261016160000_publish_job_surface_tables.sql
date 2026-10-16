-- Publish the tables job cards and the assignment matrix read but never
-- received realtime changes for: the app already subscribes to job_date_types,
-- tour_dates and tour_default_sets (useOptimizedJobs) and now to
-- tour_documents and festival_artist_files (job cards), but without
-- publication no events ever arrive.
--
-- All five have RLS with SELECT policies, so realtime only delivers rows a
-- subscriber may read, and all are low-churn (tens of writes in total).

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'job_date_types', 'tour_dates', 'tour_default_sets', 'tour_documents', 'festival_artist_files'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
