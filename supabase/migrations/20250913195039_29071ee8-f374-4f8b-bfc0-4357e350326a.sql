-- Enable realtime for staffing base tables (not the view)
ALTER PUBLICATION supabase_realtime ADD TABLE staffing_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE staffing_events;

-- Set REPLICA IDENTITY FULL to ensure complete row data is captured
ALTER TABLE staffing_requests REPLICA IDENTITY FULL;
ALTER TABLE staffing_events REPLICA IDENTITY FULL;