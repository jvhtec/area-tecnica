import { supabase } from '@/integrations/supabase/client';
import { getCategoryFromAssignment } from '@/utils/roleCategory';

interface SyncTimesheetCategoriesParams {
  jobId: string;
  technicianId: string;
  soundRole?: string | null;
  lightsRole?: string | null;
  videoRole?: string | null;
}

export async function syncTimesheetCategoriesForAssignment({
  jobId,
  technicianId,
  soundRole = null,
  lightsRole = null,
  videoRole = null,
}: SyncTimesheetCategoriesParams): Promise<void> {
  const category = getCategoryFromAssignment({
    sound_role: soundRole,
    lights_role: lightsRole,
    video_role: videoRole,
  });

  if (!category) {
    return;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('timesheets')
    .update({ category })
    .eq('job_id', jobId)
    .eq('technician_id', technicianId)
    .eq('is_active', true)
    .select('id');

  if (updateError) {
    throw updateError;
  }

  const timesheetIds = (updatedRows || []).map((row: { id: string }) => row.id);
  if (timesheetIds.length === 0) {
    return;
  }

  const recalcResults = await Promise.allSettled(
    timesheetIds.map((timesheetId) =>
      supabase.rpc('compute_timesheet_amount_2025', { _timesheet_id: timesheetId, _persist: true })
    )
  );

  const recalcFailures = recalcResults
    .map((result, idx) => ({ result, timesheetId: timesheetIds[idx] }))
    .filter(({ result }) => result.status === 'rejected');

  if (recalcFailures.length > 0) {
    console.warn('Some timesheet amount recalculations failed after category sync', recalcFailures);
  }
}
