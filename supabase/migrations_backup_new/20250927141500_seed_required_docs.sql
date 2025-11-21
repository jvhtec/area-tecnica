-- Seed required_docs per department for Wallboard Document Progress
-- Sound: Pesos, Consumos, Informe Soundvision, Rigging Plot, Memoria técnica
-- Lights: Pesos, Consumos, Rigging Plot, Memoria técnica (no Informe Soundvision)
-- Video: Pesos, Consumos

insert into public.required_docs (department, key, label, is_required)
values
  ('sound','pesos','Pesos',true),
  ('sound','consumos','Consumos',true),
  ('sound','informe_soundvision','Informe Soundvision',true),
  ('sound','rigging_plot','Rigging Plot',true),
  ('sound','memoria_tecnica','Memoria técnica',true),
  ('lights','pesos','Pesos',true),
  ('lights','consumos','Consumos',true),
  ('lights','rigging_plot','Rigging Plot',true),
  ('lights','memoria_tecnica','Memoria técnica',true),
  ('video','pesos','Pesos',true),
  ('video','consumos','Consumos',true)
on conflict (department, key)
do update set label = excluded.label, is_required = excluded.is_required;

