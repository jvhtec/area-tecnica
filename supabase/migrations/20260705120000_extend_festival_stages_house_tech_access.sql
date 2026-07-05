-- festival_stages previously had a single admin/management-only policy, unlike the
-- closely related festival_gear_setups table (which already lets house_tech/technician
-- read, and logistics mutate). This meant house_tech users -- who are explicitly allowed
-- to run Festival Gear Management (route access "managementAndHouseTech") and to
-- generate Memoria Técnica (memoria_tecnica_documents RLS already includes house_tech)
-- -- could not read configured stage names, silently falling back to generic "Stage N"
-- labels wherever useJobTechnicalStages() is consumed (Pesos/Consumos/Memoria Técnica
-- stage selectors).

drop policy if exists "Management can manage festival stages" on public.festival_stages;

create policy "p_festival_stages_public_select_7a2c19"
on public.festival_stages
for select
to authenticated
using (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'technician'::text, 'house_tech'::text])
);

create policy "p_festival_stages_public_insert_5e9b41"
on public.festival_stages
for insert
to authenticated
with check (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

create policy "p_festival_stages_public_update_c14d08"
on public.festival_stages
for update
to authenticated
using (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
)
with check (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text])
);

create policy "p_festival_stages_public_delete_b673f2"
on public.festival_stages
for delete
to authenticated
using (
  public.get_current_user_role() = any (array['admin'::text, 'management'::text, 'logistics'::text])
);
