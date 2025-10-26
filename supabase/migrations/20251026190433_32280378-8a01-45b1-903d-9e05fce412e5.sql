-- Step 1: Make job_id nullable in all task tables
ALTER TABLE sound_job_tasks ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE lights_job_tasks ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE video_job_tasks ALTER COLUMN job_id DROP NOT NULL;

-- Step 2: Add tour_id column to all task tables
ALTER TABLE sound_job_tasks ADD COLUMN tour_id uuid REFERENCES tours(id) ON DELETE CASCADE;
ALTER TABLE lights_job_tasks ADD COLUMN tour_id uuid REFERENCES tours(id) ON DELETE CASCADE;
ALTER TABLE video_job_tasks ADD COLUMN tour_id uuid REFERENCES tours(id) ON DELETE CASCADE;

-- Step 3: Add check constraints (must have job_id OR tour_id, not both)
ALTER TABLE sound_job_tasks ADD CONSTRAINT sound_job_tasks_source_check 
  CHECK ((job_id IS NOT NULL AND tour_id IS NULL) OR (job_id IS NULL AND tour_id IS NOT NULL));

ALTER TABLE lights_job_tasks ADD CONSTRAINT lights_job_tasks_source_check 
  CHECK ((job_id IS NOT NULL AND tour_id IS NULL) OR (job_id IS NULL AND tour_id IS NOT NULL));

ALTER TABLE video_job_tasks ADD CONSTRAINT video_job_tasks_source_check 
  CHECK ((job_id IS NOT NULL AND tour_id IS NULL) OR (job_id IS NULL AND tour_id IS NOT NULL));

-- Step 4: Add RLS policies for tour tasks
-- Sound tour tasks
CREATE POLICY "Tour participants can view sound tour tasks" ON sound_job_tasks
  FOR SELECT USING (
    tour_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tour_assignments
      WHERE tour_id = sound_job_tasks.tour_id
      AND technician_id = auth.uid()
    )
  );

CREATE POLICY "Management can manage sound tour tasks" ON sound_job_tasks
  FOR ALL USING (
    tour_id IS NOT NULL AND get_current_user_role() IN ('admin', 'management', 'logistics')
  );

-- Lights tour tasks
CREATE POLICY "Tour participants can view lights tour tasks" ON lights_job_tasks
  FOR SELECT USING (
    tour_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tour_assignments
      WHERE tour_id = lights_job_tasks.tour_id
      AND technician_id = auth.uid()
    )
  );

CREATE POLICY "Management can manage lights tour tasks" ON lights_job_tasks
  FOR ALL USING (
    tour_id IS NOT NULL AND get_current_user_role() IN ('admin', 'management', 'logistics')
  );

-- Video tour tasks
CREATE POLICY "Tour participants can view video tour tasks" ON video_job_tasks
  FOR SELECT USING (
    tour_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tour_assignments
      WHERE tour_id = video_job_tasks.tour_id
      AND technician_id = auth.uid()
    )
  );

CREATE POLICY "Management can manage video tour tasks" ON video_job_tasks
  FOR ALL USING (
    tour_id IS NOT NULL AND get_current_user_role() IN ('admin', 'management', 'logistics')
  );