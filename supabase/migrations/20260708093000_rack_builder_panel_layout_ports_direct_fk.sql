do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rack_builder_panel_layout_ports'::regclass
      and conname = 'rack_builder_panel_layout_ports_panel_layout_id_fkey'
  ) then
    alter table public.rack_builder_panel_layout_ports
      add constraint rack_builder_panel_layout_ports_panel_layout_id_fkey
      foreign key (panel_layout_id)
      references public.rack_builder_panel_layouts(id)
      on delete cascade;
  end if;
end $$;

notify pgrst, 'reload schema';
