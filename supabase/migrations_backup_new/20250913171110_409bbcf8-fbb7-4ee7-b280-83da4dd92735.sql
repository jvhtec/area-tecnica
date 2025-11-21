-- Create staffing workflow tables
create table if not exists staffing_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  phase text not null check (phase in ('availability','offer')),
  status text not null check (status in ('pending','confirmed','declined','expired')),
  token_hash text not null,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce: only one PENDING request per (job, profile, phase)
create unique index if not exists uq_staffing_pending
on staffing_requests(job_id, profile_id, phase)
where status = 'pending';

create table if not exists staffing_events (
  id uuid primary key default gen_random_uuid(),
  staffing_request_id uuid not null references staffing_requests(id) on delete cascade,
  event text not null, -- 'email_sent' | 'clicked_confirm' | 'clicked_decline' | ...
  meta jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table staffing_requests enable row level security;
alter table staffing_events enable row level security;

-- Drop existing policies if they exist
drop policy if exists pm_manage_staffing on staffing_requests;
drop policy if exists tech_read_own_staffing on staffing_requests;
drop policy if exists pm_read_events on staffing_events;
drop policy if exists pm_insert_events on staffing_events;

-- PMs/admins manage staffing rows
create policy pm_manage_staffing on staffing_requests
for all using (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]))
with check (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- Technicians can read their own staffing status
create policy tech_read_own_staffing on staffing_requests
for select using (profile_id = auth.uid());

-- PMs can read/insert events
create policy pm_read_events on staffing_events
for select using (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

create policy pm_insert_events on staffing_events
for insert with check (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_staffing_updated on staffing_requests;
create trigger trg_staffing_updated before update on staffing_requests
for each row execute function set_updated_at();

-- Convenience view for the matrix
create or replace view assignment_matrix_staffing as
select
  job_id, profile_id,
  max((case when phase='availability' then status end)) as availability_status,
  max((case when phase='offer' then status end)) as offer_status,
  max(updated_at) as last_change
from staffing_requests
group by job_id, profile_id;