insert into public.activity_catalog (
  code,
  label,
  default_visibility,
  severity,
  toast_enabled,
  template
)
values
  (
    'festival.public_form.submitted',
    'Public artist form submitted',
    'management',
    'success',
    true,
    '{artist_name} submitted public artist form'
  ),
  (
    'festival.public_rider.uploaded',
    'Public rider uploaded',
    'management',
    'info',
    true,
    '{artist_name} uploaded public rider'
  )
on conflict (code) do update
set
  label = excluded.label,
  default_visibility = excluded.default_visibility,
  severity = excluded.severity,
  toast_enabled = excluded.toast_enabled,
  template = excluded.template;
