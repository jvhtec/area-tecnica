\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO auth.users (id,email,raw_app_meta_data,raw_user_meta_data,aud,role) VALUES
 ('fc110000-0000-0000-0000-000000000001','flex-recon@test.local','{}','{}','authenticated','authenticated');
INSERT INTO profiles(id,email,first_name,last_name,role,department,flex_resource_id) VALUES
 ('fc110000-0000-0000-0000-000000000001','flex-recon@test.local','Flex','Recon','technician','sound','fc910000-0000-0000-0000-000000000001')
ON CONFLICT(id) DO UPDATE SET role=excluded.role,department=excluded.department,flex_resource_id=excluded.flex_resource_id;
INSERT INTO activity_catalog(code,label,default_visibility,severity,toast_enabled)
SELECT code,code,'management','info',false FROM unnest(ARRAY['job.created','assignment.created','assignment.updated','assignment.removed']) code
ON CONFLICT(code) DO NOTHING;
INSERT INTO jobs(id,title,start_time,end_time,job_type,status) VALUES
 ('fc210000-0000-0000-0000-000000000001','Flex A',now(),now()+interval '1 day','single','Confirmado'),
 ('fc210000-0000-0000-0000-000000000002','Flex Alias',now(),now()+interval '1 day','single','Confirmado');
INSERT INTO flex_crew_calls(id,job_id,department,flex_element_id) VALUES
 ('fc410000-0000-0000-0000-000000000001','fc210000-0000-0000-0000-000000000001','sound','fc510000-0000-0000-0000-000000000001'),
 ('fc410000-0000-0000-0000-000000000002','fc210000-0000-0000-0000-000000000002','sound','fc510000-0000-0000-0000-000000000001');
INSERT INTO job_assignments(job_id,technician_id,status,sound_role) VALUES
 ('fc210000-0000-0000-0000-000000000001','fc110000-0000-0000-0000-000000000001','invited','SND-FOH-R');
CREATE TEMP TABLE flex_results(name text PRIMARY KEY,value jsonb);
INSERT INTO flex_results SELECT 'claim',public.claim_flex_crew_reconciliation('fc210000-0000-0000-0000-000000000001','sound');
CREATE FUNCTION pg_temp.owner() RETURNS uuid LANGUAGE sql AS $$ SELECT (value->>'owner_token')::uuid FROM flex_results WHERE name='claim' $$;
CREATE FUNCTION pg_temp.snapshot() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.read_flex_crew_reconciliation('fc510000-0000-0000-0000-000000000001',pg_temp.owner()) $$;
SELECT is(jsonb_array_length(pg_temp.snapshot()->'desired'),1,'current explicit role supplies desired membership');
SELECT throws_ok($$ SELECT public.claim_flex_crew_reconciliation('fc210000-0000-0000-0000-000000000002','sound') $$,
 '55P03','flex_crew_reconciliation_busy','physical alias cannot obtain another owner');
UPDATE flex_crew_reconciliation_gates SET acquired_at=now()-interval '2 years',updated_at=now()-interval '2 years';
SELECT throws_ok($$ SELECT public.claim_flex_crew_reconciliation('fc210000-0000-0000-0000-000000000001','sound') $$,
 '55P03','flex_crew_reconciliation_busy','age does not permit takeover');
SELECT throws_ok($$ SELECT public.release_flex_crew_reconciliation('fc510000-0000-0000-0000-000000000001',gen_random_uuid()) $$,
 '55000','invalid Flex reconciliation owner or outstanding operation','stale owner cannot release');
SELECT throws_ok($$ SELECT public.write_flex_crew_mapping('fc510000-0000-0000-0000-000000000001',gen_random_uuid(),
 'fc410000-0000-0000-0000-000000000001','fc110000-0000-0000-0000-000000000001','fc610000-0000-0000-0000-000000000001') $$,
 '55000','invalid Flex reconciliation owner or outstanding operation','stale owner cannot mutate mappings');
