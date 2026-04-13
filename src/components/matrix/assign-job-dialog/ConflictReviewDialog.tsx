import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ConflictWarningPayload } from './conflictUtils';

interface ConflictReviewDialogProps {
  conflictWarning: ConflictWarningPayload | null;
  technicianName: string;
  selectedJobTitle?: string;
  targetJobRange: string | null;
  onClose: () => void;
  onContinue: () => void;
}

export const ConflictReviewDialog = ({
  conflictWarning,
  technicianName,
  selectedJobTitle,
  targetJobRange,
  onClose,
  onContinue,
}: ConflictReviewDialogProps) => {
  const formatJobRange = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    try {
      return `${format(new Date(start), 'PPP', { locale: es })} – ${format(new Date(end), 'PPP', { locale: es })}`;
    } catch {
      return null;
    }
  };

  const formatDateLabel = (iso?: string) => {
    if (!iso) return null;
    try {
      return format(new Date(`${iso}T00:00:00`), 'PPP', { locale: es });
    } catch {
      return null;
    }
  };

  const conflictTargetDateLabel = formatDateLabel(conflictWarning?.targetDate);
  const hasMultiDateConflictDetails = conflictWarning?.mode === 'multi' && (conflictWarning.perDateConflicts?.length ?? 0) > 0;

  return (
    <AlertDialog
      open={!!conflictWarning}
      onOpenChange={(openState) => {
        if (!openState) onClose();
      }}
    >
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {conflictWarning?.result.hasHardConflict ? '⛔ Conflicto de Horario' : '⚠️ Conflicto Potencial'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {conflictWarning && (
                <>
                  <p className="text-sm">
                    {technicianName || 'Este técnico'} tiene conflictos con <strong>{selectedJobTitle}</strong>
                    {conflictWarning.mode === 'full' && targetJobRange ? ` (${targetJobRange})` : ''}
                    {conflictWarning.mode !== 'full' && !hasMultiDateConflictDetails && conflictTargetDateLabel ? ` el ${conflictTargetDateLabel}` : ''}:
                  </p>

                  {hasMultiDateConflictDetails && (
                    <div className="space-y-3">
                      <div className="font-medium text-sm">Fechas con conflicto: {conflictWarning.perDateConflicts?.length}</div>
                      {conflictWarning.perDateConflicts?.map(({ targetDate, result }) => (
                        <div key={targetDate} className="border rounded p-3 bg-muted/20">
                          <div className="font-semibold text-sm mb-2">{formatDateLabel(targetDate)}</div>
                          {result.hardConflicts.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded p-3 mb-2">
                              <div className="font-semibold text-red-900 mb-2">Asignaciones Confirmadas:</div>
                              <ul className="list-disc list-inside space-y-1">
                                {result.hardConflicts.map((conflict, idx) => (
                                  <li key={`${targetDate}-hard-${idx}`} className="text-red-800 text-sm">
                                    <strong>{conflict.title}</strong> ({formatJobRange(conflict.start_time, conflict.end_time)})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.softConflicts.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-2">
                              <div className="font-semibold text-yellow-900 mb-2">Invitaciones Pendientes:</div>
                              <ul className="list-disc list-inside space-y-1">
                                {result.softConflicts.map((conflict, idx) => (
                                  <li key={`${targetDate}-soft-${idx}`} className="text-yellow-800 text-sm">
                                    <strong>{conflict.title}</strong> ({formatJobRange(conflict.start_time, conflict.end_time)})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.unavailabilityConflicts.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded p-3">
                              <div className="font-semibold text-red-900 mb-2">No Disponible:</div>
                              <ul className="list-disc list-inside space-y-1">
                                {result.unavailabilityConflicts.map((unav, idx) => (
                                  <li key={`${targetDate}-unav-${idx}`} className="text-red-800 text-sm">
                                    {formatDateLabel(unav.date)} - {unav.reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasMultiDateConflictDetails && conflictWarning.result.hardConflicts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="font-semibold text-red-900 mb-2">Asignaciones Confirmadas:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {conflictWarning.result.hardConflicts.map((conflict, idx) => (
                          <li key={idx} className="text-red-800 text-sm">
                            <strong>{conflict.title}</strong> ({formatJobRange(conflict.start_time, conflict.end_time)})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!hasMultiDateConflictDetails && conflictWarning.result.softConflicts.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <div className="font-semibold text-yellow-900 mb-2">Invitaciones Pendientes:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {conflictWarning.result.softConflicts.map((conflict, idx) => (
                          <li key={idx} className="text-yellow-800 text-sm">
                            <strong>{conflict.title}</strong> ({formatJobRange(conflict.start_time, conflict.end_time)})
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-yellow-700 mt-2">El técnico aún no ha respondido a estas invitaciones.</p>
                    </div>
                  )}

                  {!hasMultiDateConflictDetails && conflictWarning.result.unavailabilityConflicts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="font-semibold text-red-900 mb-2">Fechas No Disponibles:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {conflictWarning.result.unavailabilityConflicts.map((unav, idx) => (
                          <li key={idx} className="text-red-800 text-sm">
                            {formatDateLabel(unav.date)} - {unav.reason}
                            {unav.notes && <span className="text-xs"> ({unav.notes})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-sm text-gray-600 mt-3">
                    {conflictWarning.result.hasHardConflict
                      ? 'Continuar creará una doble reserva. ¿Estás seguro?'
                      : 'El técnico podría no estar disponible. ¿Quieres continuar de todos modos?'}
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Volver</AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            className={conflictWarning?.result.hasHardConflict ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {conflictWarning?.result.hasHardConflict ? 'Forzar asignación de todos modos' : 'Continuar de todos modos'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
