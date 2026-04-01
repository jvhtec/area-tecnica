-- ============================================================================
-- Trigger to evaluate achievements when a bug report is submitted
-- ============================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION trigger_evaluate_achievements_on_bug_report()
RETURNS TRIGGER AS $$
BEGIN
  -- Only evaluate if there's a valid user
  IF NEW.created_by IS NOT NULL THEN
    PERFORM evaluate_user_achievements(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on bug_reports INSERT
CREATE TRIGGER on_bug_report_submitted_evaluate_achievements
  AFTER INSERT ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_evaluate_achievements_on_bug_report();
