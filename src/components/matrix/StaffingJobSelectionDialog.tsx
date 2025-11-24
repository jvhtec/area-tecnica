import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCancelStaffingRequest } from '@/features/staffing/hooks/useStaffing';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Clock, Mail, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
// Note: This dialog only collects a choice and delegates handling upstream.

interface StaffingJobSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onStaffingActionSelected: (jobId: string, action: 'availability' | 'offer', options?: { singleDay?: boolean }) => void;
  technicianId: string;
  technicianName: string;
  date: Date;
  availableJobs: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
    status: string;
    _assigned_count?: number;
  }>;
  declinedJobIds?: string[];
  preselectedJobId?: string | null;
  forcedAction?: 'availability' | 'offer';
  forcedChannel?: 'email' | 'whatsapp';
}

export const StaffingJobSelectionDialog = ({
  open,
  onClose,
  onStaffingActionSelected,
  technicianId,
  technicianName,
  date,
  availableJobs,
  declinedJobIds = [],
  preselectedJobId = null,
  forcedAction,
  forcedChannel
}: StaffingJobSelectionDialogProps) => {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<'availability' | 'offer'>('availability');
  const [singleDay, setSingleDay] = useState<boolean>(false);
  const { mutate: cancelStaffing, isPending: isCancelling } = useCancelStaffingRequest();
  // No direct email sending here; parent handles the action.

  const effectiveAction: 'availability' | 'offer' = forcedAction || selectedAction;
  const forcedChannelLabel = forcedChannel === 'whatsapp' ? 'WhatsApp' : forcedChannel === 'email' ? 'Email' : null;

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  const handleContinue = () => {
    if (selectedJobId) {
      console.log('🚀 StaffingJobSelectionDialog: handleContinue called', {
        job_id: selectedJobId,
        action: effectiveAction,
        technician: technicianName,
        date: format(date, 'yyyy-MM-dd'),
        singleDay
      });

      // Call the callback to let parent handle it.
      // Do NOT call onClose() here to avoid racing with parent state transitions (e.g., opening OfferDetails).
      onStaffingActionSelected(selectedJobId, effectiveAction, { singleDay });
    } else {
      console.log('❌ StaffingJobSelectionDialog: No job selected');
    }
  };

  const handleClose = () => {
    setSelectedJobId('');
    setSelectedAction('availability');
    setSingleDay(false);
    onClose();
  };

  React.useEffect(() => {
    if (open && preselectedJobId) {
      setSelectedJobId(preselectedJobId);
    }
  }, [open, preselectedJobId]);

  React.useEffect(() => {
    if (forcedAction) {
      setSelectedAction(forcedAction);
    }
  }, [forcedAction]);

  const primaryActionLabel = effectiveAction === 'availability' ? 'Pedir Disponibilidad' : 'Enviar Oferta';
  const primaryButtonLabel = forcedChannelLabel ? `${primaryActionLabel} vía ${forcedChannelLabel}` : primaryActionLabel;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitud de Personal</DialogTitle>
          <DialogDescription>
            Selecciona un trabajo y acción para {technicianName} el{' '}
            {format(date, 'EEEE, d MMMM, yyyy', { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {forcedAction && (
            <div className="rounded-md border border-muted-foreground/30 bg-muted/40 p-3 text-sm text-muted-foreground">
              {forcedAction === 'availability'
                ? `Este atajo pedirá disponibilidad${forcedChannelLabel ? ` vía ${forcedChannelLabel}` : ''}.`
                : `Este atajo enviará una oferta de trabajo${forcedChannelLabel ? ` vía ${forcedChannelLabel}` : ''}.`}
            </div>
          )}

          {/* Job Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Seleccionar Trabajo</h4>
            {availableJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay trabajos disponibles para esta fecha
                </p>
              </div>
            ) : (
              availableJobs.map((job) => {
                const isDeclined = declinedJobIds.includes(job.id);
                const selected = selectedJobId === job.id;
                return (
                  <div
                    key={job.id}
                    className={`p-3 border rounded-lg transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
                      } ${isDeclined ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => {
                      if (isDeclined) return;
                      handleJobSelect(job.id);
                    }}
                    title={isDeclined ? 'Technician declined this job' : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{job.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(job.start_time), 'HH:mm')} - {format(new Date(job.end_time), 'HH:mm')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDeclined && <Badge variant="destructive">Rechazado</Badge>}
                        {job.status === 'Cancelado' && (
                          <Badge variant="destructive" className="text-[10px]">Llamar para cancelar</Badge>
                        )}
                        <Badge variant="secondary">{job.status}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Single-Day Scope - Always show when job is selected */}
          {selectedJobId && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <input
                  id="scope-single-day"
                  type="checkbox"
                  checked={singleDay}
                  onChange={(e) => setSingleDay(e.target.checked)}
                />
                <Label htmlFor="scope-single-day" className="text-sm cursor-pointer">
                  Solicitar solo para este día
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Para trabajos de varios días, marca esto para solicitar disponibilidad/oferta solo para esta fecha específica
              </p>
            </div>
          )}

          {/* Action Selection (hidden if forced) */}
          {selectedJobId && !forcedAction && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Elegir Acción</h4>
              <RadioGroup value={selectedAction} onValueChange={(value) => setSelectedAction(value as 'availability' | 'offer')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="availability" id="availability" />
                  <Label htmlFor="availability" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Pedir Disponibilidad
                    <span className="text-sm text-muted-foreground">
                      Enviar email para comprobar si el técnico está disponible
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="offer" id="offer" />
                  <Label htmlFor="offer" className="flex items-center gap-2 cursor-pointer">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Enviar Oferta de Trabajo
                    <span className="text-sm text-muted-foreground">
                      Enviar email ofreciendo el trabajo al técnico
                    </span>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  disabled={!selectedJobId}
                  onClick={() => {
                    if (!selectedJobId) return;
                    cancelStaffing({ job_id: selectedJobId, profile_id: technicianId, phase: effectiveAction });
                  }}
                >
                  {isCancelling ? 'Cancelando…' : `Cancelar ${effectiveAction === 'availability' ? 'Disponibilidad' : 'Oferta'}`}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!selectedJobId}
          >
            {primaryButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
