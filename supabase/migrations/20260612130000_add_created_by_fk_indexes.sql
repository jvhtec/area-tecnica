-- Add missing FK indexes on created_by for the two catalog tables added in
-- June 2026. Every other FK in the schema is indexed; these were missed at
-- creation time and would force sequential scans on user-deletion cascades
-- (created_by has ON DELETE SET NULL) and ownership lookups.

create index if not exists idx_consumos_components_created_by
  on public.consumos_components (created_by);

create index if not exists idx_technical_tool_quick_presets_created_by
  on public.technical_tool_quick_presets (created_by);
