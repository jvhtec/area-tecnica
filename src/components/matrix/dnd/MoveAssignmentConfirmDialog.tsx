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
import { Loader2 } from 'lucide-react';
import { AssignmentWorkloadWarning } from '@/components/matrix/lenses/AssignmentWorkloadWarning';
import type { PendingMove } from '@/components/matrix/dnd/useMoveAssignment';

interface MoveAssignmentConfirmDialogProps {
  pendingMove: PendingMove | null;
  isMoving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const MoveAssignmentConfirmDialog = ({ pendingMove, isMoving, onCancel, onConfirm }: MoveAssignmentConfirmDialogProps) => {
  if (!pendingMove) return null;
  const { source, targetTechnicianId, targetTechnicianName, conflict } = pendingMove;
  const hasHardConflict = !!conflict?.hasHardConflict;

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{hasHardConflict ? '⛔ Conflicto de horario' : 'Mover asignación'}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                ¿Mover la asignación de <strong>{source.jobTitle}</strong> de{' '}
                <strong>{source.technicianName}</strong> a <strong>{targetTechnicianName}</strong>?
              </p>

              {conflict && conflict.hardConflicts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 dark:bg-red-950/30 dark:border-red-900">
                  <div className="font-semibold text-red-900 dark:text-red-200 mb-1 text-sm">
                    {targetTechnicianName} ya tiene confirmado:
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {conflict.hardConflicts.map((c, idx) => (
                      <li key={idx} className="text-red-800 dark:text-red-300 text-sm">{c.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              {conflict && !hasHardConflict && conflict.softConflicts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 dark:bg-amber-950/30 dark:border-amber-900">
                  <div className="font-semibold text-amber-900 dark:text-amber-200 mb-1 text-sm">
                    Invitaciones pendientes sin responder:
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {conflict.softConflicts.map((c, idx) => (
                      <li key={idx} className="text-amber-800 dark:text-amber-300 text-sm">{c.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              <AssignmentWorkloadWarning
                technicianId={targetTechnicianId}
                technicianName={targetTechnicianName}
                dateIso={source.dateKey}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isMoving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isMoving}
            className={hasHardConflict ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isMoving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Moviendo...
              </>
            ) : hasHardConflict ? (
              'Mover de todos modos'
            ) : (
              'Confirmar movimiento'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
