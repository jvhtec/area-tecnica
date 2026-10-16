CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

BEGIN;

SELECT plan(18);

SELECT has_table('public', 'ios_share_import_tokens', 'token table exists');
SELECT has_table('public', 'ios_share_import_receipts', 'receipt table exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ios_share_import_tokens'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ios_share_import_receipts'::regclass),
  'RLS is enabled on both tables'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('ios_share_import_tokens', 'ios_share_import_receipts')
  ),
  'no policy exists: only the service role may touch import credentials'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.ios_share_import_tokens', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.ios_share_import_tokens', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.ios_share_import_tokens', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.ios_share_import_tokens', 'UPDATE'),
  'clients cannot read or write token hashes'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.ios_share_import_receipts', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.ios_share_import_receipts', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.ios_share_import_receipts', 'INSERT'),
  'clients cannot read or write import receipts'
);

SELECT ok(
  has_table_privilege('service_role', 'public.ios_share_import_tokens', 'INSERT')
  AND has_table_privilege('service_role', 'public.ios_share_import_receipts', 'INSERT'),
  'the service role can manage both tables'
);

SELECT has_column('public', 'ios_share_import_receipts', 'destination', 'receipts record the import destination');
SELECT has_column('public', 'ios_share_import_receipts', 'artist_id', 'rider receipts record the artist');
SELECT has_column('public', 'ios_share_import_receipts', 'artist_file_id', 'rider receipts confirm via the artist file');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ios_share_import_receipts'::regclass
      AND conname = 'ios_share_import_receipt_destination'
  ),
  'a receipt needs a department (document) or an artist name (rider)'
);

SELECT set_config('request.jwt.claim.role', 'service_role', true);

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at,
  updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000',
  'ios-share-import@example.test', '', now(), now(), now(), '{}', '{}',
  'authenticated', 'authenticated'
);

SELECT throws_ok(
  $$INSERT INTO public.ios_share_import_tokens (user_id, token_hash, expires_at)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'not-a-sha256', now() + interval '1 day')$$,
  '23514',
  NULL,
  'only SHA-256 hex digests are accepted as token hashes'
);

SELECT throws_ok(
  $$INSERT INTO public.ios_share_import_tokens (user_id, token_hash, expires_at)
    VALUES ('00000000-0000-4000-8000-0000000000a1', repeat('a', 64), now() - interval '1 day')$$,
  '23514',
  NULL,
  'a token cannot expire before it was created'
);

INSERT INTO public.ios_share_import_tokens (id, user_id, token_hash, expires_at)
VALUES (
  '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1',
  repeat('b', 64), NULL
);

SELECT is(
  (SELECT expires_at FROM public.ios_share_import_tokens WHERE id = '00000000-0000-4000-8000-0000000000b1'),
  NULL::timestamptz,
  'a token may be created without an expiry'
);

SELECT throws_ok(
  $$INSERT INTO public.ios_share_import_tokens (user_id, token_hash, expires_at)
    VALUES ('00000000-0000-4000-8000-0000000000a1', repeat('b', 64), now() + interval '1 day')$$,
  '23505',
  NULL,
  'token hashes are unique'
);

INSERT INTO public.jobs (id, title, start_time, end_time, job_type)
VALUES (
  '00000000-0000-4000-8000-0000000000c1', 'ios import fixture', now(), now() + interval '1 day', 'festival'
);

SELECT throws_ok(
  $$INSERT INTO public.ios_share_import_receipts
      (token_id, request_key, user_id, job_id, destination, file_name, file_path, file_size)
    VALUES ('00000000-0000-4000-8000-0000000000b1', 'rider-no-artist', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-0000000000c1', 'rider', 'rider.pdf', 'x/y.pdf', 10)$$,
  '23514',
  NULL,
  'a rider receipt without an artist name is rejected'
);

DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000a1';

SELECT is(
  (SELECT count(*)::int FROM public.ios_share_import_tokens WHERE id = '00000000-0000-4000-8000-0000000000b1'),
  0,
  'deleting a user removes their device tokens'
);

SELECT * FROM finish();

ROLLBACK;
