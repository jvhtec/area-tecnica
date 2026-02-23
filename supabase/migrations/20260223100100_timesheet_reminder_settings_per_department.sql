-- Migration: Make timesheet_reminder_settings department-aware
-- Replaces the single global-row table from the previous migration with
-- one row per department so each department can independently control
-- auto-reminders and reminder frequency.

-- Drop and recreate (table was just created in the previous migration;
-- no production data exists yet on this feature branch).
DROP TABLE IF EXISTS "public"."timesheet_reminder_settings";

CREATE TABLE "public"."timesheet_reminder_settings" (
    "id"                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    "department"               text        NOT NULL,
    "auto_reminders_enabled"   boolean     DEFAULT true  NOT NULL,
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

-- Seed one row per department – all enabled with daily frequency by default
INSERT INTO "public"."timesheet_reminder_settings" ("department", "auto_reminders_enabled", "reminder_frequency_days")
VALUES
    ('sound',          true, 1),
    ('lights',         true, 1),
    ('video',          true, 1),
    ('logistics',      true, 1),
    ('production',     true, 1),
    ('administrative', true, 1)
ON CONFLICT ("department") DO NOTHING;

-- RLS
ALTER TABLE "public"."timesheet_reminder_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trs_select_management" ON "public"."timesheet_reminder_settings"
    FOR SELECT USING (public.is_admin_or_management());

CREATE POLICY "trs_update_management" ON "public"."timesheet_reminder_settings"
    FOR UPDATE USING (public.is_admin_or_management())
    WITH CHECK (public.is_admin_or_management());

GRANT SELECT, UPDATE ON TABLE "public"."timesheet_reminder_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheet_reminder_settings" TO "service_role";

-- Update the pg_cron invoke function (no SQL changes needed – still calls the same
-- edge function; keeping it here as a no-op so migrations are self-documenting).
-- The invoke_auto_timesheet_reminders() function created in the previous migration
-- remains unchanged and correct.
