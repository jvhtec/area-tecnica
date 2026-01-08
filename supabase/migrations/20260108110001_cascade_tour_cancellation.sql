-- Fix existing: Update jobs from cancelled tours to Cancelado
UPDATE jobs 
SET status = 'Cancelado'
WHERE tour_id IN (
  SELECT id FROM tours WHERE status = 'cancelled'
)
AND status != 'Cancelado';

-- Create trigger to cascade tour cancellation to jobs
CREATE OR REPLACE FUNCTION cascade_tour_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE jobs 
    SET status = 'Cancelado'
    WHERE tour_id = NEW.id
    AND status != 'Cancelado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_tour_cancellation ON tours;
CREATE TRIGGER trigger_cascade_tour_cancellation
  AFTER UPDATE OF status ON tours
  FOR EACH ROW
  EXECUTE FUNCTION cascade_tour_cancellation();
