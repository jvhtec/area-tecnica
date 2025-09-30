-- Track one-time trigger to lock WhatsApp group creation per job+department
create table if not exists public.job_whatsapp_group_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null check (department in ('sound','lights','video')),
  created_at timestamptz not null default now(),
  unique (job_id, department)
);

alter table public.job_whatsapp_group_requests enable row level security;

-- Management/admin can read
create policy job_whatsapp_group_requests_select_mgmt
  on public.job_whatsapp_group_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','management')
    )
  );

-- Prevent client-side writes
create policy job_whatsapp_group_requests_no_mod_client
  on public.job_whatsapp_group_requests
  for all
  to authenticated
  using (false)
  with check (false);

