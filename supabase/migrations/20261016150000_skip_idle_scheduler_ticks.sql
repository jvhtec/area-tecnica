-- Skip per-minute scheduler calls that have nothing to do.
--
-- Three pg_cron jobs fire every minute and each one costs a pg_net request, an
-- edge function invocation and log rows, all of which also feed the realtime
-- WAL poller. In production all three were idle:
--
-- * festival.feed.tick: the only enabled subscriptions were for a festival that
--   ended in July; the guard from 20261015204000 only checked that some
--   subscription had stages.
-- * programa.feed.tick: had no guard at all.
-- * staffing-sweeper: called even with no campaign due to tick.
--
-- Each guard mirrors the edge function's own early exit with a wider window
-- (the handlers look at yesterday..tomorrow in Europe/Madrid; the guards use
-- two days either side), so a guard can only skip ticks the handler would have
-- skipped anyway.

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
  v_today date := (now() at time zone 'Europe/Madrid')::date;
begin
  -- Mirrors handleFestivalFeedTick: enabled subscriptions with stages whose
  -- festival has artist (show or soundcheck) or shift dates around today.
  if event_type = 'festival.feed.tick' and not exists (
    select 1
    from public.festival_push_subscriptions s
    where s.enabled = true
      and coalesce(cardinality(s.stages), 0) > 0
      and (
        exists (
          select 1 from public.festival_artists a
          where a.job_id = s.job_id
            and (a.date between v_today - 2 and v_today + 2
              or a.soundcheck_date between v_today - 2 and v_today + 2)
        )
        or exists (
          select 1 from public.festival_shifts f
          where f.job_id = s.job_id
            and f.date between v_today - 2 and v_today + 2
        )
      )
  ) then
    return;
  end if;

  -- Mirrors handleProgramaFeedTick: a non-festival, non-dry-hire job around
  -- today with an approved programa.
  if event_type = 'programa.feed.tick' and not exists (
    select 1
    from public.jobs j
    join public.hoja_de_ruta h on h.job_id = j.id
    where j.job_type not in ('festival', 'dryhire')
      and j.start_time <= now() + interval '2 days'
      and j.end_time >= now() - interval '2 days'
      and h.program_schedule_json is not null
      and h.status in ('approved', 'final')
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

create or replace function public.invoke_staffing_sweeper()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cfg push_cron_config%rowtype;
  request_id bigint;
begin
  -- Mirrors get_campaigns_to_tick(): the sweeper only ticks due campaigns.
  if not exists (
    select 1
    from public.staffing_campaigns sc
    where sc.status = 'active'
      and sc.next_run_at is not null
      and sc.next_run_at <= now()
  ) then
    return;
  end if;

  select * into cfg from push_cron_config where id = 1;

  if cfg.supabase_url is null or cfg.service_role_key is null then
    raise warning '[staffing_sweeper] push_cron_config not configured - skipping.';
    return;
  end if;

  select net.http_post(
    url := cfg.supabase_url || '/functions/v1/staffing-sweeper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.service_role_key,
      'apikey', cfg.service_role_key
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron'),
    timeout_milliseconds := 55000
  ) into request_id;

  raise log '[staffing_sweeper] Invoked edge function, net request_id=%', request_id;
exception when others then
  raise warning '[staffing_sweeper] Failed to invoke edge function: %', sqlerrm;
end;
$function$;
