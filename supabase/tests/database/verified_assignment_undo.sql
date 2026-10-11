\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT no_plan();
CREATE FUNCTION pg_temp.uid(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('b9950000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
CREATE FUNCTION pg_temp.job(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT pg_temp.uid(2000+n); $$;
CREATE FUNCTION pg_temp.cmd(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT pg_temp.uid(5000+n); $$;
CREATE FUNCTION pg_temp.day(n integer, d integer) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT date '2028-01-01' + n*5+d;
$$;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data,aud,role)
SELECT pg_temp.uid(n), 'verified-undo-' || n || '@test.local', '{}', '{}', 'authenticated', 'authenticated'
FROM generate_series(1,3) n;
INSERT INTO profiles(id,email,first_name,last_name,role,department)
SELECT pg_temp.uid(n), 'verified-undo-' || n || '@test.local', 'Verified', 'Undo',
  (CASE WHEN n=2 THEN 'technician' ELSE 'management' END)::public.user_role, 'sound'
FROM generate_series(1,3) n ON CONFLICT(id) DO UPDATE SET role=excluded.role,department=excluded.department;
INSERT INTO activity_catalog(code,label,default_visibility,severity,toast_enabled)
SELECT code,code,'management','info',false FROM unnest(ARRAY['job.created','assignment.created',
  'assignment.updated','assignment.removed','timesheet.approved']) code ON CONFLICT(code) DO NOTHING;
INSERT INTO jobs(id,title,start_time,end_time,job_type,status)
SELECT pg_temp.job(n),'Verified undo ' || n,
  (pg_temp.day(n,0) + time '08:00') AT TIME ZONE 'Europe/Madrid',
  (pg_temp.day(n,2) + time '20:00') AT TIME ZONE 'Europe/Madrid', 'single','Confirmado'
FROM generate_series(1,23) n;
INSERT INTO job_assignments(job_id,technician_id,status,sound_role,single_day,assignment_date)
SELECT pg_temp.job(n),pg_temp.uid(2),'invited', CASE WHEN n=6 THEN NULL ELSE 'SND-FOH-R' END,
  n=5, CASE WHEN n=5 THEN pg_temp.day(n,0) END
FROM unnest(ARRAY[4,5,6,7,9,12,16,18,23]) n;
INSERT INTO timesheets(job_id,technician_id,date,is_active,created_by)
SELECT pg_temp.job(n),pg_temp.uid(2),pg_temp.day(n,d),true,pg_temp.uid(1)
FROM unnest(ARRAY[4,5,6,7,9,12,16,18,23]) n CROSS JOIN generate_series(0,2) d
WHERE (n<>5 OR d IN (0,2)) AND (n<>9 OR d=0);
CREATE TEMP TABLE packets(n integer PRIMARY KEY, prior jsonb NOT NULL, result jsonb);
CREATE TEMP TABLE reports(n integer PRIMARY KEY, result jsonb);
GRANT ALL ON packets,reports TO authenticated;
CREATE FUNCTION pg_temp.apply_case(n integer, role_code text DEFAULT 'SND-MON-E',
  desired_status text DEFAULT 'invited', source_name text DEFAULT 'matrix-inspector')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_prior jsonb; v_result jsonb;
BEGIN
  v_prior := public.get_assignment_command_state(pg_temp.job(n),pg_temp.uid(2));
  v_result := public.apply_direct_assignment(pg_temp.cmd(n),pg_temp.job(n),pg_temp.uid(2),role_code,
    desired_status,'full',NULL,'replace',v_prior->>'state_token',NULL,NULL,'reject',source_name);
  INSERT INTO packets VALUES(n,v_prior,v_result);
  RETURN v_result;
END;
$$;
CREATE FUNCTION pg_temp.undo_case(n integer, inverse_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.undo_assignment_command(COALESCE(inverse_id,pg_temp.uid(15000+n)),pg_temp.cmd(n),result->>'state_token',prior)
  FROM packets WHERE packets.n=$1;
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',pg_temp.uid(1))::text,true);
SET LOCAL ROLE authenticated;
SELECT ok(NOT has_function_privilege('anon','public.undo_assignment_command(uuid,uuid,text,jsonb)','EXECUTE'), 'anonymous cannot atomically undo');
SELECT ok(NOT has_function_privilege('authenticated','public.assignment_undo_normalize_snapshot(jsonb)','EXECUTE'), 'normalizer is private');
SELECT ok(NOT has_table_privilege('authenticated','public.assignment_command_undos','INSERT'), 'clients cannot manufacture relationships');
SELECT is(pg_temp.apply_case(1)->>'outcome','committed','fixture full create commits');
SELECT ok((public.get_assignment_command_undo_window(pg_temp.cmd(1))->>'eligible')::boolean,'new committed matrix command eligible');
SELECT ok((public.get_assignment_command_undo_window(pg_temp.cmd(1))->>'undo_expires_at')::timestamptz
  BETWEEN clock_timestamp()+interval '6 seconds' AND clock_timestamp()+interval '8 seconds','deadline is eight seconds from ledger insertion');
SELECT is(jsonb_array_length(public.claim_assignment_side_effects(pg_temp.cmd(1))->'effects'),0,'hold prevents original claim');
SELECT is(pg_temp.undo_case(1)->>'outcome','committed','undo wins while held');
SELECT is(public.get_assignment_command_state(pg_temp.job(1),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=1),'create undo restores exact prior token');
SELECT is(jsonb_array_length(public.claim_assignment_side_effects(pg_temp.cmd(1))->'effects'),0,'undone original is unclaimable');
SELECT is(jsonb_array_length(public.claim_assignment_side_effects(pg_temp.uid(15001))->'effects'),0,'inverse plan is also unclaimable');
SELECT is(public.release_assignment_command_effects(pg_temp.cmd(1))->>'released','false','release loses after undo');
SELECT is(pg_temp.undo_case(1)->>'replayed','true','same packet replays stored inverse');
SELECT throws_ok($$SELECT pg_temp.undo_case(1,pg_temp.uid(16001))$$,'23505','command_id_reused','competing inverse ID fails');
SELECT throws_ok($$SELECT public.undo_assignment_command(pg_temp.uid(15001),pg_temp.cmd(1),'different',
  (SELECT prior FROM packets WHERE n=1))$$,'23505','command_id_reused','same inverse ID with conflicting packet fails');
RESET ROLE;
SELECT is((SELECT count(*) FROM assignment_command_undos WHERE original_command_id=pg_temp.cmd(1)
  AND inverse_command_id=pg_temp.uid(15001)),1::bigint,'one durable verified link');
SELECT is((SELECT undone_by_command_id FROM assignment_commands WHERE command_id=pg_temp.cmd(1)),
  pg_temp.uid(15001),'original exposes the durable inverse ID to runtime cleanup');
SELECT ok((SELECT bool_and(side_effects_status='superseded') FROM assignment_commands
  WHERE command_id IN (pg_temp.cmd(1),pg_temp.uid(15001))),'both plans atomically superseded');
-- Move current state and deadlines after commit: replay still returns original inverse.
INSERT INTO job_assignments(job_id,technician_id,status) VALUES(pg_temp.job(1),pg_temp.uid(2),'confirmed');
UPDATE assignment_commands SET undo_expires_at=clock_timestamp()-interval '1 second' WHERE command_id=pg_temp.cmd(1);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.undo_case(1)->>'replayed','true','replay precedes newer state and expired deadline checks');
SELECT is(public.get_assignment_command_state(pg_temp.job(1),pg_temp.uid(2))->'assignment'->>'status','confirmed','replay leaves newer state intact');
SELECT is(public.supersede_assignment_side_effects(ARRAY[pg_temp.cmd(1),pg_temp.uid(15001)])->>'not_superseded','0','verified supersession is idempotent');

SELECT is(pg_temp.apply_case(2)->>'outcome','committed','release fixture');
SELECT is(public.release_assignment_command_effects(pg_temp.cmd(2))->>'released','true','release wins');
SELECT is(public.release_assignment_command_effects(pg_temp.cmd(2))->>'released','true','repeated release keeps delivery available without extending hold');
INSERT INTO reports VALUES(2,public.claim_assignment_side_effects(pg_temp.cmd(2),10));
SELECT ok((SELECT jsonb_array_length(result->'effects')>0 FROM reports WHERE n=2),'released plan is claimable');
SELECT is(pg_temp.undo_case(2)->>'code','invalid_transition','undo loses to release/claim');
SELECT throws_ok($$SELECT public.supersede_assignment_side_effects(ARRAY[pg_temp.cmd(2)])$$,
  '22023','verified unclaimed undo required','public supersession cannot bypass release/claim');

SELECT is(pg_temp.apply_case(3)->>'outcome','committed','expired claim fixture');
RESET ROLE;
UPDATE assignment_commands SET undo_expires_at=clock_timestamp()-interval '1 second' WHERE command_id=pg_temp.cmd(3);
SET LOCAL ROLE authenticated;
INSERT INTO reports VALUES(3,public.claim_assignment_side_effects(pg_temp.cmd(3),10));
SELECT ok((SELECT jsonb_array_length(result->'effects')>0 FROM reports WHERE n=3),'expired hold admits claim');
RESET ROLE;
UPDATE assignment_commands SET undo_expires_at=clock_timestamp()+interval '8 seconds', side_effects=(
  SELECT jsonb_agg(e || jsonb_build_object('claimed_until',clock_timestamp()-interval '1 second'))
  FROM jsonb_array_elements(side_effects) e) WHERE command_id=pg_temp.cmd(3);
SELECT ok((SELECT effects_claimed_at IS NOT NULL FROM assignment_commands WHERE command_id=pg_temp.cmd(3)), 'first claim history is durable');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.undo_case(3)->>'code','invalid_transition','expired claim never restores undo eligibility');
SELECT is(public.get_assignment_command_undo_window(pg_temp.cmd(3))->>'eligible','false','window discloses claim history');

SELECT is(pg_temp.apply_case(4,NULLIF('SND-MON-E',''),'invited','matrix-focus')->>'outcome','committed','full modification');
SELECT is(pg_temp.undo_case(4)->>'outcome','committed','full inverse commits');
SELECT is(public.get_assignment_command_state(pg_temp.job(4),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=4),'full dates/role restored exactly');
SELECT is(pg_temp.apply_case(5,'SND-MON-E','invited','matrix-batch')->>'outcome','committed','scoped to full fixture');
SELECT is(pg_temp.undo_case(5)->>'outcome','committed','scoped multi-date inverse commits');
SELECT is(public.get_assignment_command_state(pg_temp.job(5),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=5),'scoped dates and compatibility fields restored exactly');
INSERT INTO packets SELECT 6,public.get_assignment_command_state(pg_temp.job(6),pg_temp.uid(2)),NULL;
UPDATE packets SET result=public.change_assignment_role(pg_temp.cmd(6),pg_temp.job(6),pg_temp.uid(2),'sound','SND-MON-E',true,
  prior->>'state_token','matrix-inspector') WHERE n=6;
SELECT is(pg_temp.undo_case(6)->>'outcome','committed','inverse clears originally null role');
SELECT is(public.get_assignment_command_state(pg_temp.job(6),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=6),'role clear exact token restoration');
INSERT INTO packets SELECT 7,public.get_assignment_command_state(pg_temp.job(7),pg_temp.uid(2)),NULL;
UPDATE packets SET result=public.set_assignment_status(pg_temp.cmd(7),pg_temp.job(7),pg_temp.uid(2),'confirm',
  prior->>'state_token','matrix-keyboard') WHERE n=7;
SELECT is(pg_temp.undo_case(7)->>'outcome','committed','confirm atomic inverse commits');
SELECT is(public.get_assignment_command_state(pg_temp.job(7),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=7),'confirmation exact restoration');
RESET ROLE;
SELECT is((SELECT side_effects_status FROM assignment_commands WHERE command_id=pg_temp.uid(15007)),
  'superseded','atomic undo cancels invited compensation');
SET LOCAL ROLE authenticated;

SELECT is(pg_temp.apply_case(8)->>'outcome','committed','forged snapshot fixture');
SELECT is(public.undo_assignment_command(pg_temp.uid(15008),pg_temp.cmd(8),(SELECT result->>'state_token' FROM packets WHERE n=8),
  (SELECT prior || jsonb_build_object('dates',jsonb_build_array(pg_temp.day(8,0)), 'state_token',prior->>'state_token') FROM packets WHERE n=8))->>'code',
  'invalid_transition','forged contents cannot borrow a genuine supplied token');
SELECT is(public.get_assignment_command_state(pg_temp.job(8),pg_temp.uid(2))->>'state_token',
  (SELECT result->>'state_token' FROM packets WHERE n=8),'forged snapshot refusal does not mutate assignment');
SELECT is(pg_temp.apply_case(9)->>'outcome','committed','legacy full coverage with subset active dates fixture');
SELECT is(pg_temp.undo_case(9)->>'code','invalid_transition','inexact restoration is refused');
SELECT is(public.get_assignment_command_state(pg_temp.job(9),pg_temp.uid(2))->>'state_token',
  (SELECT result->>'state_token' FROM packets WHERE n=9),'inexact inverse rolled back completely');
RESET ROLE;
SELECT is((SELECT count(*) FROM assignment_audit_log WHERE metadata->>'command_id'=pg_temp.uid(15009)::text),0::bigint,
  'inexact inverse leaves no mutation audit');
SELECT is((SELECT count(*) FROM assignment_command_undos WHERE original_command_id=pg_temp.cmd(9)),0::bigint,'inexact inverse leaves no verified link');
SELECT is((SELECT side_effects_status FROM assignment_commands WHERE command_id=pg_temp.cmd(9)),'pending','inexact inverse preserves original plan');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.apply_case(10)->>'outcome','committed','newer state fixture');
RESET ROLE;
UPDATE job_assignments SET sound_role='SND-FOH-R' WHERE job_id=pg_temp.job(10);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.undo_case(10)->>'code','stale_state','newer token blocks undo');
SELECT is(public.get_assignment_command_state(pg_temp.job(10),pg_temp.uid(2))->'assignment'->>'sound_role','SND-FOH-R','newer decision preserved');
SELECT is(pg_temp.apply_case(11)->>'outcome','committed','approved timesheet fixture');
RESET ROLE;
UPDATE timesheets SET approved_by_manager=true WHERE job_id=pg_temp.job(11);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.undo_case(11)->>'code','approved_timesheet','approval blocks undo even if decision token unchanged');
SELECT is(public.get_assignment_command_state(pg_temp.job(11),pg_temp.uid(2))->>'state_token',
  (SELECT result->>'state_token' FROM packets WHERE n=11),'approved refusal preserves decision');
