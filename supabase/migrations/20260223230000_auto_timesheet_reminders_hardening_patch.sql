-- Migration: Auto timesheet reminders hardening patch
-- Purpose: align production objects with latest reviewed behavior without
-- re-running the original feature-introduction migrations.

-- Canonical updated_at helper with fixed search_path.
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

-- Ensure reminder settings table constraints/columns are hardened.
ALTER TABLE IF EXISTS "public"."timesheet_reminder_settings"
    ALTER COLUMN "updated_at" SET DEFAULT now(),
    ALTER COLUMN "updated_at" SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'timesheet_reminder_settings'
          AND column_name = 'reminder_frequency_days'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'positive_frequency'
          AND conrelid = 'public.timesheet_reminder_settings'::regclass
    ) THEN
        ALTER TABLE "public"."timesheet_reminder_settings"
            ADD CONSTRAINT "positive_frequency" CHECK ("reminder_frequency_days" >= 1);
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS "trg_timesheet_reminder_settings_updated_at" ON "public"."timesheet_reminder_settings";
CREATE TRIGGER "trg_timesheet_reminder_settings_updated_at"
    BEFORE UPDATE ON "public"."timesheet_reminder_settings"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_updated_at"();

-- Ensure reminder counter column exists and is non-null/defaulted.
ALTER TABLE IF EXISTS "public"."timesheets"
    ADD COLUMN IF NOT EXISTS "auto_reminder_count" integer DEFAULT 0;

UPDATE "public"."timesheets"
SET "auto_reminder_count" = 0
WHERE "auto_reminder_count" IS NULL;

ALTER TABLE IF EXISTS "public"."timesheets"
    ALTER COLUMN "auto_reminder_count" SET DEFAULT 0,
    ALTER COLUMN "auto_reminder_count" SET NOT NULL;

COMMENT ON COLUMN "public"."timesheets"."auto_reminder_count" IS
  'Number of automatic reminder emails sent for this timesheet. Incremented by the auto-send-timesheet-reminders edge function.';

-- Atomic metadata update helper used by auto-send-timesheet-reminders.
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

-- Current invoke function (per-department enabled check).
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
    SELECT * INTO cfg FROM push_cron_config WHERE id = 1;

    IF cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
        RAISE WARNING '[auto_timesheet_reminders] push_cron_config not configured – skipping.';
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM timesheet_reminder_settings WHERE auto_reminders_enabled = true
    ) INTO any_enabled;

    IF NOT any_enabled THEN
        RAISE LOG '[auto_timesheet_reminders] All department reminders disabled – skipping.';
        RETURN;
    END IF;

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

ALTER FUNCTION "public"."invoke_auto_timesheet_reminders"() OWNER TO "postgres";
COMMENT ON FUNCTION "public"."invoke_auto_timesheet_reminders"() IS
  'Invoked daily by pg_cron to trigger the auto-send-timesheet-reminders edge function.';
GRANT EXECUTE ON FUNCTION "public"."invoke_auto_timesheet_reminders"() TO "service_role";

-- Schedule daily at 10:00 UTC. Skip safely when pg_cron is unavailable.
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
