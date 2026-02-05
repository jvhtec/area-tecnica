-- Global Tasks table
-- Unlike department-specific task tables, global tasks do NOT require a job_id or tour_id.
-- They can optionally be linked to a job or tour at any point.

CREATE TABLE IF NOT EXISTS "public"."global_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "job_id" "uuid",
    "tour_id" "uuid",
    "department" "text",
    "assigned_to" "uuid",
    "created_by" "uuid",
    "status" "public"."task_status" DEFAULT 'not_started'::"public"."task_status",
    "priority" integer,
    "progress" integer DEFAULT 0,
    "due_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "completion_source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "global_tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE ONLY "public"."global_tasks" REPLICA IDENTITY FULL;
ALTER TABLE "public"."global_tasks" OWNER TO "postgres";

-- Foreign keys
ALTER TABLE ONLY "public"."global_tasks"
    ADD CONSTRAINT "global_tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."global_tasks"
    ADD CONSTRAINT "global_tasks_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."global_tasks"
    ADD CONSTRAINT "global_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."global_tasks"
    ADD CONSTRAINT "global_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."global_tasks"
    ADD CONSTRAINT "global_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

-- Indexes
CREATE INDEX "idx_global_tasks_job_id" ON "public"."global_tasks" USING "btree" ("job_id");
CREATE INDEX "idx_global_tasks_tour_id" ON "public"."global_tasks" USING "btree" ("tour_id");
CREATE INDEX "idx_global_tasks_assigned_to" ON "public"."global_tasks" USING "btree" ("assigned_to");
CREATE INDEX "idx_global_tasks_created_by" ON "public"."global_tasks" USING "btree" ("created_by");
CREATE INDEX "idx_global_tasks_status" ON "public"."global_tasks" USING "btree" ("status");

-- Add global_task_id to task_documents for attachment support
ALTER TABLE "public"."task_documents"
    ADD COLUMN IF NOT EXISTS "global_task_id" "uuid";

ALTER TABLE ONLY "public"."task_documents"
    ADD CONSTRAINT "task_documents_global_task_id_fkey" FOREIGN KEY ("global_task_id") REFERENCES "public"."global_tasks"("id") ON DELETE CASCADE;

CREATE INDEX "idx_task_documents_global_task_id" ON "public"."task_documents" USING "btree" ("global_task_id");

-- RLS policies
ALTER TABLE "public"."global_tasks" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all global tasks
CREATE POLICY "global_tasks_select_policy" ON "public"."global_tasks"
    FOR SELECT TO "authenticated"
    USING (true);

-- Allow admin/management/logistics/house_tech to insert global tasks
CREATE POLICY "global_tasks_insert_policy" ON "public"."global_tasks"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."profiles"
            WHERE "profiles"."id" = "auth"."uid"()
            AND "profiles"."role" IN ('admin', 'management', 'logistics', 'house_tech')
        )
    );

-- Allow admin/management/logistics/house_tech to update any global task;
-- also allow assigned users or the task creator (assigner) to update
CREATE POLICY "global_tasks_update_policy" ON "public"."global_tasks"
    FOR UPDATE TO "authenticated"
    USING (
        "assigned_to" = "auth"."uid"()
        OR "created_by" = "auth"."uid"()
        OR EXISTS (
            SELECT 1 FROM "public"."profiles"
            WHERE "profiles"."id" = "auth"."uid"()
            AND "profiles"."role" IN ('admin', 'management', 'logistics', 'house_tech')
        )
    );

-- Allow admin/management/logistics/house_tech to delete global tasks
CREATE POLICY "global_tasks_delete_policy" ON "public"."global_tasks"
    FOR DELETE TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."profiles"
            WHERE "profiles"."id" = "auth"."uid"()
            AND "profiles"."role" IN ('admin', 'management', 'logistics', 'house_tech')
        )
    );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."global_tasks";
