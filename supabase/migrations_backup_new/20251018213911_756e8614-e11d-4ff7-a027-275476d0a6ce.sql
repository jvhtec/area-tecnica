-- Fix existing inconsistent data in jobs table
-- Update jobs table to reflect actual folder existence
UPDATE jobs j
SET flex_folders_created = TRUE
WHERE EXISTS (
  SELECT 1 FROM flex_folders ff 
  WHERE ff.job_id = j.id
)
AND (j.flex_folders_created = FALSE OR j.flex_folders_created IS NULL);

-- Fix jobs that claim to have folders but don't
UPDATE jobs j
SET flex_folders_created = FALSE
WHERE j.flex_folders_created = TRUE
AND NOT EXISTS (
  SELECT 1 FROM flex_folders ff 
  WHERE ff.job_id = j.id
);

-- Function to automatically update job's flex_folders_created flag
CREATE OR REPLACE FUNCTION update_job_flex_folders_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: mark folders as created
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs 
    SET flex_folders_created = TRUE
    WHERE id = NEW.job_id;
    RETURN NEW;
  END IF;
  
  -- On DELETE: check if any folders remain
  IF TG_OP = 'DELETE' THEN
    UPDATE jobs 
    SET flex_folders_created = CASE 
      WHEN EXISTS (SELECT 1 FROM flex_folders WHERE job_id = OLD.job_id) THEN TRUE 
      ELSE FALSE 
    END
    WHERE id = OLD.job_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_flex_folders_update_job ON flex_folders;

-- Create trigger to maintain consistency
CREATE TRIGGER trg_flex_folders_update_job
AFTER INSERT OR DELETE ON flex_folders
FOR EACH ROW
EXECUTE FUNCTION update_job_flex_folders_flag();