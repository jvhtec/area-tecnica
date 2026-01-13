-- Enable realtime for logistics tables to support wallboard subscriptions
-- This allows the wallboard public URLs to receive real-time updates when
-- logistics events are created, modified, or deleted.

-- Add tables to the supabase_realtime publication
-- This enables postgres_changes subscriptions for these tables
DO $$
BEGIN
  -- Add logistics_events to realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'logistics_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE logistics_events;
  END IF;

  -- Add logistics_event_departments to realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'logistics_event_departments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE logistics_event_departments;
  END IF;
END $$;

-- Grant SELECT permissions to anon and authenticated roles
-- This is required for realtime subscriptions to work, as subscriptions
-- use the client's authentication context (anon key for public wallboards)
GRANT SELECT ON logistics_events TO anon, authenticated;
GRANT SELECT ON logistics_event_departments TO anon, authenticated;

-- Set REPLICA IDENTITY to FULL for both tables
-- This ensures that UPDATE and DELETE operations send the full row data
-- in realtime notifications, not just the primary key
ALTER TABLE logistics_events REPLICA IDENTITY FULL;
ALTER TABLE logistics_event_departments REPLICA IDENTITY FULL;

-- Add comments for documentation
COMMENT ON TABLE logistics_events IS 'Logistics events for transport and warehouse operations. Realtime enabled for wallboard subscriptions.';
COMMENT ON TABLE logistics_event_departments IS 'Department associations for logistics events. Realtime enabled for wallboard subscriptions.';
