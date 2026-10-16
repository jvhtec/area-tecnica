-- Credentials for the iOS Shortcuts document-import bridge.
-- Shortcuts cannot reuse a PWA browser session. Only Edge Functions (service role)
-- may read these hashes. A scoped token never grants direct PostgREST/Storage access.
create table if not exists public.ios_share_import_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'iPhone',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  -- Null = never expires; a device credential lives until it is revoked.
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  constraint ios_share_import_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint ios_share_import_token_label_length check (length(label) between 1 and 80),
  constraint ios_share_import_expiry_after_create check (expires_at is null or expires_at > created_at)
);
create index if not exists ios_share_import_tokens_by_user
  on public.ios_share_import_tokens (user_id, created_at desc);

-- Durable idempotency keyed by the device token and a caller-provided request UUID.
-- No extra job-document table: completed imports live in existing job_documents.
create table if not exists public.ios_share_import_receipts (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.ios_share_import_tokens(id) on delete cascade,
  request_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null,
  file_name text not null,
  file_path text not null,
  file_size bigint not null,
  document_id uuid references public.job_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ios_share_import_receipt_request_key check (request_key ~ '^[a-zA-Z0-9_-]{8,100}$'),
  constraint ios_share_import_receipt_size check (file_size > 0),
  unique (token_id, request_key),
  unique (file_path)
);
create index if not exists ios_share_import_receipts_by_user
  on public.ios_share_import_receipts (user_id, created_at desc);

alter table public.ios_share_import_tokens enable row level security;
alter table public.ios_share_import_receipts enable row level security;
revoke all on public.ios_share_import_tokens from public, anon, authenticated;
revoke all on public.ios_share_import_receipts from public, anon, authenticated;
grant all on public.ios_share_import_tokens to service_role;
grant all on public.ios_share_import_receipts to service_role;

comment on table public.ios_share_import_tokens is
  'SHA-256 hashed, revocable bearer credentials restricted to the iOS document importer.';
comment on table public.ios_share_import_receipts is
  'Idempotency receipts for validated job document imports via iOS Shortcuts.';
