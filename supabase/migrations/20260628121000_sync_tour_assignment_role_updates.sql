-- Tour team role edits must reach every job in the tour.
--
-- tour_assignments already syncs to job_assignments on INSERT
-- (tour_assignment_insert_trigger) and DELETE (tour_assignment_delete_trigger),
-- but there was no trigger for UPDATEs, so changing a team member's role left
-- the per-job job_assignments rows stale. Reuse the existing insert-sync
-- function (it INSERTs ... ON CONFLICT DO UPDATE for every tour job, updating
-- the department role column only on assignment_source = 'tour' rows) for
-- role updates as well.

DROP TRIGGER IF EXISTS tour_assignment_update_trigger ON public.tour_assignments;

CREATE TRIGGER tour_assignment_update_trigger
  AFTER UPDATE OF role ON public.tour_assignments
  FOR EACH ROW
  WHEN (NEW.technician_id IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role)
  EXECUTE FUNCTION public.sync_tour_assignments_to_jobs();
