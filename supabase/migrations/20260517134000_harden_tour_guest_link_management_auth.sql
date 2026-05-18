-- Harden guest-link management against stale role-cache state.
-- These RPCs must require an authenticated admin/management profile directly.

create or replace function public.create_tour_guest_link(
  p_tour_id uuid,
  p_label text default 'External tour link',
  p_allowed_sections jsonb default null,
  p_expires_at timestamptz default null
)
returns table (
  id uuid,
  tour_id uuid,
  token text,
  label text,
  allowed_sections jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_link public.tour_guest_links%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'management')
  ) then
    raise exception 'Permission denied';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.tour_guest_links (
    tour_id,
    token_hash,
    label,
    allowed_sections,
    expires_at,
    created_by
  )
  values (
    p_tour_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    coalesce(nullif(trim(p_label), ''), 'External tour link'),
    coalesce(p_allowed_sections, '{
      "overview": true,
      "timeline": true,
      "travel": true,
      "accommodations": true,
      "contacts": true,
      "documents": true,
      "weather": true
    }'::jsonb),
    p_expires_at,
    auth.uid()
  )
  returning * into v_link;

  return query
  select
    v_link.id,
    v_link.tour_id,
    v_token,
    v_link.label,
    v_link.allowed_sections,
    v_link.expires_at,
    v_link.revoked_at,
    v_link.created_at;
end;
$$;

create or replace function public.revoke_tour_guest_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'management')
  ) then
    raise exception 'Permission denied';
  end if;

  update public.tour_guest_links
  set revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where id = p_link_id;
end;
$$;

revoke execute on function public.create_tour_guest_link(uuid, text, jsonb, timestamptz) from anon;
revoke execute on function public.revoke_tour_guest_link(uuid) from anon;
grant execute on function public.create_tour_guest_link(uuid, text, jsonb, timestamptz) to authenticated;
grant execute on function public.revoke_tour_guest_link(uuid) to authenticated;
