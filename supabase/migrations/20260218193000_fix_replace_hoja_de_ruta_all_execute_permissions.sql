-- Ensure authenticated callers can execute replace_hoja_de_ruta_all without needing
-- direct EXECUTE permissions on internal helper functions.

alter function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb)
  security definer
  set search_path = public;

revoke execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) to service_role;
