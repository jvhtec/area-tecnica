import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { MultiDateRemovalState } from '@/components/matrix/optimized-matrix-cell/types';

type PendingRetry = { jobId: string } | null;
type PendingCancel = { phase: 'availability' | 'offer'; jobId: string | null; allJobIds?: string[] } | null;

type OptimizedMatrixCellDialogsProps = {
  date: Date;
  technicianId: string;
  displayName: string;
  staffingDepartment?: string | null;
  pendingRetry: PendingRetry;
  setPendingRetry: (value: PendingRetry) => void;
  retryChannel: 'email' | 'whatsapp';
  setRetryChannel: (value: 'email' | 'whatsapp') => void;
  availabilityRetrying: boolean;
  setAvailabilityRetrying: (value: boolean) => void;
  sendStaffingEmail: any;
  pendingCancel: PendingCancel;
  setPendingCancel: (value: PendingCancel) => void;
  cancelStaffing: any;
  isCancelling: boolean;
  multiDateRemoval: MultiDateRemovalState;
  setMultiDateRemoval: React.Dispatch<React.SetStateAction<MultiDateRemovalState>>;
  handleRemoveAssignment: (removeAll: boolean) => void | Promise<void>;
  isRemovingAssignment: boolean;
};

export const OptimizedMatrixCellDialogs = ({
  date,
  technicianId,
  displayName,
  staffingDepartment = null,
  pendingRetry,
  setPendingRetry,
  retryChannel,
  setRetryChannel,
  availabilityRetrying,
  setAvailabilityRetrying,
  sendStaffingEmail,
  pendingCancel,
  setPendingCancel,
  cancelStaffing,
  isCancelling,
  multiDateRemoval,
  setMultiDateRemoval,
  handleRemoveAssignment,
  isRemovingAssignment,
}: OptimizedMatrixCellDialogsProps) => (
  <>
    {pendingRetry && (
      <Dialog open={true} onOpenChange={(v) => !v && setPendingRetry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reenviar solicitud de disponibilidad</DialogTitle>
            <DialogDescription>Elige el canal y reenvía la solicitud de disponibilidad.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="space-y-3">
              <Label className="font-medium text-sm text-foreground">Canal</Label>
              <RadioGroup
                value={retryChannel}
                onValueChange={(value) => setRetryChannel(value as 'email' | 'whatsapp')}
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="availability-retry-channel-email" value="email" />
                  <Label htmlFor="availability-retry-channel-email" className="cursor-pointer">
                    Email
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="availability-retry-channel-whatsapp" value="whatsapp" />
                  <Label htmlFor="availability-retry-channel-whatsapp" className="cursor-pointer">
                    WhatsApp
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRetry(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (!pendingRetry) return;
              setAvailabilityRetrying(true);
              sendStaffingEmail(
                ({
                  job_id: pendingRetry.jobId,
                  profile_id: technicianId,
                  phase: 'availability',
                  channel: retryChannel,
                  department: staffingDepartment,
                  target_date: format(date, 'yyyy-MM-dd'),
                  single_day: true,
                } as any),
                {
                  onSuccess: () => {
                    setAvailabilityRetrying(false);
                    setPendingRetry(null);
                    toast.success('Solicitud de disponibilidad reenviada');
                  },
                  onError: (error: Error) => {
                    setAvailabilityRetrying(false);
                    setPendingRetry(null);
                    toast.error(`No se pudo reenviar la solicitud de disponibilidad: ${error.message}`);
                  },
                }
              );
            }} disabled={availabilityRetrying}>
              {availabilityRetrying ? 'Reenviando…' : 'Reenviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {pendingCancel && (
      <Dialog open={true} onOpenChange={(v) => !v && setPendingCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingCancel.phase === 'availability' ? '¿Cancelar solicitud de disponibilidad?' : '¿Cancelar oferta?'}</DialogTitle>
            <DialogDescription>
              Esto marcará la fase de {pendingCancel.phase === 'availability' ? 'disponibilidad' : 'oferta'} como cancelada para {displayName}.
              {pendingCancel.allJobIds && pendingCancel.allJobIds.length > 1 && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Se cancelarán {pendingCancel.allJobIds.length} solicitudes pendientes en esta fecha.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingCancel(null)}>Mantener</Button>
            <Button onClick={async () => {
              const jobIdsToCancel = pendingCancel.allJobIds?.length
                ? pendingCancel.allJobIds
                : (pendingCancel.jobId ? [pendingCancel.jobId] : []);

              if (!jobIdsToCancel.length) {
                setPendingCancel(null);
                return;
              }

              try {
                await Promise.all(
                  jobIdsToCancel.map(jid =>
                    new Promise<void>((resolve, reject) => {
                      cancelStaffing(
                        { job_id: jid, profile_id: technicianId, phase: pendingCancel.phase },
                        {
                          onSuccess: () => resolve(),
                          onError: (e: any) => reject(e),
                        }
                      );
                    })
                  )
                );
                setPendingCancel(null);
                toast.success(`${pendingCancel.phase === 'availability' ? 'Disponibilidad' : 'Oferta'} cancelada`);
              } catch (e: any) {
                toast.error(e?.message || 'No se pudo cancelar');
              }
            }} disabled={isCancelling}>
              {isCancelling ? 'Cancelando…' : 'Cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {multiDateRemoval.isOpen && (
      <Dialog open={true} onOpenChange={(v) => !v && setMultiDateRemoval((prev) => ({ ...prev, isOpen: false }))}>
        <DialogContent
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>¿Eliminar asignación?</DialogTitle>
            <DialogDescription>
              {multiDateRemoval.isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comprobando otras fechas asignadas...
                </span>
              ) : multiDateRemoval.otherDatesCount > 0 ? (
                <>
                  {displayName} está asignado a este trabajo durante <strong>{multiDateRemoval.otherDatesCount + 1} días</strong>.
                  ¿Qué deseas eliminar?
                </>
              ) : (
                <>Se eliminará la asignación de {displayName} de este trabajo.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {!multiDateRemoval.isLoading && multiDateRemoval.otherDatesCount > 0 && (
            <div className="py-4">
              <RadioGroup
                value={multiDateRemoval.removeOption}
                onValueChange={(value: 'single' | 'all') =>
                  setMultiDateRemoval((prev) => ({ ...prev, removeOption: value }))
                }
                className="space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="single" id="remove-single" />
                  <Label htmlFor="remove-single" className="cursor-pointer">
                    Solo este día ({multiDateRemoval.currentDate})
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="all" id="remove-all" />
                  <Label htmlFor="remove-all" className="cursor-pointer">
                    Todos los días ({multiDateRemoval.otherDatesCount + 1} días - elimina la asignación completa)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                setMultiDateRemoval((prev) => ({ ...prev, isOpen: false }));
              }}
              disabled={isRemovingAssignment}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={(event) => {
                event.stopPropagation();
                void handleRemoveAssignment(multiDateRemoval.removeOption === 'all');
              }}
              disabled={multiDateRemoval.isLoading || isRemovingAssignment}
            >
              {isRemovingAssignment ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando...
                </span>
              ) : multiDateRemoval.removeOption === 'all' && multiDateRemoval.otherDatesCount > 0 ? (
                `Eliminar ${multiDateRemoval.otherDatesCount + 1} días`
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
  </>
);
