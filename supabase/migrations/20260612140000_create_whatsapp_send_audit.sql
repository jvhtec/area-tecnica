-- Audit trail + rate-limit ledger for outbound WhatsApp operations
-- (send-job-whatsapp-message, create-whatsapp-group). Rows are written by
-- edge functions using the service role; admin/management can read them.

create table if not exists public.whatsapp_send_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('job_message', 'group_creation')),
  job_id uuid,
  recipient_count integer not null default 0,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

comment on table public.whatsapp_send_audit is 'Per-request ledger of WhatsApp sends/group creations; used for auditing and per-actor daily quotas in the WhatsApp edge functions.';

create index if not exists idx_whatsapp_send_audit_actor_kind_created
  on public.whatsapp_send_audit (actor_id, kind, created_at desc);

create index if not exists idx_whatsapp_send_audit_job_id
  on public.whatsapp_send_audit (job_id);

alter table public.whatsapp_send_audit enable row level security;

drop policy if exists "whatsapp_send_audit_select_management" on public.whatsapp_send_audit;
create policy "whatsapp_send_audit_select_management"
on public.whatsapp_send_audit
for select
to authenticated
using (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text])
);

grant select on table public.whatsapp_send_audit to authenticated;
grant all on table public.whatsapp_send_audit to service_role;