SELECT is(pg_temp.apply_case(12,'SND-MON-E','confirmed')->>'outcome','committed','apply upgrades existing invited fixture');
SELECT is(pg_temp.undo_case(12)->>'code','invalid_transition','994 apply cannot downgrade: refuse exact mismatch');
SELECT is(public.get_assignment_command_state(pg_temp.job(12),pg_temp.uid(2))->>'state_token',
  (SELECT result->>'state_token' FROM packets WHERE n=12),'unsupported confirmed downgrade leaves state intact');
SELECT is(pg_temp.apply_case(13)->>'outcome','committed','unrelated inverse ID fixture');
SELECT throws_ok($$SELECT pg_temp.undo_case(13,pg_temp.cmd(2))$$,'23505','command_id_reused','unrelated pre-existing inverse ID is never trusted');
SELECT is(pg_temp.apply_case(14,'SND-MON-E','invited','assignment-dialog')->>'outcome','committed','ordinary nonmatrix fixture');
SELECT is(public.get_assignment_command_undo_window(pg_temp.cmd(14))->>'undo_expires_at',NULL,'ordinary/historical source has no hold');
SELECT is(public.get_assignment_command_undo_window(pg_temp.cmd(14))->>'eligible','false','ordinary source is ineligible');
SELECT is(pg_temp.apply_case(15)->>'outcome','committed','terminal report fixture');
RESET ROLE;
-- Simulate a historical mixed terminal plan, including an old matching token.
UPDATE assignment_commands SET side_effects='[{"status":"succeeded"},{"status":"superseded","claim_token":"b9950000-0000-0000-0000-000000099999"}]',
  side_effects_status='succeeded' WHERE command_id=pg_temp.cmd(15);
