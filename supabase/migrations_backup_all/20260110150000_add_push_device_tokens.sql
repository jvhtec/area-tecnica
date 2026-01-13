-- Add native push device tokens (APNs)
create table if not exists push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  device_token text not null,
  device_id text,
  device_name text,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists push_device_tokens_device_token_idx
  on push_device_tokens (device_token);

create index if not exists push_device_tokens_user_id_idx
  on push_device_tokens (user_id);

alter table push_device_tokens enable row level security;

create policy "Users can manage their native push tokens"
  on push_device_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