SELECT throws_ok($$ SELECT public.admit_flex_crew_operation('fc510000-0000-0000-0000-000000000001',gen_random_uuid(),
 '{"kind":"add"}',pg_temp.snapshot()->>'state_token') $$,
 '55000','invalid Flex reconciliation owner or outstanding operation','stale owner cannot admit a mutation');
INSERT INTO flex_results SELECT 'snapshot',pg_temp.snapshot();
UPDATE job_assignments SET status='declined' WHERE job_id='fc210000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(pg_temp.snapshot()->'desired'),1,'soft decline preserves desired crew');
UPDATE job_assignments SET sound_role=NULL WHERE job_id='fc210000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(pg_temp.snapshot()->'desired'),0,'role clear is not undone by profile department fallback');
SELECT throws_ok($$ SELECT public.admit_flex_crew_operation('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),
 '{"kind":"add"}',(SELECT value->>'state_token' FROM flex_results WHERE name='snapshot')) $$,
 'P0409','Flex desired state changed','admission refuses an obsolete desired snapshot');
SELECT lives_ok($$ SELECT public.admit_flex_crew_operation('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),
 '{"kind":"remove","target":"diagnostic-only"}',pg_temp.snapshot()->>'state_token') $$,'current operation is durably admitted');
SELECT throws_ok($$ SELECT public.release_flex_crew_reconciliation('fc510000-0000-0000-0000-000000000001',pg_temp.owner()) $$,
 '55000','invalid Flex reconciliation owner or outstanding operation','outstanding operation prevents release');
