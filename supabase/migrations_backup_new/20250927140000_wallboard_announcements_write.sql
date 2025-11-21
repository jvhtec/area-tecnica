-- Allow admin and management to manage announcements (insert/update/delete)

alter table if exists public.announcements enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='announcements' and policyname='wb_ann_insert'
  ) then
    create policy wb_ann_insert on public.announcements
    for insert to authenticated
    with check (public.get_current_user_role() = any (array['admin'::text,'management'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='announcements' and policyname='wb_ann_update'
  ) then
    create policy wb_ann_update on public.announcements
    for update to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text]))
    with check (public.get_current_user_role() = any (array['admin'::text,'management'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='announcements' and policyname='wb_ann_delete'
  ) then
    create policy wb_ann_delete on public.announcements
    for delete to authenticated
    using (public.get_current_user_role() = any (array['admin'::text,'management'::text]));
  end if;
end $$;

