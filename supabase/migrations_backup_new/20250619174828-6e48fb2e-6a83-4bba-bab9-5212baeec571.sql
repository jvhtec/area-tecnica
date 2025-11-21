
-- First, create a temporary table to store the latest setups for each job
CREATE TEMP TABLE consolidated_gear_setups AS
SELECT DISTINCT ON (job_id) 
  job_id,
  id,
  max_stages,
  foh_consoles,
  mon_consoles,
  wireless_systems,
  iem_systems,
  available_monitors,
  has_side_fills,
  has_drum_fills,
  has_dj_booths,
  available_cat6_runs,
  available_hma_runs,
  available_coax_runs,
  available_analog_runs,
  available_opticalcon_duo_runs,
  other_infrastructure,
  extras_wired,
  notes
FROM festival_gear_setups
ORDER BY job_id, created_at DESC;

-- Delete all existing gear setups
DELETE FROM festival_gear_setups;

-- Remove the date column and update the table structure
ALTER TABLE festival_gear_setups DROP COLUMN date;

-- Update the unique constraint to be based only on job_id
DROP INDEX IF EXISTS festival_gear_setups_job_id_date_key;
ALTER TABLE festival_gear_setups ADD CONSTRAINT festival_gear_setups_job_id_key UNIQUE (job_id);

-- Re-insert the consolidated data (without date column)
INSERT INTO festival_gear_setups (
  job_id,
  max_stages,
  foh_consoles,
  mon_consoles,
  wireless_systems,
  iem_systems,
  available_monitors,
  has_side_fills,
  has_drum_fills,
  has_dj_booths,
  available_cat6_runs,
  available_hma_runs,
  available_coax_runs,
  available_analog_runs,
  available_opticalcon_duo_runs,
  other_infrastructure,
  extras_wired,
  notes,
  created_at,
  updated_at
)
SELECT 
  job_id,
  max_stages,
  foh_consoles,
  mon_consoles,
  wireless_systems,
  iem_systems,
  available_monitors,
  has_side_fills,
  has_drum_fills,
  has_dj_booths,
  available_cat6_runs,
  available_hma_runs,
  available_coax_runs,
  available_analog_runs,
  available_opticalcon_duo_runs,
  other_infrastructure,
  extras_wired,
  notes,
  now(),
  now()
FROM consolidated_gear_setups;