SET LOCAL ROLE authenticated;
SELECT is(public.record_assignment_side_effects(pg_temp.cmd(15),pg_temp.uid(99999),
  '[{"index":1,"status":"failed"}]')->>'side_effects_status','succeeded','late matching report cannot reopen mixed terminal plan');
SELECT is(public.record_assignment_side_effects(pg_temp.cmd(15),pg_temp.uid(99999),
  '[{"index":1,"status":"succeeded"}]')->>'ignored_indexes','[1]','superseded reports are ignored even with matching token');
SELECT is(public.record_assignment_side_effects(pg_temp.cmd(7),pg_temp.uid(99999),
  '[{"index":0,"status":"failed"}]')->>'side_effects_status','superseded','wholly superseded remains terminal');
SELECT is(public.record_assignment_side_effects(pg_temp.uid(15006),pg_temp.uid(99999),
  '[]')->>'side_effects_status','superseded','role clear inverse plan remains superseded');

-- Ignore client IDs/provenance/token when authenticating the real prior content.
SELECT is(pg_temp.apply_case(16)->>'outcome','committed','identity/provenance normalization fixture');
SELECT is(public.undo_assignment_command(pg_temp.uid(15016),pg_temp.cmd(16),(SELECT result->>'state_token' FROM packets WHERE n=16),
  (SELECT jsonb_set(prior || '{"state_token":"forged"}', '{assignment}',
    prior->'assignment' || '{"id":"untrusted","assignment_source":"untrusted","job_id":"untrusted"}') FROM packets WHERE n=16))->>'outcome',
  'committed','ignored supplied token/IDs/provenance cannot alter token projection');
