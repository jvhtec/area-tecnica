begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(2);
select ok(not has_function_privilege('anon','public.set_logistics_driver_leave(uuid,date,date,text)','EXECUTE'),'Anonymous cannot change leave');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.set_logistics_driver_leave('00000000-0000-0000-0000-000000000001','2026-10-08','2026-10-10','vacation')$$,'42501','No tienes permiso para gestionar descansos.','An authenticated authorized identity is required');
select * from finish();
rollback;
