create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  resource text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  ip_address inet null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint security_audit_log_action_check check (char_length(trim(action)) > 0 and char_length(action) <= 120),
  constraint security_audit_log_resource_check check (char_length(trim(resource)) > 0 and char_length(resource) <= 255)
);

comment on table public.security_audit_log is 'Persistent audit trail for security-sensitive actions.';
comment on column public.security_audit_log.metadata is 'JSON metadata for outcomes, roles, and safe request context. Never store secret values.';

create index if not exists security_audit_log_created_at_idx
  on public.security_audit_log (created_at desc);

create index if not exists security_audit_log_user_id_idx
  on public.security_audit_log (user_id);

create index if not exists security_audit_log_action_idx
  on public.security_audit_log (action);

alter table public.security_audit_log enable row level security;

revoke all on table public.security_audit_log from anon;
revoke all on table public.security_audit_log from authenticated;

grant select on table public.security_audit_log to authenticated;
grant all on table public.security_audit_log to service_role;

create policy "security_audit_log_select_management"
on public.security_audit_log
for select
to authenticated
using (public.is_admin_or_management() or auth.role() = 'service_role');

create policy "security_audit_log_service_role_all"
on public.security_audit_log
for all
to service_role
using (true)
with check (true);
