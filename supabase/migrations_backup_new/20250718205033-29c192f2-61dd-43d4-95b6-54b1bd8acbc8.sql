-- Function to update tour start and end dates based on tour_dates
CREATE OR REPLACE FUNCTION update_tour_dates()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE tours 
  SET 
    start_date = subquery.min_date,
    end_date = subquery.max_date
  FROM (
    SELECT 
      tour_id,
      MIN(start_date) as min_date,
      MAX(end_date) as max_date
    FROM tour_dates 
    WHERE tour_id IS NOT NULL
    GROUP BY tour_id
  ) as subquery
  WHERE tours.id = subquery.tour_id;
END;
$$;

-- Update existing tours with their calculated start/end dates
SELECT update_tour_dates();

-- Function to automatically update tour dates when tour_dates change
CREATE OR REPLACE FUNCTION sync_tour_start_end_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the tour's start_date and end_date based on all its tour_dates
  UPDATE tours 
  SET 
    start_date = (
      SELECT MIN(start_date) 
      FROM tour_dates 
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
    ),
    end_date = (
      SELECT MAX(end_date) 
      FROM tour_dates 
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
    )
  WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers to automatically sync tour dates
DROP TRIGGER IF EXISTS sync_tour_dates_on_insert ON tour_dates;
CREATE TRIGGER sync_tour_dates_on_insert
  AFTER INSERT ON tour_dates
  FOR EACH ROW
  EXECUTE FUNCTION sync_tour_start_end_dates();

DROP TRIGGER IF EXISTS sync_tour_dates_on_update ON tour_dates;
CREATE TRIGGER sync_tour_dates_on_update
  AFTER UPDATE ON tour_dates
  FOR EACH ROW
  EXECUTE FUNCTION sync_tour_start_end_dates();

DROP TRIGGER IF EXISTS sync_tour_dates_on_delete ON tour_dates;
CREATE TRIGGER sync_tour_dates_on_delete
  AFTER DELETE ON tour_dates
  FOR EACH ROW
  EXECUTE FUNCTION sync_tour_start_end_dates();