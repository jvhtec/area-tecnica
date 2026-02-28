-- Harden hoja de ruta atomic overwrite RPC authorization and execution rights.
-- This keeps management-capable roles from being blocked by stale function logic.

create or replace function public.replace_hoja_de_ruta_all(
  p_hoja_de_ruta_id uuid,
  p_transport_rows jsonb,
  p_contact_rows jsonb,
  p_staff_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.role() <> 'service_role' then
    v_role := coalesce(public.get_current_user_role(), '');

    if v_role not in ('admin', 'management', 'logistics', 'oscar') then
      if not exists (
        select 1
        from public.hoja_de_ruta h
        where h.id = p_hoja_de_ruta_id
          and (h.created_by = auth.uid() or h.approved_by = auth.uid())
      ) then
        raise exception 'Not authorized to replace this hoja de ruta''s child data'
          using errcode = '42501';
      end if;
    end if;
  end if;

  perform public.replace_hoja_de_ruta_transport(p_hoja_de_ruta_id, p_transport_rows);
  perform public.replace_hoja_de_ruta_contacts(p_hoja_de_ruta_id, p_contact_rows);
  perform public.replace_hoja_de_ruta_staff(p_hoja_de_ruta_id, p_staff_rows);
end;
$$;

revoke execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) to service_role;