SELECT is(public.get_assignment_command_state(pg_temp.job(16),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=16),'normalized exact prior restored');

-- Noop/historical commands are not given new holds, and empty plans stay none.
INSERT INTO reports VALUES(14, public.apply_direct_assignment(pg_temp.uid(19014),pg_temp.job(14),pg_temp.uid(2),
  'SND-MON-E','invited','full',NULL,'replace',
  public.get_assignment_command_state(pg_temp.job(14),pg_temp.uid(2))->>'state_token',NULL,NULL,'reject','matrix-inspector'));
SELECT is((SELECT result->>'outcome' FROM reports WHERE n=14),'noop','same state is a noop');
SELECT is(public.get_assignment_command_undo_window(pg_temp.uid(19014))->>'undo_expires_at',NULL,'noop has no hold');
SELECT is(public.record_assignment_side_effects(pg_temp.uid(19014),pg_temp.uid(99999),'[]')->>'side_effects_status',
  'none','empty report/plan remains none');
-- A newly created scoped assignment also restores an empty prior state exactly.
INSERT INTO packets SELECT 17,public.get_assignment_command_state(pg_temp.job(17),pg_temp.uid(2)),NULL;
UPDATE packets SET result=public.apply_direct_assignment(pg_temp.cmd(17),pg_temp.job(17),pg_temp.uid(2),
  'SND-MON-E','invited','single',ARRAY[pg_temp.day(17,1)],'replace',prior->>'state_token',
  NULL,NULL,'reject','matrix-focus') WHERE n=17;
