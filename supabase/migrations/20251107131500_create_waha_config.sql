-- Create secure storage and resolver for WAHA (WhatsApp HTTP API) keys
-- Allows multiple hosts with different API keys and sessions.

begin;

-- Dedicated private schema for secrets
create schema if not exists secrets;

-- Table mapping WAHA host -> api_key (+ optional session)
create table if not exists secrets.waha_hosts (
  host text primary key,                       -- e.g. waha2.sector-pro.work or sector-pro.work or '*'
  api_key text not null,
  session text not null default 'default',     -- WAHA session name
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simple updated_at trigger
create or replace function secrets.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on secrets.waha_hosts;
create trigger set_updated_at
before update on secrets.waha_hosts
for each row execute function secrets.set_updated_at();

comment on table secrets.waha_hosts is 'WAHA host -> key/session mapping (private).';
comment on column secrets.waha_hosts.host is 'Hostname to match (exact), or root domain, or * for default.';

-- Internal resolver: returns the matching key/session for a given base URL/host
create or replace function secrets.get_waha_config(base_url text)
returns table(host text, api_key text, session text)
language plpgsql
security definer
set search_path = secrets, public
as $$
declare
  v_input text := coalesce(base_url, '');
  v_host text;
  v_root text;
  parts text[];
begin
  -- Normalize input -> hostname only, lowercase, strip port & path
  v_host := lower(v_input);
  v_host := regexp_replace(v_host, '^\s*https?://', '', 'i');
  v_host := regexp_replace(v_host, '/.*$', '');
  v_host := regexp_replace(v_host, ':\d+$', '');

  -- Try exact host match
  return query
    select wh.host, wh.api_key, wh.session
    from secrets.waha_hosts wh
    where wh.enabled and wh.host = v_host
    limit 1;
  if found then return; end if;

  -- Try root domain (last two labels)
  parts := string_to_array(v_host, '.');
  if array_length(parts, 1) >= 2 then
    v_root := parts[array_length(parts,1)-1] || '.' || parts[array_length(parts,1)];
    return query
      select wh.host, wh.api_key, wh.session
      from secrets.waha_hosts wh
      where wh.enabled and wh.host = v_root
      limit 1;
    if found then return; end if;
  end if;

  -- Fallback: wildcard row
  return query
    select wh.host, wh.api_key, wh.session
    from secrets.waha_hosts wh
    where wh.enabled and wh.host = '*'
    limit 1;
end;
$$;

comment on function secrets.get_waha_config(text) is 'Resolve WAHA api_key/session for a given base URL or host.';

-- Public wrapper for PostgREST/Supabase RPC; restricted to service_role
create or replace function public.get_waha_config(base_url text)
returns table(host text, api_key text, session text)
language sql
security definer
set search_path = public, secrets
as $$
  select * from secrets.get_waha_config(base_url);
$$;

-- Lock down access: only service_role can use the secrets and wrapper
revoke usage on schema secrets from public, anon, authenticated;
grant usage on schema secrets to service_role;

revoke all on table secrets.waha_hosts from public, anon, authenticated;
grant select, insert, update, delete on table secrets.waha_hosts to service_role;

revoke execute on function secrets.get_waha_config(text) from public, anon, authenticated;
grant execute on function secrets.get_waha_config(text) to service_role;

revoke execute on function public.get_waha_config(text) from public, anon, authenticated;
grant execute on function public.get_waha_config(text) to service_role;

-- Optional seed examples (uncomment and replace with your real hosts/keys)
-- insert into secrets.waha_hosts(host, api_key, session) values
--   ('waha.sector-pro.work',  'waha-key-1', 'default'),
--   ('waha2.sector-pro.work', 'waha-key-2', 'default'),
--   ('waha3.sector-pro.work', 'waha-key-3', 'default'),
--   ('waha4.sector-pro.work', 'waha-key-4', 'default');

commit;

