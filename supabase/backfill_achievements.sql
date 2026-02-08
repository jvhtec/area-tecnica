-- ============================================================================
-- Achievement Backfill: evaluate all users with completed jobs
-- Run this once in the Supabase SQL editor to unlock retroactive achievements.
-- ============================================================================

DO $$
DECLARE
  v_user record;
  v_new_unlocks integer;
  v_total_users integer := 0;
  v_total_unlocks integer := 0;
BEGIN
  FOR v_user IN
    SELECT DISTINCT ja.technician_id
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.status = 'confirmed'
      AND j.status = 'Completado'
    ORDER BY ja.technician_id
  LOOP
    v_new_unlocks := evaluate_user_achievements(v_user.technician_id);
    v_total_users := v_total_users + 1;
    v_total_unlocks := v_total_unlocks + v_new_unlocks;

    IF v_new_unlocks > 0 THEN
      RAISE NOTICE 'User %: % new achievement(s) unlocked', v_user.technician_id, v_new_unlocks;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Backfill complete: % users evaluated, % total achievements unlocked', v_total_users, v_total_unlocks;
END;
$$;
