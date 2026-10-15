-- Invoicing-company change notifications were never sent.
--
-- notify_invoicing_company_changed() read app.settings.supabase_url and
-- app.settings.service_role_key, which are not set on this project, so every
-- change only raised a WARNING and returned. Read the same push_cron_config
-- row invoke_scheduled_push_notification() uses for its push calls. The rest
-- of the function is unchanged.

create or replace function public.notify_invoicing_company_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cfg push_cron_config%rowtype;
  v_actor_id uuid;
  v_actor_name text;
  v_payload jsonb;
begin
  -- Only proceed if invoicing_company actually changed
  if not (old.invoicing_company is distinct from new.invoicing_company) then
    return new;
  end if;

  select * into cfg from push_cron_config where id = 1;

  -- Validate configuration
  if cfg.supabase_url is null or cfg.service_role_key is null then
    raise warning 'Invoicing company notification trigger requires push_cron_config to be set up';
    return new;
  end if;

  -- Get current user (who made the change)
  v_actor_id := auth.uid();

  -- Get actor's display name
  if v_actor_id is not null then
    select coalesce(
      nullif(trim(concat(first_name, ' ', last_name)), ''),
      nickname,
      email,
      'Usuario'
    ) into v_actor_name
    from profiles
    where id = v_actor_id;
  else
    v_actor_name := 'Sistema';
  end if;

  -- Build payload for push notification
  v_payload := jsonb_build_object(
    'action', 'broadcast',
    'type', 'job.invoicing_company.changed',
    'job_id', new.id,
    'title', new.title,
    'actor_id', v_actor_id,
    'actor_name', v_actor_name,
    'changes', jsonb_build_object(
      'invoicing_company', jsonb_build_object(
        'from', old.invoicing_company,
        'to', new.invoicing_company
      )
    )
  );

  -- Call push notification edge function asynchronously (non-blocking)
  begin
    perform net.http_post(
      url := cfg.supabase_url || '/functions/v1/push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.service_role_key
      ),
      body := v_payload
    );
  exception
    when undefined_function then
      -- pg_net extension not installed
      raise warning 'pg_net extension not available. Notification not sent for job %: %',
        new.id, v_payload::text;
    when sqlstate '58000' then
      -- System error (network issues, etc.)
      raise warning 'Failed to send invoicing company notification for job % due to system error: %. Payload: %',
        new.id, sqlerrm, v_payload::text;
    when others then
      -- Unexpected error - log but don't fail the transaction
      raise warning 'Unexpected error sending invoicing company notification for job %: %. Payload: %',
        new.id, sqlerrm, v_payload::text;
  end;

  return new;
end;
$function$;
