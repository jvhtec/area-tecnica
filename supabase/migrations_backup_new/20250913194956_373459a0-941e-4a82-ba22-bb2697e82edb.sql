-- Enable realtime for staffing tables
ALTER PUBLICATION supabase_realtime ADD TABLE staffing_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE assignment_matrix_staffing;

-- Set REPLICA IDENTITY FULL to ensure complete row data is captured
ALTER TABLE staffing_requests REPLICA IDENTITY FULL;
ALTER TABLE assignment_matrix_staffing REPLICA IDENTITY FULL;