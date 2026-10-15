-- Scheduler housekeeping.
--
-- 1. cron.job_run_details and push_cron_execution_log are never pruned:
--    557k and 312k rows (108 MB + 32 MB) after a year of per-minute jobs.
--    Keep 7 / 14 days, pruned nightly.
--
-- 2. festival.feed.tick fires every minute and costs a pg_net request plus an
--    edge function invocation, which then returns "No users subscribed"
--    whenever no enabled subscription has stages (handleFestivalFeedTick).
--    Apply that same check here before calling out. Other event types are
--    unchanged.

create or replace function public.invoke_scheduled_push_notification(event_type text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cfg push_cron_config%rowtype;
  request_id bigint;
  log_id bigint;
begin
  -- Mirrors the edge function's own early exit (enabled rows with stages).
  if event_type = 'festival.feed.tick' and not exists (
    select 1
    from public.festival_push_subscriptions s
    where s.enabled = true
      and coalesce(cardinality(s.stages), 0) > 0
  ) then
    return;
  end if;

  -- Get config
  select * into cfg from push_cron_config where id = 1;

  if cfg.supabase_url is null or cfg.service_role_key is null then
    insert into push_cron_execution_log (event_type, success, error_message)
    values (event_type, false, 'Push cron config not set up')
    returning id into log_id;

    raise warning 'Push cron config not set up (log_id=%)', log_id;
    return;
  end if;

  begin
    select net.http_post(
      url := cfg.supabase_url || '/functions/v1/push',
      body := jsonb_build_object(
        'action', 'check_scheduled',
        'type', event_type
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.service_role_key
      )
    ) into request_id;

    insert into push_cron_execution_log (event_type, request_id, success)
    values (event_type, request_id, true)
    returning id into log_id;

    raise log 'Scheduled push request created: event_type=%, request_id=%, log_id=%',
      event_type, request_id, log_id;

  exception when others then
    insert into push_cron_execution_log (event_type, success, error_message)
    values (event_type, false, sqlerrm)
    returning id into log_id;

    raise warning 'Failed to invoke scheduled push for % (log_id=%): %',
      event_type, log_id, sqlerrm;
  end;
end;
$function$;

create or replace function public.purge_scheduler_history()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.push_cron_execution_log
  where executed_at < now() - interval '14 days';

  if to_regclass('cron.job_run_details') is not null then
    delete from cron.job_run_details
    where end_time < now() - interval '7 days';
  end if;
end;
$function$;

revoke all on function public.purge_scheduler_history() from public, anon, authenticated;
grant execute on function public.purge_scheduler_history() to service_role;

do $cron$
begin
  if to_regnamespace('cron') is null then
    raise warning 'cron schema not available; scheduler history purge was not scheduled';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'purge-scheduler-history') then
    perform cron.unschedule('purge-scheduler-history');
  end if;

  perform cron.schedule(
    'purge-scheduler-history',
    '41 3 * * *',
    $$select public.purge_scheduler_history()$$
  );
end $cron$;
