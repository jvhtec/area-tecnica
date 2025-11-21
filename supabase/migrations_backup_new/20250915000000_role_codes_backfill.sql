-- Backfill assignment role fields with new code-based roles where possible
-- Safe to re-run: only updates when fields equal legacy labels

-- Sound mappings
update public.job_assignments
set sound_role = case
  when sound_role in ('FOH Engineer', 'FOH') then 'SND-FOH-R'
  when sound_role in ('Monitor Engineer', 'Monitors') then 'SND-MON-E'
  when sound_role in ('RF Technician', 'RF Tech', 'RF') then 'SND-RF-E'
  when sound_role in ('PA Technician', 'PA Tech', 'PA') then 'SND-PA-T'
  else sound_role
end
where sound_role is not null
  and sound_role not like 'SND-%';

-- Lights mappings
update public.job_assignments
set lights_role = case
  when lights_role in ('Lighting Designer', 'LD', 'Board Op') then 'LGT-BRD-R'
  when lights_role in ('Lighting Technician', 'LX Tech') then 'LGT-PA-T'
  when lights_role in ('Follow Spot', 'Followspot') then 'LGT-FOLO-E'
  when lights_role in ('Rigger') then 'LGT-SYS-E'
  else lights_role
end
where lights_role is not null
  and lights_role not like 'LGT-%';

-- Video mappings
update public.job_assignments
set video_role = case
  when video_role in ('Video Director', 'Director') then 'VID-DIR-E'
  when video_role in ('Video Technician', 'Video Tech') then 'VID-PA-T'
  when video_role in ('Camera Operator', 'Camera') then 'VID-CAM-E'
  when video_role in ('Playback Technician', 'Switcher', 'TD') then 'VID-SW-R'
  else video_role
end
where video_role is not null
  and video_role not like 'VID-%';

-- Note: Unmatched legacy labels remain unchanged and will render as-is in UI.
