-- Enable global tasks: allow department task rows with no job_id / tour_id
-- by relaxing the CHECK constraint that currently requires exactly one.
-- Also add created_by and description columns for richer task metadata.

-- 1. Drop the CHECK constraints that require exactly one of job_id/tour_id
ALTER TABLE "public"."sound_job_tasks"
    DROP CONSTRAINT IF EXISTS "sound_job_tasks_source_check";

ALTER TABLE "public"."lights_job_tasks"
    DROP CONSTRAINT IF EXISTS "lights_job_tasks_source_check";

ALTER TABLE "public"."video_job_tasks"
    DROP CONSTRAINT IF EXISTS "video_job_tasks_source_check";

-- 2. Add created_by column (tracks who created the task / assigner)
ALTER TABLE "public"."sound_job_tasks"
    ADD COLUMN IF NOT EXISTS "created_by" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE "public"."lights_job_tasks"
    ADD COLUMN IF NOT EXISTS "created_by" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE "public"."video_job_tasks"
    ADD COLUMN IF NOT EXISTS "created_by" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

-- 3. Add description column (free-text details for global tasks)
ALTER TABLE "public"."sound_job_tasks"
    ADD COLUMN IF NOT EXISTS "description" "text";

ALTER TABLE "public"."lights_job_tasks"
    ADD COLUMN IF NOT EXISTS "description" "text";

ALTER TABLE "public"."video_job_tasks"
    ADD COLUMN IF NOT EXISTS "description" "text";

-- 4. Index created_by for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_sound_job_tasks_created_by" ON "public"."sound_job_tasks" USING "btree" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_lights_job_tasks_created_by" ON "public"."lights_job_tasks" USING "btree" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_video_job_tasks_created_by" ON "public"."video_job_tasks" USING "btree" ("created_by");

-- 5. Prevent both job_id and tour_id from being non-null simultaneously
-- (allows both to be NULL for global tasks, but not both non-null)
ALTER TABLE "public"."sound_job_tasks"
    ADD CONSTRAINT "sound_job_tasks_source_check"
    CHECK (NOT ("job_id" IS NOT NULL AND "tour_id" IS NOT NULL));

ALTER TABLE "public"."lights_job_tasks"
    ADD CONSTRAINT "lights_job_tasks_source_check"
    CHECK (NOT ("job_id" IS NOT NULL AND "tour_id" IS NOT NULL));

ALTER TABLE "public"."video_job_tasks"
    ADD CONSTRAINT "video_job_tasks_source_check"
    CHECK (NOT ("job_id" IS NOT NULL AND "tour_id" IS NOT NULL));

-- 6. Update RLS: allow created_by (assigner) to update their own tasks
-- WITH CHECK prevents assignees from changing created_by to another user.
-- Sound
DROP POLICY IF EXISTS "sound_tasks_creator_update" ON "public"."sound_job_tasks";
CREATE POLICY "sound_tasks_creator_update" ON "public"."sound_job_tasks"
    FOR UPDATE TO "authenticated"
    USING ("created_by" = "auth"."uid"())
    WITH CHECK ("created_by" = "auth"."uid"());

-- Lights
DROP POLICY IF EXISTS "lights_tasks_creator_update" ON "public"."lights_job_tasks";
CREATE POLICY "lights_tasks_creator_update" ON "public"."lights_job_tasks"
    FOR UPDATE TO "authenticated"
    USING ("created_by" = "auth"."uid"())
    WITH CHECK ("created_by" = "auth"."uid"());

-- Video
DROP POLICY IF EXISTS "video_tasks_creator_update" ON "public"."video_job_tasks";
CREATE POLICY "video_tasks_creator_update" ON "public"."video_job_tasks"
    FOR UPDATE TO "authenticated"
    USING ("created_by" = "auth"."uid"())
    WITH CHECK ("created_by" = "auth"."uid"());
