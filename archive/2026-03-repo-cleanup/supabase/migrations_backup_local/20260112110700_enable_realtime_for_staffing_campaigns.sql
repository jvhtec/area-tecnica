-- Enable Realtime for staffing campaign tables used by the matrix UI.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'staffing_campaigns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staffing_campaigns;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'staffing_campaign_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staffing_campaign_roles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'staffing_campaign_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staffing_campaign_events;
  END IF;
END $$;

ALTER TABLE staffing_campaigns REPLICA IDENTITY FULL;
ALTER TABLE staffing_campaign_roles REPLICA IDENTITY FULL;
ALTER TABLE staffing_campaign_events REPLICA IDENTITY FULL;

