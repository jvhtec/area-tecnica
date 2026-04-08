-- Truck Planner native integration (job-centric, per-department)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.truck_planner_trucks (
  id uuid primary key default gen_random_uuid(),
  truck_id text not null unique,
  name text not null,
  inner_length_mm integer not null,
  inner_width_mm integer not null,
  inner_height_mm integer not null,
  empty_weight_kg numeric(10,3) not null,
  axle_front_x_mm integer not null,
  axle_rear_x_mm integer not null,
  axle_max_front_kg integer not null,
  axle_max_rear_kg integer not null,
  max_lr_imbalance_percent numeric(6,3) not null default 10,
  obstacles jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.truck_planner_case_skus (
  id uuid primary key default gen_random_uuid(),
  sku_id text not null unique,
  name text not null,
  length_mm integer not null,
  width_mm integer not null,
  height_mm integer not null,
  weight_kg numeric(10,3) not null,
  upright_only boolean not null default false,
  tilt_allowed boolean not null default false,
  allowed_yaw integer[] not null default array[0, 90, 180, 270],
  can_be_base boolean not null default true,
  top_contact_allowed boolean not null default true,
  max_load_above_kg numeric(10,3) not null default 0,
  min_support_ratio numeric(6,3) not null default 0.75,
  stack_class text,
  color_hex text,
  is_container boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.truck_planner_job_plans (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  department text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint truck_planner_job_plans_department_check
    check (department = any (array['sound'::text, 'lights'::text]))
);

create unique index if not exists idx_tp_job_plans_job_department
  on public.truck_planner_job_plans(job_id, department);

create table if not exists public.truck_planner_plan_versions (
  id uuid primary key default gen_random_uuid(),
  job_plan_id uuid not null references public.truck_planner_job_plans(id) on delete cascade,
  version_name text not null,
  version_number integer not null,
  status text not null default 'draft',
  truck_id uuid references public.truck_planner_trucks(id) on delete set null,
  instances_json jsonb not null default '[]'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  label_notes_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint truck_planner_plan_versions_status_check
    check (status = any (array['draft'::text, 'published'::text, 'archived'::text])),
  constraint truck_planner_plan_versions_number_positive
    check (version_number > 0)
);

create unique index if not exists idx_tp_plan_versions_plan_number
  on public.truck_planner_plan_versions(job_plan_id, version_number);

create unique index if not exists idx_tp_plan_versions_one_published
  on public.truck_planner_plan_versions(job_plan_id)
  where status = 'published';

create table if not exists public.truck_planner_plan_case_counts (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.truck_planner_plan_versions(id) on delete cascade,
  case_sku_id uuid not null references public.truck_planner_case_skus(id) on delete restrict,
  quantity integer not null,
  source text not null default 'manual',
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint truck_planner_plan_case_counts_quantity_check check (quantity >= 0)
);

create unique index if not exists idx_tp_case_counts_unique
  on public.truck_planner_plan_case_counts(plan_version_id, case_sku_id);

create table if not exists public.truck_planner_bundle_versions (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  version_name text not null,
  version_number integer not null,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint truck_planner_bundle_versions_department_check
    check (department = any (array['sound'::text, 'lights'::text])),
  constraint truck_planner_bundle_versions_number_positive
    check (version_number > 0)
);

create unique index if not exists idx_tp_bundle_versions_department_number
  on public.truck_planner_bundle_versions(department, version_number);

create unique index if not exists idx_tp_bundle_versions_one_published
  on public.truck_planner_bundle_versions(department)
  where is_published;

create table if not exists public.truck_planner_bundle_rules (
  id uuid primary key default gen_random_uuid(),
  bundle_version_id uuid not null references public.truck_planner_bundle_versions(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  case_sku_id uuid not null references public.truck_planner_case_skus(id) on delete cascade,
  equipment_units_per_case numeric(10,3) not null,
  rounding_mode text not null default 'ceil',
  min_cases integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint truck_planner_bundle_rules_units_check check (equipment_units_per_case > 0),
  constraint truck_planner_bundle_rules_rounding_check
    check (rounding_mode = any (array['ceil'::text, 'floor'::text, 'nearest'::text])),
  constraint truck_planner_bundle_rules_min_cases_check check (min_cases >= 0)
);

create unique index if not exists idx_tp_bundle_rules_unique
  on public.truck_planner_bundle_rules(bundle_version_id, equipment_id, case_sku_id);

create table if not exists public.truck_planner_transport_mappings (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null unique references public.truck_planner_trucks(id) on delete cascade,
  transport_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint truck_planner_transport_mappings_transport_type_check
    check (transport_type = any (array['trailer'::text, '9m'::text, '8m'::text, '6m'::text, '4m'::text, 'furgoneta'::text]))
);

create index if not exists idx_tp_plan_versions_job_plan_status
  on public.truck_planner_plan_versions(job_plan_id, status);

create index if not exists idx_tp_bundle_rules_bundle_version
  on public.truck_planner_bundle_rules(bundle_version_id);

create index if not exists idx_tp_job_plans_department on public.truck_planner_job_plans(department);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_tp_trucks_updated_at on public.truck_planner_trucks;
create trigger set_tp_trucks_updated_at
before update on public.truck_planner_trucks
for each row execute function public.set_updated_at();

drop trigger if exists set_tp_case_skus_updated_at on public.truck_planner_case_skus;
create trigger set_tp_case_skus_updated_at
before update on public.truck_planner_case_skus
for each row execute function public.set_updated_at();

drop trigger if exists set_tp_job_plans_updated_at on public.truck_planner_job_plans;
create trigger set_tp_job_plans_updated_at
before update on public.truck_planner_job_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_tp_plan_versions_updated_at on public.truck_planner_plan_versions;
create trigger set_tp_plan_versions_updated_at
before update on public.truck_planner_plan_versions
for each row execute function public.set_updated_at();

drop trigger if exists set_tp_plan_case_counts_updated_at on public.truck_planner_plan_case_counts;
create trigger set_tp_plan_case_counts_updated_at
before update on public.truck_planner_plan_case_counts
for each row execute function public.set_updated_at();

drop trigger if exists set_tp_bundle_versions_updated_at on public.truck_planner_bundle_versions;
create trigger set_tp_bundle_versions_updated_at
before update on public.truck_planner_bundle_versions
for each row execute function public.set_updated_at();

drop trigger if exists set_tp_bundle_rules_updated_at on public.truck_planner_bundle_rules;
create trigger set_tp_bundle_rules_updated_at
before update on public.truck_planner_bundle_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_tp_transport_mappings_updated_at on public.truck_planner_transport_mappings;
create trigger set_tp_transport_mappings_updated_at
before update on public.truck_planner_transport_mappings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth helper functions
-- ---------------------------------------------------------------------------

create or replace function public.tp_is_office_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text]);
$$;

create or replace function public.tp_can_edit_department(p_department text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.tp_is_office_role()
    or (
      public.get_current_user_role() = 'house_tech'
      and public.current_user_department() = p_department
    );
$$;

create or replace function public.tp_is_assigned_job_department(p_job_id uuid, p_department text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.job_assignments ja
    where ja.job_id = p_job_id
      and ja.technician_id = auth.uid()
      and ja.status = 'confirmed'
      and (
        (p_department = 'sound' and ja.sound_role is not null)
        or (p_department = 'lights' and ja.lights_role is not null)
      )
  );
$$;

create or replace function public.tp_can_read_job_plan(p_job_id uuid, p_department text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.tp_is_office_role()
    or (
      public.get_current_user_role() = 'house_tech'
      and public.current_user_department() = p_department
    )
    or (
      public.get_current_user_role() = 'technician'
      and public.tp_is_assigned_job_department(p_job_id, p_department)
      and exists (
        select 1
        from public.truck_planner_job_plans jp
        join public.truck_planner_plan_versions pv on pv.job_plan_id = jp.id
        where jp.job_id = p_job_id
          and jp.department = p_department
          and pv.status = 'published'
      )
    );
$$;

create or replace function public.tp_can_read_plan_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.truck_planner_plan_versions pv
    join public.truck_planner_job_plans jp on jp.id = pv.job_plan_id
    where pv.id = p_version_id
      and (
        public.tp_is_office_role()
        or (
          public.get_current_user_role() = 'house_tech'
          and public.current_user_department() = jp.department
        )
        or (
          public.get_current_user_role() = 'technician'
          and pv.status = 'published'
          and public.tp_is_assigned_job_department(jp.job_id, jp.department)
        )
      )
  );
$$;

create or replace function public.tp_next_plan_version_number(p_job_plan_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(max(version_number), 0) + 1
  from public.truck_planner_plan_versions
  where job_plan_id = p_job_plan_id;
$$;

-- ---------------------------------------------------------------------------
-- RPC: upsert department transport request from truck planner
-- ---------------------------------------------------------------------------

create or replace function public.tp_upsert_department_transport_request(
  p_job_id uuid,
  p_department text,
  p_transport_type text,
  p_description text default null,
  p_note text default null,
  p_leftover_space_meters numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.get_current_user_role();
  v_request_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_department is null or p_department not in ('sound', 'lights') then
    raise exception 'Invalid department: %', p_department using errcode = '22023';
  end if;

  if p_transport_type is null or p_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta') then
    raise exception 'Invalid transport type: %', p_transport_type using errcode = '22023';
  end if;

  if not (
    public.tp_is_office_role()
    or (v_role = 'house_tech' and public.current_user_department() = p_department)
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select tr.id
    into v_request_id
  from public.transport_requests tr
  where tr.job_id = p_job_id
    and tr.department = p_department
    and tr.status = 'requested'
  order by tr.updated_at desc
  limit 1;

  if v_request_id is null then
    insert into public.transport_requests (
      job_id,
      department,
      created_by,
      description,
      note,
      transport_type,
      status
    ) values (
      p_job_id,
      p_department,
      v_actor,
      p_description,
      p_note,
      p_transport_type,
      'requested'
    )
    returning id into v_request_id;
  else
    update public.transport_requests
      set description = coalesce(p_description, description),
          note = coalesce(p_note, note),
          transport_type = p_transport_type,
          status = 'requested',
          updated_at = now()
    where id = v_request_id;

    delete from public.transport_request_items
    where request_id = v_request_id;
  end if;

  insert into public.transport_request_items (
    request_id,
    transport_type,
    leftover_space_meters
  ) values (
    v_request_id,
    p_transport_type,
    p_leftover_space_meters
  );

  return v_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Technician published-plan read model
-- ---------------------------------------------------------------------------

create or replace view public.v_truck_planner_technician_published_plans as
select
  jp.job_id,
  j.title as job_title,
  jp.department,
  pv.id as plan_version_id,
  pv.version_name,
  pv.version_number,
  pv.truck_id,
  t.name as truck_name,
  pv.instances_json,
  pv.metrics_json,
  pv.label_notes_json,
  pv.published_at,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'case_sku_id', c.case_sku_id,
          'sku_id', sku.sku_id,
          'name', sku.name,
          'quantity', c.quantity,
          'source', c.source,
          'source_ref', c.source_ref
        )
        order by sku.name
      ),
      '[]'::jsonb
    )
    from public.truck_planner_plan_case_counts c
    join public.truck_planner_case_skus sku on sku.id = c.case_sku_id
    where c.plan_version_id = pv.id
  ) as case_counts_json
from public.truck_planner_job_plans jp
join public.truck_planner_plan_versions pv
  on pv.job_plan_id = jp.id
 and pv.status = 'published'
join public.jobs j on j.id = jp.job_id
left join public.truck_planner_trucks t on t.id = pv.truck_id
where public.tp_is_assigned_job_department(jp.job_id, jp.department);

create or replace function public.tp_get_technician_published_plans()
returns table (
  job_id uuid,
  job_title text,
  department text,
  plan_version_id uuid,
  version_name text,
  version_number integer,
  truck_id uuid,
  truck_name text,
  instances_json jsonb,
  metrics_json jsonb,
  label_notes_json jsonb,
  published_at timestamptz,
  case_counts_json jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.job_id,
    v.job_title,
    v.department,
    v.plan_version_id,
    v.version_name,
    v.version_number,
    v.truck_id,
    v.truck_name,
    v.instances_json,
    v.metrics_json,
    v.label_notes_json,
    v.published_at,
    v.case_counts_json
  from public.v_truck_planner_technician_published_plans v
  where public.get_current_user_role() = 'technician';
$$;

-- ---------------------------------------------------------------------------
-- RLS and policies
-- ---------------------------------------------------------------------------

alter table public.truck_planner_trucks enable row level security;
alter table public.truck_planner_case_skus enable row level security;
alter table public.truck_planner_job_plans enable row level security;
alter table public.truck_planner_plan_versions enable row level security;
alter table public.truck_planner_plan_case_counts enable row level security;
alter table public.truck_planner_bundle_versions enable row level security;
alter table public.truck_planner_bundle_rules enable row level security;
alter table public.truck_planner_transport_mappings enable row level security;

drop policy if exists tp_trucks_select on public.truck_planner_trucks;
create policy tp_trucks_select on public.truck_planner_trucks
for select using (((select auth.uid()) is not null));

drop policy if exists tp_trucks_write on public.truck_planner_trucks;
create policy tp_trucks_write on public.truck_planner_trucks
for all using (public.tp_is_office_role())
with check (public.tp_is_office_role());

drop policy if exists tp_case_skus_select on public.truck_planner_case_skus;
create policy tp_case_skus_select on public.truck_planner_case_skus
for select using (((select auth.uid()) is not null));

drop policy if exists tp_case_skus_write on public.truck_planner_case_skus;
create policy tp_case_skus_write on public.truck_planner_case_skus
for all using (public.tp_is_office_role())
with check (public.tp_is_office_role());

drop policy if exists tp_job_plans_select on public.truck_planner_job_plans;
create policy tp_job_plans_select on public.truck_planner_job_plans
for select using (public.tp_can_read_job_plan(job_id, department));

drop policy if exists tp_job_plans_insert on public.truck_planner_job_plans;
create policy tp_job_plans_insert on public.truck_planner_job_plans
for insert with check (public.tp_can_edit_department(department));

drop policy if exists tp_job_plans_update on public.truck_planner_job_plans;
create policy tp_job_plans_update on public.truck_planner_job_plans
for update using (public.tp_can_edit_department(department))
with check (public.tp_can_edit_department(department));

drop policy if exists tp_job_plans_delete on public.truck_planner_job_plans;
create policy tp_job_plans_delete on public.truck_planner_job_plans
for delete using (public.tp_can_edit_department(department));

drop policy if exists tp_plan_versions_select on public.truck_planner_plan_versions;
create policy tp_plan_versions_select on public.truck_planner_plan_versions
for select using (public.tp_can_read_plan_version(id));

drop policy if exists tp_plan_versions_insert on public.truck_planner_plan_versions;
create policy tp_plan_versions_insert on public.truck_planner_plan_versions
for insert with check (
  exists (
    select 1
    from public.truck_planner_job_plans jp
    where jp.id = job_plan_id
      and public.tp_can_edit_department(jp.department)
  )
);

drop policy if exists tp_plan_versions_update on public.truck_planner_plan_versions;
create policy tp_plan_versions_update on public.truck_planner_plan_versions
for update using (
  exists (
    select 1
    from public.truck_planner_job_plans jp
    where jp.id = job_plan_id
      and public.tp_can_edit_department(jp.department)
  )
)
with check (
  exists (
    select 1
    from public.truck_planner_job_plans jp
    where jp.id = job_plan_id
      and public.tp_can_edit_department(jp.department)
  )
);

drop policy if exists tp_plan_versions_delete on public.truck_planner_plan_versions;
create policy tp_plan_versions_delete on public.truck_planner_plan_versions
for delete using (
  exists (
    select 1
    from public.truck_planner_job_plans jp
    where jp.id = job_plan_id
      and public.tp_can_edit_department(jp.department)
  )
);

drop policy if exists tp_case_counts_select on public.truck_planner_plan_case_counts;
create policy tp_case_counts_select on public.truck_planner_plan_case_counts
for select using (public.tp_can_read_plan_version(plan_version_id));

drop policy if exists tp_case_counts_write on public.truck_planner_plan_case_counts;
create policy tp_case_counts_write on public.truck_planner_plan_case_counts
for all using (
  exists (
    select 1
    from public.truck_planner_plan_versions pv
    join public.truck_planner_job_plans jp on jp.id = pv.job_plan_id
    where pv.id = plan_version_id
      and public.tp_can_edit_department(jp.department)
  )
)
with check (
  exists (
    select 1
    from public.truck_planner_plan_versions pv
    join public.truck_planner_job_plans jp on jp.id = pv.job_plan_id
    where pv.id = plan_version_id
      and public.tp_can_edit_department(jp.department)
  )
);

drop policy if exists tp_bundle_versions_select on public.truck_planner_bundle_versions;
create policy tp_bundle_versions_select on public.truck_planner_bundle_versions
for select using (((select auth.uid()) is not null));

drop policy if exists tp_bundle_versions_write on public.truck_planner_bundle_versions;
create policy tp_bundle_versions_write on public.truck_planner_bundle_versions
for all using (public.tp_is_office_role())
with check (public.tp_is_office_role());

drop policy if exists tp_bundle_rules_select on public.truck_planner_bundle_rules;
create policy tp_bundle_rules_select on public.truck_planner_bundle_rules
for select using (((select auth.uid()) is not null));

drop policy if exists tp_bundle_rules_write on public.truck_planner_bundle_rules;
create policy tp_bundle_rules_write on public.truck_planner_bundle_rules
for all using (public.tp_is_office_role())
with check (public.tp_is_office_role());

drop policy if exists tp_transport_mappings_select on public.truck_planner_transport_mappings;
create policy tp_transport_mappings_select on public.truck_planner_transport_mappings
for select using (((select auth.uid()) is not null));

drop policy if exists tp_transport_mappings_write on public.truck_planner_transport_mappings;
create policy tp_transport_mappings_write on public.truck_planner_transport_mappings
for all using (public.tp_is_office_role())
with check (public.tp_is_office_role());

-- ---------------------------------------------------------------------------
-- Grants (explicitly deny anon writes)
-- ---------------------------------------------------------------------------

revoke all on table public.truck_planner_trucks from anon;
revoke all on table public.truck_planner_case_skus from anon;
revoke all on table public.truck_planner_job_plans from anon;
revoke all on table public.truck_planner_plan_versions from anon;
revoke all on table public.truck_planner_plan_case_counts from anon;
revoke all on table public.truck_planner_bundle_versions from anon;
revoke all on table public.truck_planner_bundle_rules from anon;
revoke all on table public.truck_planner_transport_mappings from anon;

grant select, insert, update, delete on table public.truck_planner_trucks to authenticated;
grant select, insert, update, delete on table public.truck_planner_case_skus to authenticated;
grant select, insert, update, delete on table public.truck_planner_job_plans to authenticated;
grant select, insert, update, delete on table public.truck_planner_plan_versions to authenticated;
grant select, insert, update, delete on table public.truck_planner_plan_case_counts to authenticated;
grant select, insert, update, delete on table public.truck_planner_bundle_versions to authenticated;
grant select, insert, update, delete on table public.truck_planner_bundle_rules to authenticated;
grant select, insert, update, delete on table public.truck_planner_transport_mappings to authenticated;

grant all on table public.truck_planner_trucks to service_role;
grant all on table public.truck_planner_case_skus to service_role;
grant all on table public.truck_planner_job_plans to service_role;
grant all on table public.truck_planner_plan_versions to service_role;
grant all on table public.truck_planner_plan_case_counts to service_role;
grant all on table public.truck_planner_bundle_versions to service_role;
grant all on table public.truck_planner_bundle_rules to service_role;
grant all on table public.truck_planner_transport_mappings to service_role;

grant select on public.v_truck_planner_technician_published_plans to authenticated;
revoke all on public.v_truck_planner_technician_published_plans from anon;

grant execute on function public.tp_upsert_department_transport_request(uuid, text, text, text, text, numeric) to authenticated;
revoke all on function public.tp_upsert_department_transport_request(uuid, text, text, text, text, numeric) from anon;

grant execute on function public.tp_get_technician_published_plans() to authenticated;
revoke all on function public.tp_get_technician_published_plans() from anon;

grant execute on function public.tp_can_read_job_plan(uuid, text) to authenticated;
grant execute on function public.tp_can_read_plan_version(uuid) to authenticated;
grant execute on function public.tp_can_edit_department(text) to authenticated;
grant execute on function public.tp_is_office_role() to authenticated;
grant execute on function public.tp_is_assigned_job_department(uuid, text) to authenticated;
grant execute on function public.tp_next_plan_version_number(uuid) to authenticated;

