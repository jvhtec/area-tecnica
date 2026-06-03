alter table public.power_requirement_tables
  add column if not exists stage_number integer,
  add column if not exists stage_name text;

create index if not exists idx_power_requirement_tables_job_department_stage
  on public.power_requirement_tables (job_id, department, stage_number);

comment on column public.power_requirement_tables.stage_number is
  'Festival stage number for multi-stage job power requirements.';

comment on column public.power_requirement_tables.stage_name is
  'Festival stage display name captured when the power requirement was generated.';
