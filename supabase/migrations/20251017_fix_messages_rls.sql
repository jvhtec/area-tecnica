-- Ensure sensible RLS policies for messages and direct_messages so that
-- management can mark department messages as read and recipients can mark
-- direct messages as read. This migration is idempotent.

-- Enable RLS if not already enabled
do $$ begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'messages'
  ) then
    raise notice 'Table public.messages not found; skipping messages policies';
  else
    perform 1 from pg_tables where schemaname = 'public' and tablename = 'messages';
    -- Enable RLS
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'messages' and c.relrowsecurity = true
    ) then
      execute 'alter table public.messages enable row level security';
    end if;

    -- Allow management/admin to update status for messages of their department
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_update_status_mgmt'
    ) then
      create policy messages_update_status_mgmt on public.messages
        for update
        using (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','management') and p.department = messages.department
          )
        )
        with check (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','management') and p.department = messages.department
          )
        );
    end if;

    -- Allow sender to select own messages (technician view)
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_select_self_or_mgmt'
    ) then
      create policy messages_select_self_or_mgmt on public.messages
        for select
        using (
          messages.sender_id = auth.uid() or
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','management') and p.department = messages.department
          )
        );
    end if;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'direct_messages'
  ) then
    raise notice 'Table public.direct_messages not found; skipping direct_messages policies';
  else
    -- Enable RLS
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'direct_messages' and c.relrowsecurity = true
    ) then
      execute 'alter table public.direct_messages enable row level security';
    end if;

    -- Allow sender or recipient to select
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='direct_messages' and policyname='dm_select_self'
    ) then
      create policy dm_select_self on public.direct_messages
        for select
        using (
          auth.uid() in (direct_messages.sender_id, direct_messages.recipient_id)
        );
    end if;

    -- Allow recipient to mark as read
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='direct_messages' and policyname='dm_update_status_recipient'
    ) then
      create policy dm_update_status_recipient on public.direct_messages
        for update
        using (
          auth.uid() = direct_messages.recipient_id
        )
        with check (
          auth.uid() = direct_messages.recipient_id
        );
    end if;

    -- Allow sender or recipient to insert and delete their own messages
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='direct_messages' and policyname='dm_insert_authenticated'
    ) then
      create policy dm_insert_authenticated on public.direct_messages
        for insert
        with check (
          auth.uid() in (direct_messages.sender_id, direct_messages.recipient_id)
        );
    end if;

    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename='direct_messages' and policyname='dm_delete_self'
    ) then
      create policy dm_delete_self on public.direct_messages
        for delete
        using (
          auth.uid() in (direct_messages.sender_id, direct_messages.recipient_id)
        );
    end if;
  end if;
end $$;

