\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(17);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
 ('eb100000-0000-0000-0000-000000000001', 'correlation-tech@test.local', '{}', '{}', 'authenticated', 'authenticated'),
 ('eb100000-0000-0000-0000-000000000002', 'correlation-manager@test.local', '{}', '{}', 'authenticated', 'authenticated');
INSERT INTO public.profiles (id,email,first_name,last_name,role,department)
VALUES
 ('eb100000-0000-0000-0000-000000000001','correlation-tech@test.local','Test','Tech','technician','sound'),
 ('eb100000-0000-0000-0000-000000000002','correlation-manager@test.local','Test','Manager','management','sound')
ON CONFLICT (id) DO UPDATE SET role=excluded.role,department=excluded.department;
INSERT INTO public.jobs (id,title,start_time,end_time) VALUES
 ('eb200000-0000-0000-0000-000000000001','Assigned correlation fixture','2026-10-01 08:00Z','2026-10-01 20:00Z'),
 ('eb200000-0000-0000-0000-000000000002','Unassigned correlation fixture','2026-10-02 08:00Z','2026-10-02 20:00Z');
INSERT INTO public.job_assignments (job_id,technician_id,status) VALUES
 ('eb200000-0000-0000-0000-000000000001','eb100000-0000-0000-0000-000000000001','confirmed');
INSERT INTO public.job_required_roles (job_id,department,role_code,quantity) VALUES
 ('eb200000-0000-0000-0000-000000000001','sound','SND-TECH',1),
 ('eb200000-0000-0000-0000-000000000002','sound','SND-TECH',1);
INSERT INTO public.activity_log (code,job_id,actor_id,visibility)
SELECT (SELECT code FROM public.activity_catalog LIMIT 1), id,
 'eb100000-0000-0000-0000-000000000002', 'job_participants'
FROM public.jobs WHERE id IN ('eb200000-0000-0000-0000-000000000001','eb200000-0000-0000-0000-000000000002');
INSERT INTO public.job_technician_payout_overrides (job_id,technician_id,override_amount_eur,set_by)
SELECT id,'eb100000-0000-0000-0000-000000000001',123,'eb100000-0000-0000-0000-000000000002'
FROM public.jobs WHERE id IN ('eb200000-0000-0000-0000-000000000001','eb200000-0000-0000-0000-000000000002');
INSERT INTO public.expense_categories (slug,label_es) VALUES ('audit-allowed','Permitida'),('audit-denied','No permitida');
INSERT INTO public.expense_permissions (job_id,technician_id,category_slug,valid_from,valid_to) VALUES
 ('eb200000-0000-0000-0000-000000000001','eb100000-0000-0000-0000-000000000001','audit-allowed','2026-10-01','2026-10-01');

SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','eb100000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.activity_log WHERE job_id='eb200000-0000-0000-0000-000000000001' AND visibility='job_participants'),1::bigint,'assigned job activity remains visible');
SELECT is((SELECT count(*) FROM public.activity_log WHERE job_id='eb200000-0000-0000-0000-000000000002' AND visibility='job_participants'),0::bigint,'an assignment elsewhere does not reveal other job activity');
SELECT is((SELECT count(*) FROM public.job_required_roles WHERE job_id='eb200000-0000-0000-0000-000000000001'),1::bigint,'assigned staffing requirements remain visible');
SELECT is((SELECT count(*) FROM public.job_required_roles WHERE job_id='eb200000-0000-0000-0000-000000000002'),0::bigint,'an assignment elsewhere does not reveal staffing requirements');
SELECT is((SELECT count(*) FROM public.job_technician_payout_overrides WHERE job_id='eb200000-0000-0000-0000-000000000001'),1::bigint,'assigned payout remains visible');
SELECT is((SELECT count(*) FROM public.job_technician_payout_overrides WHERE job_id='eb200000-0000-0000-0000-000000000002'),0::bigint,'an assignment elsewhere does not reveal payouts');
SELECT lives_ok($$INSERT INTO public.job_expenses (job_id,technician_id,category_slug,expense_date,amount_original,currency_code,amount_eur) VALUES ('eb200000-0000-0000-0000-000000000001','eb100000-0000-0000-0000-000000000001','audit-allowed','2026-10-01',1,'EUR',1)$$,'matching expense permission permits insertion');
SELECT throws_ok($$INSERT INTO public.job_expenses (job_id,technician_id,category_slug,expense_date,amount_original,currency_code,amount_eur) VALUES ('eb200000-0000-0000-0000-000000000002','eb100000-0000-0000-0000-000000000001','audit-allowed','2026-10-01',1,'EUR',1)$$,'42501',NULL,'permission for another job is insufficient');
SELECT throws_ok($$INSERT INTO public.job_expenses (job_id,technician_id,category_slug,expense_date,amount_original,currency_code,amount_eur) VALUES ('eb200000-0000-0000-0000-000000000001','eb100000-0000-0000-0000-000000000001','audit-denied','2026-10-01',1,'EUR',1)$$,'42501',NULL,'permission for another category is insufficient');
SELECT lives_ok($$UPDATE public.job_expenses SET amount_original=2 WHERE category_slug='audit-allowed'$$,'permitted draft amount remains editable');
SELECT throws_ok($$UPDATE public.job_expenses SET job_id='eb200000-0000-0000-0000-000000000002' WHERE category_slug='audit-allowed'$$,'42501',NULL,'editing cannot move an expense to an unauthorized job');
SELECT throws_ok($$UPDATE public.job_expenses SET category_slug='audit-denied' WHERE category_slug='audit-allowed'$$,'42501',NULL,'editing cannot move an expense to an unauthorized category');
SELECT throws_ok($$UPDATE public.job_expenses SET expense_date='2026-10-02' WHERE category_slug='audit-allowed'$$,'42501',NULL,'editing cannot move an expense outside the permission window');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eb100000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$UPDATE public.job_technician_payout_overrides SET override_amount_eur=124 WHERE job_id='eb200000-0000-0000-0000-000000000001'$$,'department manager retains assigned-payout editing');
SELECT is((SELECT override_amount_eur FROM public.job_technician_payout_overrides WHERE job_id='eb200000-0000-0000-0000-000000000001'),124::numeric,'department manager edit actually changes the assigned payout');
SELECT is((SELECT count(*) FROM public.job_technician_payout_overrides WHERE job_id='eb200000-0000-0000-0000-000000000002'),0::bigint,'department match alone does not reveal an unassigned payout');
SELECT throws_ok($$INSERT INTO public.job_technician_payout_overrides (job_id,technician_id,override_amount_eur,set_by) VALUES ('eb200000-0000-0000-0000-000000000002','eb100000-0000-0000-0000-000000000002',10,'eb100000-0000-0000-0000-000000000002')$$,'42501',NULL,'manager cannot insert payout for a technician unassigned to that job');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
