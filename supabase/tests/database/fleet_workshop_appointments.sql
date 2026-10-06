begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;
select no_plan();

select has_table('public', 'fleet_workshop_appointments', 'workshop table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.fleet_workshop_appointments'::regclass), 'RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.fleet_workshop_appointments', 'INSERT'), 'direct insertion denied');
select ok(not has_table_privilege('authenticated', 'public.fleet_workshop_appointments', 'UPDATE'), 'direct update denied');
select ok(not has_table_privilege('authenticated', 'public.fleet_workshop_appointments', 'DELETE'), 'direct deletion denied');
select ok(not has_function_privilege('anon', 'public.list_fleet_workshop_appointments(date,date)', 'EXECUTE'), 'anonymous RPC denied');

insert into auth.users(id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
select id, '00000000-0000-0000-0000-000000000000'::uuid, email, 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated'
from (values
  ('fa110000-0000-0000-0000-000000000001'::uuid, 'workshop-manager@test.local'),
  ('fa110000-0000-0000-0000-000000000002'::uuid, 'workshop-house@test.local'),
  ('fa110000-0000-0000-0000-000000000003'::uuid, 'workshop-driver@test.local')
) u(id, email);
insert into public.profiles(id, email, first_name, last_name, role, department) values
  ('fa110000-0000-0000-0000-000000000001', 'workshop-manager@test.local', 'Gestión', 'Taller', 'management', 'logistics'),
  ('fa110000-0000-0000-0000-000000000002', 'workshop-house@test.local', 'Consulta', 'Taller', 'house_tech', 'sound'),
  ('fa110000-0000-0000-0000-000000000003', 'workshop-driver@test.local', 'Conductor', 'Taller', 'conductor', 'logistics')
on conflict (id) do update set role = excluded.role, department = excluded.department;
insert into public.fleet_vehicles(id, name, license_plate, vehicle_type, required_license)
values ('fa220000-0000-0000-0000-000000000001', 'Furgoneta taller', 'TEST-TALLER', 'furgoneta', 'B');
insert into public.logistics_events(id, event_type, transport_type, event_date, event_time, title, timezone)
values ('fa330000-0000-0000-0000-000000000001', 'load', 'furgoneta', '2031-03-10', '09:00', 'Transporte prueba taller', 'Europe/Madrid');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'fa110000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.save_fleet_workshop_appointment(null, null, 'fa220000-0000-0000-0000-000000000001', '2031-03-10 08:00Z', '2031-03-10 10:00Z', 'Taller', 'Revisión', null, 0, 'scheduled')$$, 'manager creates appointment with zero mileage');
select is((select count(*) from public.list_fleet_workshop_appointments('2031-03-10', '2031-03-10')), 1::bigint, 'appointment returned');
select throws_ok($$select public.save_fleet_workshop_appointment(null, null, 'fa220000-0000-0000-0000-000000000001', '2031-03-10 09:00Z', '2031-03-10 11:00Z', 'Taller', 'Otra cita', null, null, 'scheduled')$$, '23P01', 'El vehículo ya tiene otra cita de taller en ese horario.', 'overlapping workshop rejected');
select throws_ok($$select public.assign_transport_driver('fa330000-0000-0000-0000-000000000001', null, 'fa220000-0000-0000-0000-000000000001', '2031-03-10 09:00Z', '2031-03-10 11:00Z', null, null, true)$$, '23P01', 'El vehículo está reservado para el taller en ese horario. Selecciona otro vehículo o modifica la cita.', 'force transport cannot bypass workshop');
select lives_ok($$select public.assign_transport_driver('fa330000-0000-0000-0000-000000000001', null, 'fa220000-0000-0000-0000-000000000001', '2031-03-10 10:00Z', '2031-03-10 12:00Z', null, null, false)$$, 'adjacent transport allowed');
select throws_ok($$select public.save_fleet_workshop_appointment(null, null, 'fa220000-0000-0000-0000-000000000001', '2031-03-10 11:00Z', '2031-03-10 13:00Z', 'Taller', 'Nueva cita', null, null, 'scheduled')$$, '23P01', 'El vehículo tiene un transporte asignado en ese horario. Reasígnalo o cambia la cita.', 'transport also blocks new workshop');
select throws_ok($$select public.save_fleet_workshop_appointment(id, '2000-01-01T00:00:00Z', vehicle_id, starts_at, ends_at, workshop, reason, notes, mileage_km, 'cancelled') from public.fleet_workshop_appointments$$, '40001', 'Otra persona ha modificado esta cita. Cierra y vuelve a abrir la cita actualizada antes de guardar.', 'stale editor cannot overwrite');
select lives_ok($$select public.save_fleet_workshop_appointment(id, updated_at, vehicle_id, starts_at, ends_at, workshop, reason, notes, mileage_km, 'cancelled') from public.fleet_workshop_appointments$$, 'cancellation retains history');
select lives_ok($$select public.assign_transport_driver('fa330000-0000-0000-0000-000000000001', null, 'fa220000-0000-0000-0000-000000000001', '2031-03-10 08:00Z', '2031-03-10 10:00Z', null, (select id from public.transport_driver_assignments where vehicle_id = 'fa220000-0000-0000-0000-000000000001'), false)$$, 'cancelled workshop releases vehicle');
select lives_ok($$select public.save_fleet_workshop_appointment(null, null, 'fa220000-0000-0000-0000-000000000001', '2031-03-31 20:00Z', '2031-04-01 22:00Z', 'Taller', 'Cruce de mes', null, null, 'scheduled')$$, 'multi-day appointment');
select is((select count(*) from public.list_fleet_workshop_appointments('2031-04-01', '2031-04-01')), 1::bigint, 'appointment starting in previous month included');
select is((select count(*) from public.list_fleet_workshop_appointments('2031-04-02', '2031-04-02')), 0::bigint, 'exclusive Madrid midnight end');
select lives_ok($$select public.save_fleet_workshop_appointment(id, updated_at, vehicle_id, starts_at, ends_at, workshop, reason, notes, mileage_km, 'completed') from public.fleet_workshop_appointments where reason = 'Cruce de mes'$$, 'completion retains history');
select lives_ok($$select public.save_fleet_workshop_appointment(null, null, 'fa220000-0000-0000-0000-000000000001', '2031-04-01 08:00Z', '2031-04-01 10:00Z', 'Taller', 'Reserva nueva', null, null, 'scheduled')$$, 'completed appointment does not block');

reset role;
select set_config('request.jwt.claim.sub', 'fa110000-0000-0000-0000-000000000002', true);
set local role authenticated;
select lives_ok($$select * from public.list_fleet_workshop_appointments('2031-03-01','2031-04-30')$$, 'house technician may read');
select throws_ok($$select public.save_fleet_workshop_appointment(null, null, 'fa220000-0000-0000-0000-000000000001', '2031-05-01 08:00Z', '2031-05-01 10:00Z', 'Taller', 'Cita', null, null, 'scheduled')$$, '42501', 'Solo administración y gestión pueden modificar citas de taller.', 'house technician cannot write');
reset role;
select set_config('request.jwt.claim.sub', 'fa110000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.fleet_workshop_appointments), 0::bigint, 'driver cannot read table rows');
select throws_ok($$select * from public.list_fleet_workshop_appointments('2031-03-01','2031-04-30')$$, '42501', 'No tienes permiso para consultar las citas de taller.', 'driver cannot use privileged read RPC');
reset role;
select * from finish();
rollback;
