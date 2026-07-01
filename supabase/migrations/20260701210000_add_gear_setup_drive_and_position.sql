-- FOH drive/position and MON position now also live on the gear setup
-- tables (global + per-stage), describing which configurations/positions
-- the festival PA and console world actually support, so artist
-- requirements can be checked against them.

alter table public.festival_gear_setups
  add column if not exists foh_drive_options text[] not null default '{}'::text[],
  add column if not exists foh_drive_positions text[] not null default '{}'::text[],
  add column if not exists mon_positions text[] not null default '{}'::text[];

alter table public.festival_stage_gear_setups
  add column if not exists foh_drive_options text[] not null default '{}'::text[],
  add column if not exists foh_drive_positions text[] not null default '{}'::text[],
  add column if not exists mon_positions text[] not null default '{}'::text[];

alter table public.festival_gear_setups
  add constraint festival_gear_setups_foh_drive_options_check
    check (foh_drive_options <@ array['l_r', 'l_r_sub_ff', 'other']::text[]),
  add constraint festival_gear_setups_foh_drive_positions_check
    check (foh_drive_positions <@ array['foh', 'sl', 'sr']::text[]),
  add constraint festival_gear_setups_mon_positions_check
    check (mon_positions <@ array['sl', 'sr']::text[]);

alter table public.festival_stage_gear_setups
  add constraint festival_stage_gear_setups_foh_drive_options_check
    check (foh_drive_options <@ array['l_r', 'l_r_sub_ff', 'other']::text[]),
  add constraint festival_stage_gear_setups_foh_drive_positions_check
    check (foh_drive_positions <@ array['foh', 'sl', 'sr']::text[]),
  add constraint festival_stage_gear_setups_mon_positions_check
    check (mon_positions <@ array['sl', 'sr']::text[]);

comment on column public.festival_gear_setups.foh_drive_options is
  'FOH system drive configurations the festival PA supports: l_r, l_r_sub_ff, other. Multiple selection allowed.';
comment on column public.festival_gear_setups.foh_drive_positions is
  'Physical positions the FOH drive rack can be set up at: foh, sl, sr. Multiple selection allowed.';
comment on column public.festival_gear_setups.mon_positions is
  'Physical positions the monitor console can be set up at: sl, sr. Multiple selection allowed.';
