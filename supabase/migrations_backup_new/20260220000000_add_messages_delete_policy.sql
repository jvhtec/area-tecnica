-- Ensure messages delete policy exists so senders and management can remove
-- their department messages. This migration is idempotent.

do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'messages'
  ) then
    raise notice 'Table public.messages not found; skipping messages delete policy';
  else
    -- Enable RLS to ensure policy can be evaluated
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'messages' and c.relrowsecurity = true
    ) then
      execute 'alter table public.messages enable row level security';
    end if;

    -- Mirror the select policy so senders or management can delete
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'messages'
        and policyname = 'messages_delete_self_or_mgmt'
    ) then
      create policy messages_delete_self_or_mgmt on public.messages
        for delete
        using (
          messages.sender_id = auth.uid() or
          exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin', 'management')
              and p.department = messages.department
          )
        );
    end if;
  end if;
end
$$;
