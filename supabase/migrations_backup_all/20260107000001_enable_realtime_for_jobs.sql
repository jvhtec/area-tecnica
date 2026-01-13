-- =============================================================================
-- Enable Realtime for Jobs Table
-- =============================================================================
-- The wallboard relies on realtime updates to refresh when job status changes.
-- This ensures the jobs table is properly configured for Supabase Realtime.
-- =============================================================================

-- Add jobs table to the supabase_realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
  END IF;
END $$;

-- Set REPLICA IDENTITY to FULL for proper realtime updates with RLS
-- This ensures all column values are sent in the change event
ALTER TABLE jobs REPLICA IDENTITY FULL;