SELECT lives_ok($$ SELECT public.settle_flex_crew_operation('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),true) $$,
 'ambiguous outcome is quarantined');
SELECT is((SELECT state FROM flex_crew_reconciliation_gates),'uncertain','uncertainty persists');
SELECT ok((SELECT outstanding_operation IS NOT NULL FROM flex_crew_reconciliation_gates),'descriptor retained for recovery');
SELECT throws_ok($$ SELECT public.claim_flex_crew_reconciliation('fc210000-0000-0000-0000-000000000002','sound') $$,
 '55P03','flex_crew_reconciliation_busy','uncertainty prevents replacement worker');
SELECT throws_ok($$ SELECT public.release_flex_crew_reconciliation('fc510000-0000-0000-0000-000000000001',pg_temp.owner()) $$,
 '55000','invalid Flex reconciliation owner or outstanding operation','quarantined owner cannot release through normal API');

-- Test-only operator recovery, after no actual external request was issued.
UPDATE flex_crew_reconciliation_gates SET state='idle',owner_token=NULL,outstanding_operation=NULL;
UPDATE flex_results SET value=public.claim_flex_crew_reconciliation('fc210000-0000-0000-0000-000000000002','sound') WHERE name='claim';
SELECT lives_ok($$ SELECT public.write_flex_crew_mapping('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),
 'fc410000-0000-0000-0000-000000000001','fc110000-0000-0000-0000-000000000001','fc610000-0000-0000-0000-000000000001') $$,'current owner can update an alias mapping');
UPDATE profiles SET flex_resource_id=NULL WHERE id='fc110000-0000-0000-0000-000000000001';
SELECT ok((pg_temp.snapshot()->'current'->0->>'line_item_id') IS NOT NULL,'missing profile resource preserves stale remote identity for removal');
INSERT INTO flex_results SELECT 'before_change',pg_temp.snapshot();
INSERT INTO job_assignments(job_id,technician_id,status,sound_role) VALUES
 ('fc210000-0000-0000-0000-000000000002','fc110000-0000-0000-0000-000000000001','confirmed','SND-FOH-R');
SELECT throws_ok($$ SELECT public.release_flex_crew_reconciliation('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),
 (SELECT value->>'state_token' FROM flex_results WHERE name='before_change')) $$,
 'P0409','Flex desired state changed','final release refuses an obsolete projection');
SELECT lives_ok($$ SELECT public.admit_flex_crew_operation('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),
 '{"kind":"add","crew_call_id":"fc410000-0000-0000-0000-000000000001","technician_id":"fc110000-0000-0000-0000-000000000001"}',
 pg_temp.snapshot()->>'state_token') $$,'verified add begins outstanding');
SELECT throws_ok($$ SELECT public.settle_flex_crew_add('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),
 'fc410000-0000-0000-0000-000000000001','fc110000-0000-0000-0000-000000000001','invalid-uuid') $$,
 '22P02',NULL,'mapping persistence failure refuses settlement');
SELECT ok((SELECT outstanding_operation IS NOT NULL FROM flex_crew_reconciliation_gates),'failed mapping leaves admitted add outstanding');
SELECT lives_ok($$ SELECT public.settle_flex_crew_add('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),
 'fc410000-0000-0000-0000-000000000001','fc110000-0000-0000-0000-000000000001','fc610000-0000-0000-0000-000000000002') $$,
 'successful add settles and records ownership atomically');
SELECT is((SELECT flex_line_item_id::text FROM flex_crew_assignments WHERE crew_call_id='fc410000-0000-0000-0000-000000000001'),
 'fc610000-0000-0000-0000-000000000002','verified external line is durably mapped');
SELECT ok((SELECT outstanding_operation IS NULL FROM flex_crew_reconciliation_gates),'persisted add is settled');
SELECT ok((SELECT owned_contacts ? 'fc610000-0000-0000-0000-000000000002' FROM flex_crew_reconciliation_gates),
 'atomic add also journals contact ownership independently of mapping cascades');
DELETE FROM profiles WHERE id='fc110000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*) FROM flex_crew_assignments),0::bigint,'profile deletion cascades the ordinary mappings');
SELECT ok((SELECT owned_contacts ? 'fc610000-0000-0000-0000-000000000002' FROM flex_crew_reconciliation_gates),
 'contact journal survives profile deletion');
SELECT throws_ok($$ SELECT public.release_flex_crew_reconciliation('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),NULL) $$,
 '55000','Flex contact ownership requires verified reconciliation','error cleanup cannot discard journaled contact ownership');
SELECT throws_ok($$ SELECT public.claim_flex_crew_reconciliation('fc210000-0000-0000-0000-000000000002','sound') $$,
 '55P03','flex_crew_reconciliation_busy','cascade plus read failure cannot admit a forgetful replacement');
SELECT lives_ok($$ SELECT public.release_flex_crew_reconciliation('fc510000-0000-0000-0000-000000000001',pg_temp.owner(),pg_temp.snapshot()->>'state_token') $$,
 'fully settled current owner can release');
DELETE FROM jobs WHERE id IN ('fc210000-0000-0000-0000-000000000001','fc210000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM flex_crew_reconciliation_gates),1::bigint,'physical gate survives cascading source deletion');

SELECT ok(NOT has_table_privilege('authenticated','public.flex_crew_reconciliation_gates','SELECT')
 AND NOT has_table_privilege('authenticated','public.flex_crew_reconciliation_gates','UPDATE'),'ordinary clients have no gate access');
SELECT ok(NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND NOT has_function_privilege('anon',p.oid,'EXECUTE'),
 p.proname || ' is service-only') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('flex_crew_reconciliation_projection','claim_flex_crew_reconciliation',
 'read_flex_crew_reconciliation','admit_flex_crew_operation','settle_flex_crew_operation','settle_flex_crew_add','write_flex_crew_mapping','release_flex_crew_reconciliation');
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SELECT throws_ok($$ SELECT public.claim_flex_crew_reconciliation(NULL,NULL) $$,'42501','permission denied','even a definer call denies missing identity');
SELECT * FROM finish();
ROLLBACK;
