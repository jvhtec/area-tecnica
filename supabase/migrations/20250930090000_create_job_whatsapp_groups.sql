-- Create table to store WhatsApp groups per job and department
create table if not exists public.job_whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null check (department in ('sound','lights','video')),
  wa_group_id text not null,
  created_at timestamptz not null default now(),
  unique (job_id, department)
);

alter table public.job_whatsapp_groups enable row level security;

-- Only admin/management can read; inserts are performed by service role via Edge Function
create policy job_whatsapp_groups_select_mgmt
  on public.job_whatsapp_groups
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','management')
    )
  );

-- Prevent client-side inserts/updates/deletes
create policy job_whatsapp_groups_no_mod_client
  on public.job_whatsapp_groups
  for all
  to authenticated
  using (false)
  with check (false);

