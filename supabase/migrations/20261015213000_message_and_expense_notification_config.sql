-- Two more notification triggers read app.settings.*, which is not set on this
-- project (see 20261015211000 for the invoicing-company one):
--
-- * notify_expense_status_change() returned early with a WARNING, so the
--   expense status e-mail (send-expense-notification) was never sent.
-- * notify_direct_message() went ahead with an empty bearer token through the
--   synchronous `http` extension: every direct message waited on a POST that
--   the gateway rejected with 401, and the push was never delivered.
--
-- Both now read push_cron_config, as invoke_scheduled_push_notification()
-- does, and call out through pg_net so the insert never waits on the network.
-- Payloads and the conditions for notifying are unchanged.

create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cfg push_cron_config%rowtype;
  sender_name text;
  message_preview text;
begin
  select * into cfg from push_cron_config where id = 1;

  if cfg.supabase_url is null or cfg.service_role_key is null then
    raise warning 'Direct message notification requires push_cron_config to be set up (message %)', new.id;
    return new;
  end if;

  -- Get sender's display name
  select coalesce(
    nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
    email,
    'Usuario'
  ) into sender_name
  from profiles
  where id = new.sender_id;

  -- Truncate message for preview
  message_preview := substring(new.content from 1 for 100);
  if length(new.content) > 100 then
    message_preview := message_preview || '...';
  end if;

  perform net.http_post(
    url := cfg.supabase_url || '/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.service_role_key
    ),
    body := jsonb_build_object(
      'action', 'broadcast',
      'type', 'message.received',
      'recipient_id', new.recipient_id,
      'actor_id', new.sender_id,
      'actor_name', sender_name,
      'url', '/messages',
      'message_preview', message_preview,
      'message_id', new.id
    )
  );

  return new;
exception
  when others then
    -- Log error but don't block the insert
    raise warning 'Failed to send push notification for message %: %', new.id, sqlerrm;
    return new;
end;
$function$;

create or replace function public.notify_expense_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cfg push_cron_config%rowtype;
  v_job_title text;
  v_technician_email text;
  v_technician_name text;
  v_category_label text;
  v_payload jsonb;
  v_should_notify boolean := false;
begin
  -- Only notify on status changes to submitted, approved, or rejected
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_should_notify := new.status in ('submitted', 'approved', 'rejected');
  elsif tg_op = 'INSERT' and new.status in ('submitted', 'approved', 'rejected') then
    v_should_notify := true;
  end if;

  if not v_should_notify then
    return new;
  end if;

  select * into cfg from push_cron_config where id = 1;

  -- Validate configuration - warn but don't block if missing
  if cfg.supabase_url is null or cfg.service_role_key is null then
    raise warning 'Expense notification trigger: push_cron_config not set up - notification skipped for expense %', new.id;
    return new;
  end if;

  -- Fetch related data
  select j.title into v_job_title
  from jobs j
  where j.id = new.job_id;

  select
    p.email,
    coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), p.nickname, p.email)
  into v_technician_email, v_technician_name
  from profiles p
  where p.id = new.technician_id;

  select label_es into v_category_label
  from expense_categories
  where slug = new.category_slug;

  -- Skip if critical data is missing
  if v_technician_email is null or v_job_title is null then
    raise warning 'Cannot send expense notification: missing email or job title for expense %', new.id;
    return new;
  end if;

  -- Build payload for edge function
  v_payload := jsonb_build_object(
    'expense_id', new.id,
    'job_id', new.job_id,
    'job_title', v_job_title,
    'technician_email', v_technician_email,
    'technician_name', v_technician_name,
    'category_label', coalesce(v_category_label, new.category_slug),
    'amount_eur', new.amount_eur,
    'expense_date', new.expense_date,
    'status', new.status,
    'rejection_reason', new.rejection_reason
  );

  -- Call edge function asynchronously (non-blocking)
  begin
    perform net.http_post(
      url := cfg.supabase_url || '/functions/v1/send-expense-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.service_role_key
      ),
      body := v_payload
    );
  exception
    when undefined_function then
      -- pg_net extension not installed
      raise warning 'pg_net extension not available. Notification not sent for expense %: %',
        new.id, v_payload::text;
    when sqlstate '58000' then
      -- System error (network issues, etc.)
      raise warning 'Failed to send expense notification for % due to system error: %. Payload: %',
        new.id, sqlerrm, v_payload::text;
    when others then
      -- Unexpected error - log but don't fail the transaction
      raise warning 'Unexpected error sending expense notification for %: %. Payload: %',
        new.id, sqlerrm, v_payload::text;
  end;

  return new;
end;
$function$;
