CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(9);

SELECT like(
  pg_get_functiondef('public.transport_request_is_privileged()'::regprocedure),
  '%admin%management%',
  'transport privilege is granted to admin/management roles'
);

SELECT unlike(
  pg_get_functiondef('public.transport_request_is_privileged()'::regprocedure),
  '%logistics%',
  'logistics is not treated as a transport authorization role'
);

SELECT unlike(
  pg_get_functiondef('public.tp_can_edit_department(text)'::regprocedure),
  '%house_tech%',
  'Truck Planner transport editing has no house-tech department exception'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'enforce_transport_management_write'
      AND tgrelid = 'public.transport_requests'::regclass
      AND NOT tgisinternal
  ),
  'transport request table writes enforce management authorization'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'enforce_transport_item_management_write'
      AND tgrelid = 'public.transport_request_items'::regclass
      AND NOT tgisinternal
  ),
  'transport request item writes enforce management authorization'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'enforce_logistics_event_management_write'
      AND tgrelid = 'public.logistics_events'::regclass
      AND NOT tgisinternal
  ),
  'logistics event writes enforce management authorization'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'enforce_logistics_event_department_management_write'
      AND tgrelid = 'public.logistics_event_departments'::regclass
      AND NOT tgisinternal
  ),
  'logistics event department writes enforce management authorization'
);

SELECT like(
  pg_get_functiondef('public.save_transport_request(uuid,uuid,text,text,text,timestamp with time zone,text,text,text,text,boolean,text,text,jsonb)'::regprocedure),
  '%production%administrative%logistics%',
  'manual requests accept every active office/technical department'
);

SELECT like(
  pg_get_functiondef('public.set_transport_request_stage(uuid,text)'::regprocedure),
  '%Terminal transport requests cannot be reopened implicitly%',
  'terminal request lifecycle states cannot be silently resurrected'
);

SELECT * FROM finish();