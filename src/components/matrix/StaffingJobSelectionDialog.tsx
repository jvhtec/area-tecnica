import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, Mail } from 'lucide-react';

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useCancelStaffingRequest } from '@/features/staffing/hooks/useStaffing';
import { JobPickerList, type PickableJob } from '@/components/matrix/staffing/JobPickerList';
import { SHEET_BODY, SHEET_FOOTER, SHEET_HEADER } from '@/components/matrix/staffing/sheetLayout';
// Note: This dialog only collects a choice and delegates handling upstream.

interface StaffingJobSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onStaffingActionSelected: (jobId: string, action: 'availability' | 'offer', options?: { singleDay?: boolean }) => void;
  technicianId: string;
  technicianName: string;
  date: Date;
  availableJobs: Array<PickableJob & { _assigned_count?: number }>;
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

  const handleContinue = () => {
    if (selectedJobId) {
      // Call the callback to let parent handle it.
      // Do NOT call onClose() here to avoid racing with parent state transitions (e.g., opening OfferDetails).
      onStaffingActionSelected(selectedJobId, effectiveAction, { singleDay });
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

  const primaryActionLabel = effectiveAction === 'availability' ? 'Pedir disponibilidad' : 'Enviar oferta';
  const primaryButtonLabel = forcedChannelLabel ? `${primaryActionLabel} · ${forcedChannelLabel}` : primaryActionLabel;

  const actionOptions: Array<{ value: 'availability' | 'offer'; label: string; hint: string; icon: typeof Mail }> = [
    {
      value: 'availability',
      label: 'Pedir disponibilidad',
      hint: 'Pregunta al técnico si puede ese día',
      icon: Mail,
    },
    {
      value: 'offer',
      label: 'Enviar oferta',
      hint: 'Ofrece el trabajo directamente',
      icon: CheckCircle,
    },
  ];

  return (
    <ResponsiveDialog open={open} onOpenChange={(value) => { if (!value) handleClose(); }}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader className={SHEET_HEADER}>
          <ResponsiveDialogTitle>Solicitud de personal</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="first-letter:uppercase">
            {`${technicianName} · ${format(date, "EEEE d 'de' MMMM", { locale: es })}`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className={cn(SHEET_BODY, "space-y-4")}>
          {forcedAction && (
            <p className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              {forcedAction === 'availability'
                ? `Se pedirá disponibilidad${forcedChannelLabel ? ` vía ${forcedChannelLabel}` : ''}.`
                : `Se enviará una oferta de trabajo${forcedChannelLabel ? ` vía ${forcedChannelLabel}` : ''}.`}
            </p>
          )}

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Trabajo
            </span>
            <JobPickerList
              jobs={availableJobs}
              selectedJobId={selectedJobId}
              onSelect={setSelectedJobId}
              declinedJobIds={declinedJobIds}
            />
          </div>

          {selectedJobId && (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
              <Label htmlFor="scope-single-day" className="cursor-pointer text-sm font-medium">
                Solo para este día
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Para trabajos de varios días, limita la solicitud a esta fecha
                </span>
              </Label>
              <Switch
                id="scope-single-day"
                checked={singleDay}
                onCheckedChange={(value) => setSingleDay(Boolean(value))}
                aria-label="Solicitar solo para este día"
              />
            </div>
          )}

          {selectedJobId && !forcedAction && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acción
              </span>
              <div className="grid gap-2" role="radiogroup" aria-label="Acción">
                {actionOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selectedAction === option.value}
                    onClick={() => setSelectedAction(option.value)}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                      selectedAction === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <option.icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        option.value === 'availability' ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400',
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                className="min-h-11 w-full"
                disabled={!selectedJobId || isCancelling}
                onClick={() => {
                  if (!selectedJobId) return;
                  cancelStaffing({ job_id: selectedJobId, profile_id: technicianId, phase: effectiveAction });
                }}
              >
                {isCancelling
                  ? 'Cancelando…'
                  : `Cancelar ${effectiveAction === 'availability' ? 'disponibilidad' : 'oferta'}`}
              </Button>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className={SHEET_FOOTER}>
          <Button variant="outline" className="min-h-11" onClick={handleClose}>
            Cancelar
          </Button>
          <Button className="min-h-11 flex-1 sm:flex-none" onClick={handleContinue} disabled={!selectedJobId}>
            {primaryButtonLabel}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
