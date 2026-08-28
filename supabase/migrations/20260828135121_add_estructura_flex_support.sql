alter table public.flex_folders
  add column if not exists source_department text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flex_folders_source_department_check'
      and conrelid = 'public.flex_folders'::regclass
  ) then
    alter table public.flex_folders
      add constraint flex_folders_source_department_check
      check (
        source_department is null
        or (
          department = 'estructura'
          and folder_type = 'pull_sheet'
          and source_department in ('sound', 'lights')
        )
      );
  end if;
end
$$;

create unique index if not exists ux_flex_folders_estructura_pull_sheet_source_per_job
  on public.flex_folders (job_id, source_department)
  where job_id is not null
    and department = 'estructura'
    and folder_type = 'pull_sheet'
    and source_department is not null;

alter table public.tours
  add column if not exists flex_estructura_folder_id uuid;

comment on column public.flex_folders.source_department is
  'Originating technical department for operational Estructura pull sheets; null for all other Flex rows.';

comment on column public.tours.flex_estructura_folder_id is
  'Flex element ID of the always-required Estructura department folder for the tour.';
