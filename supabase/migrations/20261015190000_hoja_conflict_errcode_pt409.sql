-- Stop raising optimistic-lock conflicts with SQLSTATE 40001.
--
-- 40001 is serialization_failure. PostgREST runs every request inside a
-- hasql transaction that automatically retries 40001 as a transient error,
-- forever. Our Hoja de Ruta / Tour Ops RPCs raise 40001 for a stale
-- expected_version, which can never succeed on retry, so a single stale save
-- pinned a pooled connection in a tight retry loop (~100 attempts/s, ~3M
-- logged errors and a full CPU core for 8.5 h on 2026-10-15) while the
-- browser request never received a response.
--
-- PT409 is PostgREST's custom-status convention: it returns HTTP 409 with
-- code "PT409" and is never retried. The frontend accepts both codes via
-- isHojaVersionConflict().
--
-- The affected functions are long and spread over several migrations, so
-- rewrite their live definitions in place. CREATE OR REPLACE keeps owner,
-- grants, SECURITY DEFINER and search_path.

do $$
declare
  v_fn record;
  v_def text;
  v_count integer := 0;
begin
  for v_fn in
    select p.oid, p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* 'errcode\s*=\s*''40001'''
  loop
    v_def := regexp_replace(
      pg_get_functiondef(v_fn.oid),
      'errcode\s*=\s*''40001''',
      'errcode = ''PT409''',
      'gi'
    );
    execute v_def;
    v_count := v_count + 1;
    raise notice 'hoja conflict errcode: rewrote %', v_fn.signature;
  end loop;

  raise notice 'hoja conflict errcode: % function(s) now raise PT409', v_count;
end;
$$;
