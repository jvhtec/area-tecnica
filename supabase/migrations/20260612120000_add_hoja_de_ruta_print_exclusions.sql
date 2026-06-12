-- Store per-subsection print exclusions for Hoja de Ruta PDFs.
alter table public.hoja_de_ruta
  add column if not exists print_excluded_sections jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hoja_de_ruta_print_excluded_sections_is_array'
      and conrelid = 'public.hoja_de_ruta'::regclass
  ) then
    alter table public.hoja_de_ruta
      add constraint hoja_de_ruta_print_excluded_sections_is_array
      check (jsonb_typeof(print_excluded_sections) = 'array');
  end if;
end $$;

comment on column public.hoja_de_ruta.print_excluded_sections is
  'Array of Hoja de Ruta printable subsection ids excluded from full-document printing.';
