-- Migration: Auto Timesheet Reminders
-- Creates settings table, tracking column, pg_cron schedule, and invoke function.

-- 1. Global settings table for auto-reminder configuration
CREATE TABLE IF NOT EXISTS "public"."timesheet_reminder_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "auto_reminders_enabled" boolean DEFAULT true NOT NULL,
    "reminder_frequency_days" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "timesheet_reminder_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "single_row" CHECK ("id" = 1),
    CONSTRAINT "positive_frequency" CHECK ("reminder_frequency_days" >= 1)
);

COMMENT ON TABLE "public"."timesheet_reminder_settings" IS
  'Global configuration for automatic timesheet reminder emails. Single-row table (id=1).';
COMMENT ON COLUMN "public"."timesheet_reminder_settings"."auto_reminders_enabled" IS
  'When true, the daily pg_cron job sends reminder emails to techs with pending (draft) timesheets for completed jobs.';
COMMENT ON COLUMN "public"."timesheet_reminder_settings"."reminder_frequency_days" IS
  'Minimum number of days between consecutive auto-reminders for the same timesheet.';

-- Seed with defaults
INSERT INTO "public"."timesheet_reminder_settings" ("id", "auto_reminders_enabled", "reminder_frequency_days")
VALUES (1, true, 1)
ON CONFLICT ("id") DO NOTHING;

-- Keep the canonical implementation in sync for all updated_at triggers.
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Keep updated_at accurate on every row update.
DROP TRIGGER IF EXISTS "trg_timesheet_reminder_settings_updated_at" ON "public"."timesheet_reminder_settings";
CREATE TRIGGER "trg_timesheet_reminder_settings_updated_at"
    BEFORE UPDATE ON "public"."timesheet_reminder_settings"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_updated_at"();

-- RLS
ALTER TABLE "public"."timesheet_reminder_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trs_select_management" ON "public"."timesheet_reminder_settings"
    FOR SELECT USING (public.is_admin_or_management());

CREATE POLICY "trs_update_admin" ON "public"."timesheet_reminder_settings"
    FOR UPDATE USING (public.is_admin_or_management())
    WITH CHECK (public.is_admin_or_management());

-- Grant access
GRANT SELECT, UPDATE ON TABLE "public"."timesheet_reminder_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheet_reminder_settings" TO "service_role";

-- 2. Add auto_reminder_count to timesheets to track how many auto-emails were sent
ALTER TABLE "public"."timesheets"
    ADD COLUMN IF NOT EXISTS "auto_reminder_count" integer DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "public"."timesheets"."auto_reminder_count" IS
  'Number of automatic reminder emails sent for this timesheet. Incremented by the auto-send-timesheet-reminders edge function.';

-- 3. Atomic metadata update helper used by auto-send-timesheet-reminders
CREATE OR REPLACE FUNCTION "public"."mark_timesheet_auto_reminder_sent"(
    "row_id" uuid,
    "sent_at" timestamp with time zone
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE "public"."timesheets"
    SET
        "reminder_sent_at" = sent_at,
        "auto_reminder_count" = "auto_reminder_count" + 1
    WHERE "id" = row_id;

    RETURN FOUND;
END;
$$;

ALTER FUNCTION "public"."mark_timesheet_auto_reminder_sent"(uuid, timestamp with time zone) OWNER TO "postgres";
COMMENT ON FUNCTION "public"."mark_timesheet_auto_reminder_sent"(uuid, timestamp with time zone) IS
  'Atomically records that an auto-reminder was sent for a timesheet: sets reminder_sent_at and increments auto_reminder_count. Returns TRUE if the row was found and updated.';
GRANT EXECUTE ON FUNCTION "public"."mark_timesheet_auto_reminder_sent"(uuid, timestamp with time zone) TO "service_role";

-- 4. PostgreSQL function called by pg_cron to invoke the edge function via pg_net
CREATE OR REPLACE FUNCTION "public"."invoke_auto_timesheet_reminders"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    cfg push_cron_config%ROWTYPE;
    settings timesheet_reminder_settings%ROWTYPE;
    request_id bigint;
BEGIN
    -- Load push_cron_config (shared with push notifications)
    SELECT * INTO cfg FROM push_cron_config WHERE id = 1;

    IF cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
        RAISE WARNING '[auto_timesheet_reminders] push_cron_config not configured – skipping.';
        RETURN;
    END IF;

    -- Check global setting
    SELECT * INTO settings FROM timesheet_reminder_settings WHERE id = 1;
    IF NOT FOUND OR NOT settings.auto_reminders_enabled THEN
        RAISE LOG '[auto_timesheet_reminders] Auto-reminders disabled – skipping.';
        RETURN;
    END IF;

    -- Fire the edge function asynchronously via pg_net
    SELECT net.http_post(
        url           := cfg.supabase_url || '/functions/v1/auto-send-timesheet-reminders',
        headers       := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || cfg.service_role_key
        ),
        body          := jsonb_build_object('triggered_by', 'pg_cron'),
        timeout_milliseconds := 55000
    ) INTO request_id;

    RAISE LOG '[auto_timesheet_reminders] Invoked edge function, net request_id=%', request_id;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[auto_timesheet_reminders] Failed to invoke edge function: %', SQLERRM;
END;
$$;

ALTER FUNCTION "public"."invoke_auto_timesheet_reminders"() OWNER TO "postgres";
COMMENT ON FUNCTION "public"."invoke_auto_timesheet_reminders"() IS
  'Invoked daily by pg_cron to trigger the auto-send-timesheet-reminders edge function.';

GRANT EXECUTE ON FUNCTION "public"."invoke_auto_timesheet_reminders"() TO "service_role";

-- 5. Schedule daily at 10:00 UTC (11:00 Madrid CET / 12:00 CEST)
-- Prerequisite: pg_cron extension must be installed (schema "cron" available).
-- Unschedule any existing job first to avoid duplicates on re-runs.
-- Use a DO block so cron.unschedule() is guaranteed to execute when the job
-- exists – a bare "SELECT fn() WHERE EXISTS ..." can be silently skipped by
-- the planner if it treats the SELECT as returning no rows.
DO $$
BEGIN
    IF to_regnamespace('cron') IS NULL THEN
        RAISE WARNING '[auto_timesheet_reminders] pg_cron is not installed; skipping schedule setup.';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-timesheet-reminders') THEN
        PERFORM cron.unschedule('auto-timesheet-reminders');
    END IF;

    PERFORM cron.schedule(
        'auto-timesheet-reminders',
        '0 10 * * *',
        'SELECT public.invoke_auto_timesheet_reminders()'
    );
END;
$$;
