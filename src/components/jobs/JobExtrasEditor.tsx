import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Euro, AlertCircle } from 'lucide-react';
import { useJobExtras, useUpsertJobExtra, useReviewJobExtra } from '@/hooks/useJobExtras';
import { 
  JobExtraType, 
  EXTRA_TYPE_LABELS, 
  EXTRA_TYPE_LIMITS,
  JobExtra 
} from '@/types/jobExtras';
import { formatCurrency } from '@/lib/utils';
import { useRateExtrasCatalog } from '@/hooks/useRateExtrasCatalog';

interface JobExtrasEditorProps {
  jobId: string;
  technicianId: string;
  technicianName: string;
  isManager?: boolean;
  showVehicleDisclaimer?: boolean;
  vehicleDisclaimerText?: string;
}

export function JobExtrasEditor({
  jobId,
  technicianId,
  technicianName,
  isManager = false,
  showVehicleDisclaimer = false,
  vehicleDisclaimerText,
}: JobExtrasEditorProps) {
  const { data: jobExtras = [], isLoading } = useJobExtras(jobId, technicianId);
  const { data: catalog = [], isLoading: catalogLoading } = useRateExtrasCatalog();
  const upsertJobExtra = useUpsertJobExtra();
  const reviewJobExtra = useReviewJobExtra();

  const [pendingChanges, setPendingChanges] = useState<Partial<Record<JobExtraType, number>>>({});

  const findExtra = (extraType: JobExtraType): JobExtra | undefined =>
    jobExtras.find(e => e.extra_type === extraType);

  const getApprovedQuantity = (extraType: JobExtraType): number => {
    return findExtra(extraType)?.quantity ?? 0;
  };

  const getPendingQuantity = (extraType: JobExtraType): number | null => {
    const value = findExtra(extraType)?.pending_quantity;
    return typeof value === 'number' ? value : null;
  };

  const getInputQuantity = (extraType: JobExtraType): number => {
    if (pendingChanges[extraType] !== undefined) {
      return pendingChanges[extraType] as number;
    }
    const pending = getPendingQuantity(extraType);
    if (pending !== null && pending !== undefined) {
      return pending;
    }
    return getApprovedQuantity(extraType);
  };

  // Update quantity locally
  const updateQuantity = (extraType: JobExtraType, quantity: number) => {
    const maxQuantity = EXTRA_TYPE_LIMITS[extraType];
    const clampedQuantity = Math.max(0, Math.min(quantity, maxQuantity));
    const baseline = getPendingQuantity(extraType);
    const approved = getApprovedQuantity(extraType);
    const reference = baseline !== null && baseline !== undefined ? baseline : approved;

    setPendingChanges(prev => {
      const next = { ...prev };
      if (clampedQuantity === reference) {
        delete next[extraType];
      } else {
        next[extraType] = clampedQuantity;
      }
      return next;
    });
  };

  // Save changes to database
  const saveChanges = async () => {
    try {
      for (const [extraType, quantity] of Object.entries(pendingChanges)) {
        const typedExtra = extraType as JobExtraType;
        if (quantity === undefined) continue;

        const existing = findExtra(typedExtra);
        const baseline = existing?.pending_quantity ?? existing?.quantity ?? 0;
        if (quantity === baseline) continue;
        if (!existing && quantity === 0) continue;

        await upsertJobExtra.mutateAsync({
          jobId,
          technicianId,
          extraType: typedExtra,
          approvedQuantity: existing?.quantity ?? 0,
          requestedQuantity: quantity,
          hasExistingRow: Boolean(existing),
        });
      }
      setPendingChanges({} as Partial<Record<JobExtraType, number>>);
    } catch (error) {
      console.error('Error saving job extras:', error);
    }
  };

  const handleApprove = (extraType: JobExtraType) => {
    reviewJobExtra.approve.mutate({ jobId, technicianId, extraType });
  };

  const handleReject = (extraType: JobExtraType) => {
    const reason = window.prompt('Reason for rejecting this extra?');
    const trimmed = reason?.trim();
    reviewJobExtra.reject.mutate({
      jobId,
      technicianId,
      extraType,
      reason: trimmed ? trimmed : undefined,
    });
  };

  // Check if there are unsaved changes
  const hasChanges = Object.entries(pendingChanges).some(([extraType, quantity]) => {
    if (quantity === undefined) return false;
    const typedExtra = extraType as JobExtraType;
    const existing = findExtra(typedExtra);
    const baseline = existing?.pending_quantity ?? existing?.quantity ?? 0;
    return quantity !== baseline;
  });

  // Get unit amount for extra type (from rate catalog - hardcoded for now)
  function getUnitAmount(extraType: JobExtraType): number {
    const defaults = {
      travel_half: 50,
      travel_full: 100,
      day_off: 100,
    } as const;
    const row = catalog?.find(r => r.extra_type === extraType);
    return row?.amount_eur ?? defaults[extraType];
  }

  // Calculate total extras amount (approved only)
  const totalExtrasAmount = (Object.keys(EXTRA_TYPE_LABELS) as JobExtraType[])
    .reduce((total, extraType) => {
      const quantity = getApprovedQuantity(extraType);
      const unitAmount = getUnitAmount(extraType);
      return total + (quantity * unitAmount);
    }, 0);

  if (isLoading || catalogLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Job Extras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Euro className="h-4 w-4" />
          Job Extras - {technicianName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(EXTRA_TYPE_LABELS) as JobExtraType[]).map((extraType) => {
          const existing = findExtra(extraType);
          const inputQuantity = getInputQuantity(extraType);
          const approvedQuantity = getApprovedQuantity(extraType);
          const pendingQuantity = getPendingQuantity(extraType);
          const hasPending = pendingQuantity !== null && pendingQuantity !== approvedQuantity;
          const isRejected = existing?.status === 'rejected';
          const maxQuantity = EXTRA_TYPE_LIMITS[extraType];
          const unitAmount = getUnitAmount(extraType);
          const approvedTotal = approvedQuantity * unitAmount;
          const proposedTotal = inputQuantity * unitAmount;
          const status = existing?.status ?? (approvedQuantity > 0 ? 'approved' : 'empty');
          const statusText = status === 'pending'
            ? 'Pending approval'
            : status === 'approved'
              ? 'Approved'
              : status === 'rejected'
                ? 'Rejected'
                : 'Not set';
          const statusVariant = status === 'approved'
            ? 'outline'
            : status === 'pending'
              ? 'secondary'
              : status === 'rejected'
                ? 'destructive'
                : 'secondary';
          const isReviewing = reviewJobExtra.approve.isPending || reviewJobExtra.reject.isPending;

          return (
            <div key={extraType} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-sm font-medium">
                  {EXTRA_TYPE_LABELS[extraType]}
                </Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {formatCurrency(unitAmount)} each
                  </Badge>
                  <Badge variant={statusVariant} className="text-xs capitalize">
                    {statusText}
                  </Badge>
                </div>
              </div>

              {(approvedQuantity > 0 || hasPending) && (
                <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                  {approvedQuantity > 0 && (
                    <span>
                      Approved: {approvedQuantity} ({formatCurrency(approvedTotal)})
                    </span>
                  )}
                  {hasPending && pendingQuantity !== null && (
                    <span className="text-amber-600">
                      Pending: {pendingQuantity} ({formatCurrency(pendingQuantity * unitAmount)})
                    </span>
                  )}
                </div>
              )}

              {isRejected && existing?.rejection_reason && (
                <div className="text-xs text-destructive">
                  Last rejection: {existing.rejection_reason}
                </div>
              )}

              {isManager ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(extraType, inputQuantity - 1)}
                      disabled={inputQuantity <= 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>

                    <Input
                      type="number"
                      min="0"
                      max={maxQuantity}
                      value={inputQuantity}
                      onChange={(e) => updateQuantity(extraType, parseInt(e.target.value) || 0)}
                      className="w-20 text-center"
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(extraType, inputQuantity + 1)}
                      disabled={inputQuantity >= maxQuantity}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>

                    <Badge variant="secondary" className="ml-auto">
                      {formatCurrency(proposedTotal)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Max {maxQuantity}</span>
                    {existing?.status === 'pending' && hasPending && (
                      <div className="flex items-center gap-2 ml-auto">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(extraType)}
                          disabled={isReviewing}
                        >
                          {reviewJobExtra.approve.isPending ? 'Approving…' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(extraType)}
                          disabled={isReviewing}
                        >
                          {reviewJobExtra.reject.isPending ? 'Rejecting…' : 'Reject'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {approvedQuantity > 0 ? `${approvedQuantity} × ${formatCurrency(unitAmount)}` : 'None'}
                    </span>
                    {approvedQuantity > 0 && (
                      <Badge variant="secondary">
                        {formatCurrency(approvedTotal)}
                      </Badge>
                    )}
                  </div>
                  {hasPending && pendingQuantity !== null && (
                    <div className="text-xs text-amber-600">
                      Pending review: {pendingQuantity} ({formatCurrency(pendingQuantity * unitAmount)})
                    </div>
                  )}
                  {isRejected && existing?.rejection_reason && (
                    <div className="text-xs text-destructive">
                      Last rejection: {existing.rejection_reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {totalExtrasAmount > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between font-medium">
              <span>Total Extras:</span>
              <Badge variant="default" className="text-sm">
                {formatCurrency(totalExtrasAmount)}
              </Badge>
            </div>
          </>
        )}
        
        {showVehicleDisclaimer && vehicleDisclaimerText && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              {vehicleDisclaimerText}
            </p>
          </div>
        )}
        
        {isManager && hasChanges && (
          <Button
            onClick={saveChanges}
            disabled={upsertJobExtra.isPending}
            className="w-full"
          >
            {upsertJobExtra.isPending ? 'Submitting…' : 'Submit changes for approval'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
