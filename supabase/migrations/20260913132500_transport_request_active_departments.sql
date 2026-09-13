-- Manual transport requests are meant to be available to every active department.
--
-- 20260913121500 widened save_transport_request to accept production, administrative and
-- logistics, and the Logistics workspace offers all six in its department filter and its
-- request form. The table's own CHECK constraint was never widened, so the RPC accepted
-- those departments and the INSERT then failed on transport_requests_department_check:
-- raising a transport request for Production, Administration or Logistics was impossible.
--
-- The allowed set mirrors ACTIVE_DEPARTMENTS in src/types/department.ts. Every existing row
-- is sound/lights/video, so the wider constraint validates without touching data.
alter table public.transport_requests
  drop constraint if exists transport_requests_department_check,
  add constraint transport_requests_department_check
    check (
      department = any (
        array['sound', 'lights', 'video', 'production', 'administrative', 'logistics']
      )
    );
