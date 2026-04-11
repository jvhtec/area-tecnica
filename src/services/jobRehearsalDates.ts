import { supabase } from '@/integrations/supabase/client';

export interface JobRehearsalDateSyncPlan {
  toInsert: string[];
  toDelete: string[];
  retained: string[];
}

export const buildInclusiveDateRange = (startDate: string, endDate?: string): string[] => {
  if (!startDate) return [];

  const normalizedEndDate = endDate || startDate;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${normalizedEndDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(current.toISOString().split('T')[0]);
  }

  return dates;
};

export const planJobRehearsalDateSync = (
  existingDates: string[],
  scheduledDates: string[],
  seedMissing: boolean
): JobRehearsalDateSyncPlan => {
  const scheduledSet = new Set(scheduledDates);
  const existingSet = new Set(existingDates);

  const retained = existingDates.filter((date) => scheduledSet.has(date));
  const toDelete = existingDates.filter((date) => !scheduledSet.has(date));
  const toInsert = seedMissing
    ? scheduledDates.filter((date) => !existingSet.has(date))
    : [];

  return { toInsert, toDelete, retained };
};

export async function syncJobRehearsalDates(
  jobId: string,
  scheduledDates: string[],
  options: { seedMissing?: boolean } = {}
) {
  const { seedMissing = false } = options;

  const { data: existingRows, error: existingError } = await supabase
    .from('job_rehearsal_dates')
    .select('date')
    .eq('job_id', jobId);

  if (existingError) {
    throw existingError;
  }

  const existingDates = (existingRows || [])
    .map((row) => row.date)
    .filter((date): date is string => typeof date === 'string' && date.length > 0);

  const plan = planJobRehearsalDateSync(existingDates, scheduledDates, seedMissing);

  if (plan.toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('job_rehearsal_dates')
      .delete()
      .eq('job_id', jobId)
      .in('date', plan.toDelete);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (plan.toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('job_rehearsal_dates')
      .upsert(
        plan.toInsert.map((date) => ({
          job_id: jobId,
          date,
        })),
        { onConflict: 'job_id,date', ignoreDuplicates: true }
      );

    if (insertError) {
      throw insertError;
    }
  }

  return plan;
}

export async function syncJobRehearsalDatesForJobs(
  jobIds: string[],
  scheduledDates: string[],
  options: { seedMissing?: boolean } = {}
) {
  return Promise.all(jobIds.map((jobId) => syncJobRehearsalDates(jobId, scheduledDates, options)));
}
