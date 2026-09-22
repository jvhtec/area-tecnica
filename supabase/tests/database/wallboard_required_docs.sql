CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SET search_path TO public, extensions;

SELECT plan(7);

SELECT is(
  (SELECT count(*)::integer FROM public.required_docs WHERE is_required),
  8,
  'eight documents are required across sound, lights and video'
);

SELECT results_eq(
  $$ SELECT key FROM public.required_docs WHERE department = 'sound' AND is_required ORDER BY key $$,
  $$ VALUES ('consumos'::text), ('lista_material'), ('memoria'), ('pesos'), ('soundvision') $$,
  'sound owes pesos, consumos, lista de material, SoundVision and memoria'
);

SELECT results_eq(
  $$ SELECT key FROM public.required_docs WHERE department = 'lights' AND is_required ORDER BY key $$,
  $$ VALUES ('consumos'::text), ('memoria') $$,
  'lights owes consumos and memoria'
);

SELECT results_eq(
  $$ SELECT key FROM public.required_docs WHERE department = 'video' AND is_required ORDER BY key $$,
  $$ VALUES ('consumos'::text) $$,
  'video owes consumos'
);

SELECT results_eq(
  $$ SELECT department, need FROM public.wallboard_doc_requirements ORDER BY department $$,
  $$ VALUES ('lights'::text, 2), ('sound', 5), ('video', 1) $$,
  'wallboard_doc_requirements reports the seeded per-department totals'
);

SELECT is(
  (SELECT count(*)::integer FROM public.required_docs WHERE coalesce(trim(label), '') = ''),
  0,
  'every requirement carries a Spanish label for the display'
);

-- Re-running the seed must not duplicate or overwrite rows.
INSERT INTO public.required_docs (department, key, label, is_required)
VALUES ('sound', 'pesos', 'Pesos', true)
ON CONFLICT (department, key) DO NOTHING;

SELECT is(
  (SELECT count(*)::integer FROM public.required_docs WHERE department = 'sound' AND key = 'pesos'),
  1,
  'the (department, key) unique index keeps the seed idempotent'
);

SELECT * FROM finish();

ROLLBACK;
