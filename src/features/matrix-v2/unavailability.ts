import { supabase } from '@/lib/supabase';

/**
 * Unavailability is a per-day mark on `technician_availability`; it never
 * touches assignments, so it stays outside the assignment commands.
 */

const refreshMatrix = () => {
  // The matrix and job cards listen for this and refetch their own queries.
  window.dispatchEvent(new CustomEvent('assignment-updated'));
};

export async function markUnavailable(technicianId: string, dateKeys: string[]): Promise<void> {
  if (dateKeys.length === 0) return;
  const rows = [...new Set(dateKeys)].map((date) => ({ technician_id: technicianId, date, status: 'day_off' }));
  const { error } = await supabase.from('technician_availability').upsert(rows, { onConflict: 'technician_id,date' });
  if (error) throw error;
  refreshMatrix();
}

/**
 * Removes the marks and reports how many existed. Zero means the unavailability
 * does not come from this table (an approved vacation or the seasonal calendar),
 * which a manager cannot lift from here.
 */
export async function clearUnavailable(technicianId: string, dateKeys: string[]): Promise<number> {
  if (dateKeys.length === 0) return 0;
  const { data, error } = await supabase
    .from('technician_availability')
    .delete()
    .eq('technician_id', technicianId)
    .in('date', [...new Set(dateKeys)])
    .select('id');
  if (error) throw error;
  refreshMatrix();
  return data?.length ?? 0;
}
