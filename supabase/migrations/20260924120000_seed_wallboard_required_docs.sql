-- Seed the per-department document requirements the wallboard checks every
-- upcoming job against.
--
-- required_docs has existed since the baseline schema but shipped empty, so
-- wallboard_doc_requirements reported need = 0 for every department and the
-- wallboard could never flag a missing document. The keys below are the
-- documents each department must deliver per job; wallboard-feed detects each
-- one from where the app already saves it (job_documents calculator folders and
-- the memoria técnica tables), see supabase/functions/wallboard-feed/docRules.ts.
--
-- Data-only and idempotent: existing (department, key) rows are left untouched
-- so an administrator's label or is_required change is never overwritten.

INSERT INTO public.required_docs (department, key, label, is_required)
VALUES
  ('sound', 'pesos', 'Pesos', true),
  ('sound', 'consumos', 'Consumos', true),
  ('sound', 'lista_material', 'Lista de material', true),
  ('sound', 'soundvision', 'Informe SoundVision', true),
  ('sound', 'memoria', 'Memoria técnica de sonido', true),
  ('lights', 'consumos', 'Consumos', true),
  ('lights', 'memoria', 'Memoria técnica de iluminación', true),
  ('video', 'consumos', 'Consumos', true)
ON CONFLICT (department, key) DO NOTHING;
