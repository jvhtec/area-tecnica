-- Align sound skills to desired set and deactivate legacy ones

-- Insert desired sound skills if missing
insert into public.skills (name, category, active)
values
  ('foh', 'sound-specialty', true),
  ('monitores', 'sound-specialty', true),
  ('sistemnas', 'sound-specialty', true),
  ('rf', 'sound-specialty', true),
  ('escenario', 'sound-specialty', true),
  ('PA', 'sound-specialty', true)
on conflict (name) do nothing;

-- Deactivate legacy overlapping sound skills
update public.skills set active = false where name in ('mon', 'rf coordination', 'stage patching');

