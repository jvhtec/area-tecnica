-- Fix user deletion (codebase audit follow-up):
--
-- Deleting a user via auth.admin.deleteUser() cascades auth.users -> profiles
-- (profiles_id_fkey is ON DELETE CASCADE), but dozens of foreign keys that
-- reference profiles(id) or auth.users(id) were created WITHOUT an ON DELETE
-- action, so they default to NO ACTION (RESTRICT). As soon as a user has done
-- anything real -- sent a message, uploaded a document, created a preset, set a
-- payout override, been assigned a task, etc. -- the cascade is blocked and the
-- deletion fails. This is why "delete user" does not work.
--
-- This migration normalizes the ON DELETE behavior of every such constraint:
--   * Attribution / audit columns (created_by, updated_by, uploaded_by,
--     approved_by, rejected_by, resolved_by, reviewed_by, processed_by,
--     assigned_by, set_by, completed_by, assigned_to, last_modified_by, ...)
--     -> SET NULL: keep the record, clear the now-meaningless reference.
--   * User-owned operational rows (messages, direct messages, assignment
--     notifications, the user's own work records) -> CASCADE, consistent with
--     the existing intent (timesheets, job_assignments, tour_assignments already
--     cascade on user deletion).
--
-- Implemented with a session-local helper that looks the FK up by column, so it
-- is robust to constraint naming and to which migration originally defined it.
-- Missing tables/columns are skipped, so the migration is safe to run on any
-- environment.

CREATE OR REPLACE FUNCTION pg_temp.fix_user_fk(
  p_table       text,
  p_column      text,
  p_ref_table   text,   -- 'profiles' (public) or 'users' (auth)
  p_ref_schema  text,
  p_action      text    -- 'SET NULL' or 'CASCADE'
) RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_conname text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) THEN
    RAISE NOTICE 'fix_user_fk: skip public.%.% (missing column)', p_table, p_column;
    RETURN;
  END IF;

  -- Find the FK constraint on public.<p_table>(<p_column>) -> <ref schema>.<ref table>
  SELECT con.conname INTO v_conname
  FROM pg_constraint con
  JOIN pg_class      rel  ON rel.oid  = con.conrelid
  JOIN pg_namespace  nsp  ON nsp.oid  = rel.relnamespace
  JOIN pg_class      frel ON frel.oid = con.confrelid
  JOIN pg_namespace  fnsp ON fnsp.oid = frel.relnamespace
  WHERE con.contype = 'f'
    AND nsp.nspname  = 'public'
    AND rel.relname  = p_table
    AND fnsp.nspname = p_ref_schema
    AND frel.relname = p_ref_table
    AND (
      SELECT array_agg(att.attname::text ORDER BY u.ord)
      FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
    ) = ARRAY[p_column]
  LIMIT 1;

  IF v_conname IS NULL THEN
    RAISE NOTICE 'fix_user_fk: no FK on public.%.% -> %.% (skip)', p_table, p_column, p_ref_schema, p_ref_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', p_table, v_conname);

  IF upper(p_action) = 'SET NULL' THEN
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', p_table, p_column);
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(id) ON DELETE %s',
    p_table, v_conname, p_column, p_ref_schema, p_ref_table, upper(p_action)
  );

  RAISE NOTICE 'fix_user_fk: public.%.% -> %.% now ON DELETE %', p_table, p_column, p_ref_schema, p_ref_table, upper(p_action);
END;
$fn$;

DO $$
BEGIN
  -- ===================== references to auth.users =====================
  -- Attribution columns -> SET NULL
  PERFORM pg_temp.fix_user_fk('bug_reports',            'created_by',  'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('bug_reports',            'resolved_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('day_preset_assignments', 'assigned_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('feature_requests',       'created_by',  'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('festival_logos',         'uploaded_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('hoja_de_ruta',           'approved_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('hoja_de_ruta',           'created_by',  'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('hoja_de_ruta_templates', 'created_by',  'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('job_documents',          'uploaded_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('job_stage_plots',        'created_by',  'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('presets',                'created_by',  'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('soundvision_files',      'uploaded_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('sub_rentals',            'created_by',  'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('technician_work_records','reviewed_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('tour_documents',         'uploaded_by', 'users', 'auth', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('tour_logos',             'uploaded_by', 'users', 'auth', 'SET NULL');
  -- User-owned data -> CASCADE
  PERFORM pg_temp.fix_user_fk('technician_work_records','technician_id', 'users', 'auth', 'CASCADE');

  -- ===================== references to public.profiles =====================
  -- Attribution columns -> SET NULL
  PERFORM pg_temp.fix_user_fk('announcements',                  'created_by',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('availability_conflicts',         'resolved_by',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('festival_artist_files',          'uploaded_by',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('flex_status_log',                'processed_by',    'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('hoja_de_ruta',                   'last_modified_by','profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('hoja_de_ruta_rooms',             'staff_member1_id','profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('hoja_de_ruta_rooms',             'staff_member2_id','profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('job_milestones',                 'completed_by',    'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('job_technician_payout_overrides','set_by',          'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('lights_job_tasks',               'assigned_to',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('lights_job_tasks',               'completed_by',    'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('sound_job_tasks',                'assigned_to',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('sound_job_tasks',                'completed_by',    'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('video_job_tasks',                'assigned_to',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('video_job_tasks',                'completed_by',    'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('administrative_job_tasks',       'assigned_to',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('administrative_job_tasks',       'completed_by',    'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('production_job_tasks',           'assigned_to',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('production_job_tasks',           'completed_by',    'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('task_documents',                 'uploaded_by',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('timesheet_audit_log',            'user_id',         'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('timesheets',                     'rejected_by',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('tour_accommodations',            'created_by',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('tour_assignments',               'assigned_by',     'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('tour_schedule_templates',        'created_by',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('tour_timeline_events',           'created_by',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('tour_travel_segments',           'created_by',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('staffing_campaigns',             'created_by',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('staffing_campaign_events',       'profile_id',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('job_technician_rate_mode_dates', 'created_by',      'profiles', 'public', 'SET NULL');
  PERFORM pg_temp.fix_user_fk('job_technician_rate_mode_dates', 'updated_by',      'profiles', 'public', 'SET NULL');
  -- User-owned data -> CASCADE
  PERFORM pg_temp.fix_user_fk('assignment_notifications',       'technician_id',   'profiles', 'public', 'CASCADE');
  PERFORM pg_temp.fix_user_fk('direct_messages',               'sender_id',       'profiles', 'public', 'CASCADE');
  PERFORM pg_temp.fix_user_fk('direct_messages',               'recipient_id',    'profiles', 'public', 'CASCADE');
  PERFORM pg_temp.fix_user_fk('messages',                       'sender_id',       'profiles', 'public', 'CASCADE');
END $$;
