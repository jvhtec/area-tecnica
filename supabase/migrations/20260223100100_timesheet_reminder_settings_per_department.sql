-- Migration: Make timesheet_reminder_settings department-aware
-- Replaces the single global-row table from the previous migration with
-- one row per department so each department can independently control
-- auto-reminders and reminder frequency.

-- The previous migration declared invoke_auto_timesheet_reminders() with a
-- `settings timesheet_reminder_settings%ROWTYPE` variable, which creates a
-- PostgreSQL type-dependency on the table.  We must replace the function
-- (removing that dependency) BEFORE dropping the table; otherwise DROP TABLE
-- fails with "cannot drop table … because other objects depend on it".
CREATE OR REPLACE FUNCTION "public"."invoke_auto_timesheet_reminders"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    cfg         push_cron_config%ROWTYPE;
    any_enabled boolean;
    request_id  bigint;
BEGIN
    -- Load pg_net / edge-function config
    SELECT * INTO cfg FROM push_cron_config WHERE id = 1;

    IF cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
        RAISE WARNING '[auto_timesheet_reminders] push_cron_config not configured – skipping.';
        RETURN;
    END IF;

    -- Check whether any department still has auto-reminders enabled
    SELECT EXISTS (
        SELECT 1 FROM timesheet_reminder_settings WHERE auto_reminders_enabled = true
    ) INTO any_enabled;

    IF NOT any_enabled THEN
        RAISE LOG '[auto_timesheet_reminders] All department reminders disabled – skipping.';
        RETURN;
    END IF;

    -- Fire the edge function asynchronously via pg_net
    SELECT net.http_post(
        url                  := cfg.supabase_url || '/functions/v1/auto-send-timesheet-reminders',
        headers              := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || cfg.service_role_key
        ),
        body                 := jsonb_build_object('triggered_by', 'pg_cron'),
        timeout_milliseconds := 55000
    ) INTO request_id;

    RAISE LOG '[auto_timesheet_reminders] Invoked edge function, net request_id=%', request_id;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[auto_timesheet_reminders] Failed to invoke edge function: %', SQLERRM;
END;
$$;

-- Now safe to drop: the %ROWTYPE dependency has been removed above.
DROP TABLE IF EXISTS "public"."timesheet_reminder_settings";

CREATE TABLE "public"."timesheet_reminder_settings" (
    "id"                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    "department"               text        NOT NULL,
    "auto_reminders_enabled"   boolean     DEFAULT false NOT NULL,
    "reminder_frequency_days"  integer     DEFAULT 1     NOT NULL,
    "updated_at"               timestamp with time zone DEFAULT now(),
    CONSTRAINT "unique_department" UNIQUE ("department")
);

COMMENT ON TABLE  "public"."timesheet_reminder_settings" IS
  'Per-department configuration for automatic timesheet reminder emails.';
COMMENT ON COLUMN "public"."timesheet_reminder_settings"."department" IS
  'One of: sound, lights, video, logistics, production, administrative.';
COMMENT ON COLUMN "public"."timesheet_reminder_settings"."auto_reminders_enabled" IS
  'When true, daily pg_cron sends reminder emails to techs of this department with pending (draft) timesheets for completed jobs.';
COMMENT ON COLUMN "public"."timesheet_reminder_settings"."reminder_frequency_days" IS
  'Minimum number of days between consecutive auto-reminders for the same timesheet (per department).';

-- Seed rows for the two departments that use auto-reminders.
INSERT INTO "public"."timesheet_reminder_settings" ("department", "auto_reminders_enabled", "reminder_frequency_days")
VALUES
    ('sound',  true, 1),
    ('lights', true, 1)
ON CONFLICT ("department") DO NOTHING;

-- RLS
ALTER TABLE "public"."timesheet_reminder_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trs_select_management" ON "public"."timesheet_reminder_settings"
    FOR SELECT USING (public.is_admin_or_management());

CREATE POLICY "trs_insert_management" ON "public"."timesheet_reminder_settings"
    FOR INSERT WITH CHECK (public.is_admin_or_management());

CREATE POLICY "trs_update_management" ON "public"."timesheet_reminder_settings"
    FOR UPDATE USING (public.is_admin_or_management())
    WITH CHECK (public.is_admin_or_management());

GRANT SELECT, INSERT, UPDATE ON TABLE "public"."timesheet_reminder_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheet_reminder_settings" TO "service_role";

-- invoke_auto_timesheet_reminders() was updated at the top of this migration.