SELECT is(pg_temp.undo_case(17)->>'outcome','committed','scoped single-date create inverse commits');
SELECT is(public.get_assignment_command_state(pg_temp.job(17),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=17),'single-date create exact restoration');
INSERT INTO packets SELECT 18,public.get_assignment_command_state(pg_temp.job(18),pg_temp.uid(2)),NULL;
UPDATE packets SET result=public.change_assignment_role(pg_temp.cmd(18),pg_temp.job(18),pg_temp.uid(2),'sound',NULL,
  true,prior->>'state_token','matrix-inspector') WHERE n=18;
SELECT is(pg_temp.undo_case(18)->>'outcome','committed','cleared role inverse adds prior role again');
SELECT is(public.get_assignment_command_state(pg_temp.job(18),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=18),'cleared role restored exactly');
SELECT is(pg_temp.apply_case(19)->>'outcome','committed','failed/succeeded history fixture');
SELECT is(pg_temp.apply_case(20)->>'outcome','committed','attempt history fixture');
SELECT is(pg_temp.apply_case(21)->>'outcome','committed','expired unclaimed fixture');
RESET ROLE;
UPDATE assignment_commands SET side_effects=jsonb_set(side_effects,'{0,status}','"failed"') WHERE command_id=pg_temp.cmd(19);
UPDATE assignment_commands SET side_effects=jsonb_set(side_effects,'{0,attempts}','1') WHERE command_id=pg_temp.cmd(20);
UPDATE assignment_commands SET undo_expires_at=clock_timestamp()-interval '1 millisecond' WHERE command_id=pg_temp.cmd(21);
SELECT ok((SELECT undo_expires_at > transaction_timestamp() FROM assignment_commands WHERE command_id=pg_temp.cmd(21)),
  'expired deadline is still after transaction start (negative control for now())');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.undo_case(19)->>'code','invalid_transition','failed effects never eligible for undo');
