-- Create function to wake up campaign when staffing_requests status changes
CREATE OR REPLACE FUNCTION trigger_campaign_wake_up()
RETURNS TRIGGER AS $$
BEGIN
  -- Update campaign's next_run_at to now when a staffing_request status changes
  UPDATE staffing_campaigns
  SET next_run_at = now(),
      updated_at = now()
  WHERE job_id = NEW.job_id
    AND status = 'active'
    AND (NEW.status = 'confirmed' OR NEW.status = 'declined');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on staffing_requests table
DROP TRIGGER IF EXISTS staffing_requests_status_change ON staffing_requests;

CREATE TRIGGER staffing_requests_status_change
AFTER UPDATE OF status ON staffing_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_campaign_wake_up();
