drop policy if exists "p_festival_artists_public_delete_8f2ede" on public.festival_artists;
drop policy if exists "p_festival_artists_public_insert_d3bb11" on public.festival_artists;
drop policy if exists "p_festival_artists_public_update_4616fe" on public.festival_artists;

create policy "p_festival_artists_public_delete_8f2ede"
on public.festival_artists
for delete
to authenticated
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text]));

create policy "p_festival_artists_public_insert_d3bb11"
on public.festival_artists
for insert
to authenticated
with check (public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'house_tech'::text]));

create policy "p_festival_artists_public_update_4616fe"
on public.festival_artists
for update
to authenticated
using (public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'house_tech'::text]))
with check (public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'house_tech'::text]));
