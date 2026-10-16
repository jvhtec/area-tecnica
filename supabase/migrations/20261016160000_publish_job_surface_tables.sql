-- Publish the tables job cards and the assignment matrix read but never
-- received realtime changes for. The app already subscribed to some of them
-- (job_date_types, tour_dates, tour_default_sets in useOptimizedJobs;
-- profile_skills on the matrix) and now subscribes to the rest from job cards
-- (documents, rider files, transport items, WhatsApp groups, calculator
-- defaults), but without publication no events ever arrive.
--
-- All have RLS with SELECT policies, so realtime only delivers rows a
-- subscriber may read, and all are low-churn (at most a few hundred writes
-- in total).

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'job_date_types', 'tour_dates', 'tour_default_sets', 'tour_default_tables',
    'tour_documents', 'festival_artist_files', 'transport_request_items',
    'job_whatsapp_groups', 'job_whatsapp_group_requests', 'profile_skills'
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
