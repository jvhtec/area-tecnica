-- Enable http extension for making HTTP requests from triggers
create extension if not exists http with schema extensions;

-- Function to notify about new direct messages via push
create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  message_preview text;
  push_url text;
  service_role_key text;
begin
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

  -- Construct push function URL
  push_url := 'https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/push';
  
  -- Get service role key from vault if available, otherwise skip
  -- In production, this would use the service role key
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Call push function asynchronously (fire and forget)
  perform extensions.http((
    'POST',
    push_url,
    array[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || coalesce(service_role_key, ''))
    ],
    'application/json',
    json_build_object(
      'action', 'broadcast',
      'type', 'message.received',
      'recipient_id', new.recipient_id,
      'actor_id', new.sender_id,
      'actor_name', sender_name,
      'url', '/messages',
      'message_preview', message_preview,
      'message_id', new.id
    )::text
  )::extensions.http_request);

  return new;
exception
  when others then
    -- Log error but don't block the insert
    raise warning 'Failed to send push notification for message %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- Create trigger to fire on new direct messages
drop trigger if exists tr_notify_direct_message on direct_messages;
create trigger tr_notify_direct_message
after insert on direct_messages
for each row
execute function notify_direct_message();