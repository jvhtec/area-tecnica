-- ============================================================================
-- Trigger: evaluate achievements for all techs when a job is marked Completado
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_evaluate_achievements_on_job_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tech_id uuid;
BEGIN
  -- Only fire when status transitions TO 'Completado'
  IF NEW.status = 'Completado' AND (OLD.status IS DISTINCT FROM 'Completado') THEN
    FOR v_tech_id IN
      SELECT DISTINCT technician_id
      FROM job_assignments
      WHERE job_id = NEW.id
        AND status = 'confirmed'
    LOOP
      PERFORM evaluate_user_achievements(v_tech_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_job_completed_evaluate_achievements ON jobs;

CREATE TRIGGER on_job_completed_evaluate_achievements
AFTER UPDATE OF status ON jobs
FOR EACH ROW
EXECUTE FUNCTION trigger_evaluate_achievements_on_job_complete();