SELECT is(pg_temp.undo_case(20)->>'code','invalid_transition','attempt history without lease still blocks undo');
SELECT is(pg_temp.undo_case(21)->>'code','invalid_transition','actual clock expiry blocks undo without claims');
SELECT is(public.release_assignment_command_effects(pg_temp.cmd(21))->>'released','true','expired release keeps delivery available without extending deadline');
RESET ROLE;
UPDATE assignment_commands SET side_effects=jsonb_set(side_effects,'{0,status}','"succeeded"') WHERE command_id=pg_temp.cmd(19);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.undo_case(19,pg_temp.uid(17019))->>'code','invalid_transition','succeeded effects block another inverse ID');
SELECT is(public.get_assignment_command_state(pg_temp.job(19),pg_temp.uid(2))->>'state_token',
  (SELECT result->>'state_token' FROM packets WHERE n=19),'effect-history refusals preserve assignment');

INSERT INTO packets SELECT 22,public.get_assignment_command_state(pg_temp.job(22),pg_temp.uid(2)),NULL;
-- Set up a full prior using an ordinary command, then refresh the captured prior.
SELECT ok((public.apply_direct_assignment(pg_temp.uid(19022),pg_temp.job(22),pg_temp.uid(2),'SND-FOH-R','invited','full',
  NULL,'replace',(SELECT prior->>'state_token' FROM packets WHERE n=22))->>'ok')::boolean,'full prior fixture');
UPDATE packets SET prior=public.get_assignment_command_state(pg_temp.job(22),pg_temp.uid(2)) WHERE n=22;
UPDATE packets SET result=public.apply_direct_assignment(pg_temp.cmd(22),pg_temp.job(22),pg_temp.uid(2),'SND-MON-E','invited','single',
  ARRAY[pg_temp.day(22,1)],'replace',prior->>'state_token',NULL,NULL,'reject','matrix-inspector') WHERE n=22;
