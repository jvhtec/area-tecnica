import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { longDayLabel } from '@/features/matrix-v2/jobDays';

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

/* ------------------------------------------------------------------------- */
/* With feedback: what the inspector, the keyboard and Stream Deck all call.   */
/* ------------------------------------------------------------------------- */

export type UnavailabilityResult = { ok: true } | { ok: false; message: string };

const LOCKED_MESSAGE = 'Esta no disponibilidad viene de unas vacaciones o del calendario de temporada: no se puede quitar desde aquí.';

/** Marks the day and offers Deshacer. */
export async function markUnavailableWithUndo(technicianId: string, dateKey: string): Promise<UnavailabilityResult> {
  try {
    await markUnavailable(technicianId, [dateKey]);
  } catch {
    return { ok: false, message: 'No se pudo marcar como no disponible. Inténtalo de nuevo.' };
  }
  toast('Marcado como no disponible', {
    description: longDayLabel(dateKey),
    action: { label: 'Deshacer', onClick: () => { void clearUnavailable(technicianId, [dateKey]); } },
  });
  return { ok: true };
}

/** Lifts the mark and offers Deshacer; a mark that lives elsewhere cannot be lifted here. */
export async function clearUnavailableWithUndo(technicianId: string, dateKey: string): Promise<UnavailabilityResult> {
  let removed: number;
  try {
    removed = await clearUnavailable(technicianId, [dateKey]);
  } catch {
    return { ok: false, message: 'No se pudo quitar la no disponibilidad. Inténtalo de nuevo.' };
  }
  if (removed === 0) return { ok: false, message: LOCKED_MESSAGE };
  toast('Disponible de nuevo', {
    description: longDayLabel(dateKey),
    action: { label: 'Deshacer', onClick: () => { void markUnavailable(technicianId, [dateKey]); } },
  });
  return { ok: true };
}