SELECT is(pg_temp.undo_case(22)->>'outcome','committed','full prior to single modification can undo');
SELECT is(public.get_assignment_command_state(pg_temp.job(22),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=22),'single modification restores exact full prior token');
RESET ROLE;
DELETE FROM assignment_commands WHERE command_id=pg_temp.uid(15022);
SELECT is((SELECT undone_by_command_id FROM assignment_commands WHERE command_id=pg_temp.cmd(22)),NULL::uuid,
  'inverse-first disposable fixture cleanup clears backlink');
SELECT is((SELECT count(*) FROM assignment_command_undos WHERE original_command_id=pg_temp.cmd(22)),0::bigint,
  'inverse-first cleanup removes relationship row');
DELETE FROM assignment_commands WHERE command_id IN (pg_temp.cmd(17),pg_temp.uid(15017));
SELECT is((SELECT count(*) FROM assignment_command_undos WHERE original_command_id=pg_temp.cmd(17)),0::bigint,
  'single batch cleanup can delete both ledger IDs');
SET LOCAL ROLE authenticated;

-- Author ownership and explicit JWT role for all four boundary RPCs.
SELECT is(pg_temp.apply_case(23,'SND-FOH-R','confirmed')->>'outcome','committed','pure status apply upgrade commits');
SELECT is(pg_temp.undo_case(23)->>'outcome','committed','pure status apply derives unconfirm inverse');
SELECT is(public.get_assignment_command_state(pg_temp.job(23),pg_temp.uid(2))->>'state_token',
  (SELECT prior->>'state_token' FROM packets WHERE n=23),'pure upgrade restores exact prior token');
SELECT is(jsonb_array_length(public.claim_assignment_side_effects(pg_temp.cmd(23))->'effects'),0,'pure upgrade original effects cancelled');
SELECT is(jsonb_array_length(public.claim_assignment_side_effects(pg_temp.uid(15023))->'effects'),0,'pure upgrade inverse effects cancelled');

SELECT set_config('request.jwt.claim.sub',pg_temp.uid(3)::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',pg_temp.uid(3))::text,true);
SELECT throws_ok($$SELECT public.get_assignment_command_undo_window(pg_temp.cmd(2))$$,'42501','permission denied','other manager cannot inspect author window');
SELECT throws_ok($$SELECT public.release_assignment_command_effects(pg_temp.cmd(2))$$,'42501','permission denied','other manager cannot release');
SELECT throws_ok($$SELECT pg_temp.undo_case(2,pg_temp.uid(17002))$$,'42501','permission denied','other manager cannot undo');
SELECT set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
SELECT set_config('request.jwt.claim.role','',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1))::text,true);
SELECT throws_ok($$SELECT public.unconfirm_assignment(pg_temp.uid(18001),pg_temp.job(1),pg_temp.uid(2),'token')$$,'42501','permission denied','management subject without JWT role cannot unconfirm');
SELECT throws_ok($$SELECT public.supersede_assignment_side_effects(ARRAY[pg_temp.cmd(1)])$$,'42501','permission denied','management subject without JWT role cannot supersede');
SELECT throws_ok($$SELECT public.get_assignment_command_undo_window(pg_temp.cmd(1))$$,'42501','permission denied','missing JWT role cannot inspect window');
SELECT throws_ok($$SELECT public.release_assignment_command_effects(pg_temp.cmd(1))$$,'42501','permission denied','missing JWT role cannot release');
SELECT throws_ok($$SELECT pg_temp.undo_case(1)$$,'42501','permission denied','missing JWT role cannot undo');
SELECT set_config('request.jwt.claim.role','anon',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('role','anon','sub',pg_temp.uid(1))::text,true);
SELECT throws_ok($$SELECT pg_temp.undo_case(1)$$,'42501','permission denied','mismatched JWT role cannot undo');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
