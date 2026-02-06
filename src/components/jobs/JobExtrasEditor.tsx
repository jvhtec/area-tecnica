import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Euro, AlertCircle } from 'lucide-react';
import { useJobExtras, useUpsertJobExtra } from '@/hooks/useJobExtras';
import {
  JobExtraType,
  EXTRA_TYPE_LABELS,
  EXTRA_TYPE_LIMITS,
  JobExtra
} from '@/types/jobExtras';
import { formatCurrency } from '@/lib/utils';
import { useRateExtrasCatalog } from '@/hooks/useRateExtrasCatalog';

// Fixed travel rate for house techs and assignable management users - €20 for both half and full travel days
const FIXED_TRAVEL_RATE = 20;

interface JobExtrasEditorProps {
  jobId: string;
  technicianId: string;
  technicianName: string;
  isManager?: boolean;
  isHouseTech?: boolean;
  isAssignableManagement?: boolean;
  showVehicleDisclaimer?: boolean;
  vehicleDisclaimerText?: string;
}

export function JobExtrasEditor({
  jobId,
  technicianId,
  technicianName,
  isManager = false,
  isHouseTech = false,
  isAssignableManagement = false,
  showVehicleDisclaimer = false,
  vehicleDisclaimerText,
}: JobExtrasEditorProps) {
  const { data: jobExtras = [], isLoading } = useJobExtras(jobId, technicianId);
  const { data: catalog = [], isLoading: catalogLoading } = useRateExtrasCatalog();
  const upsertJobExtra = useUpsertJobExtra();

  const [editingQuantities, setEditingQuantities] = useState<Partial<Record<JobExtraType, number>>>({});

  const findExtra = (extraType: JobExtraType): JobExtra | undefined =>
    jobExtras.find(e => e.extra_type === extraType);

  const getCurrentQuantity = (extraType: JobExtraType): number => {
    return findExtra(extraType)?.quantity ?? 0;
  };

  const getDisplayQuantity = (extraType: JobExtraType): number => {
    // Show editing quantity if currently being edited, otherwise show saved quantity
    return editingQuantities[extraType] ?? getCurrentQuantity(extraType);
  };

  // Update quantity locally (for live preview)
  const updateQuantity = (extraType: JobExtraType, quantity: number) => {
    const maxQuantity = EXTRA_TYPE_LIMITS[extraType];
    const clampedQuantity = Math.max(0, Math.min(quantity, maxQuantity));
    setEditingQuantities(prev => ({
      ...prev,
      [extraType]: clampedQuantity,
    }));
  };

  // Save a single extra immediately
  const saveExtra = async (extraType: JobExtraType, quantity: number) => {
    try {
      await upsertJobExtra.mutateAsync({
        jobId,
        technicianId,
        extraType,
        quantity,
      });
      // Clear editing state after successful save
      setEditingQuantities(prev => {
        const next = { ...prev };
        delete next[extraType];
        return next;
      });
    } catch (error) {
      console.error('Error saving job extra:', error);
    }
  };

  // Get unit amount for extra type from catalog
  // House techs and assignable management users get fixed €20 for travel days (both half and full)
  function getUnitAmount(extraType: JobExtraType): number {
    const qualifiesForFixedRate = isHouseTech || isAssignableManagement;
    if (qualifiesForFixedRate && (extraType === 'travel_half' || extraType === 'travel_full')) {
      return FIXED_TRAVEL_RATE;
    }
    const catalogItem = catalog?.find(r => r.extra_type === extraType);
    return catalogItem?.amount_eur ?? 0;
  }

  // Check if a given extra type uses the fixed travel rate
  function usesFixedTravelRate(extraType: JobExtraType): boolean {
    const qualifiesForFixedRate = isHouseTech || isAssignableManagement;
    return qualifiesForFixedRate && (extraType === 'travel_half' || extraType === 'travel_full');
  }

  // Calculate total extras amount
  const totalExtrasAmount = (Object.keys(EXTRA_TYPE_LABELS) as JobExtraType[])
    .reduce((total, extraType) => {
      const quantity = getCurrentQuantity(extraType);
      const unitAmount = getUnitAmount(extraType);
      return total + (quantity * unitAmount);
    }, 0);

  if (isLoading || catalogLoading) {
    return (
      <Card className="bg-card border-border text-card-foreground">
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
    <Card className="bg-card border-border text-card-foreground">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Euro className="h-4 w-4" />
          Job Extras - {technicianName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(EXTRA_TYPE_LABELS) as JobExtraType[]).map((extraType) => {
          const currentQuantity = getCurrentQuantity(extraType);
          const displayQuantity = getDisplayQuantity(extraType);
          const hasUnsavedChange = editingQuantities[extraType] !== undefined;
          const maxQuantity = EXTRA_TYPE_LIMITS[extraType];
          const unitAmount = getUnitAmount(extraType);
          const currentTotal = currentQuantity * unitAmount;
          const displayTotal = displayQuantity * unitAmount;

          return (
            <div key={extraType} className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-sm font-medium">
                  {EXTRA_TYPE_LABELS[extraType]}
                </Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={usesFixedTravelRate(extraType) ? "default" : "outline"}
                    className={`text-xs ${usesFixedTravelRate(extraType) ? 'bg-blue-600 text-white' : ''}`}
                  >
                    {formatCurrency(unitAmount)} each
                    {usesFixedTravelRate(extraType) && ' (plantilla)'}
                  </Badge>
                  {currentQuantity > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Current: {currentQuantity}
                    </Badge>
                  )}
                </div>
              </div>

              {isManager ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(extraType, displayQuantity - 1)}
                      disabled={displayQuantity <= 0 || upsertJobExtra.isPending}
                      className="bg-muted border-border"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>

                    <Input
                      type="number"
                      min="0"
                      max={maxQuantity}
                      value={displayQuantity}
                      onChange={(e) => updateQuantity(extraType, parseInt(e.target.value) || 0)}
                      onBlur={() => {
                        if (hasUnsavedChange) {
                          saveExtra(extraType, displayQuantity);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && hasUnsavedChange) {
                          saveExtra(extraType, displayQuantity);
                        }
                      }}
                      disabled={upsertJobExtra.isPending}
                      className="w-20 text-center bg-background border-input"
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newQuantity = displayQuantity + 1;
                        updateQuantity(extraType, newQuantity);
                        saveExtra(extraType, newQuantity);
                      }}
                      disabled={displayQuantity >= maxQuantity || upsertJobExtra.isPending}
                      className="bg-muted border-border"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>

                    <Badge variant="secondary" className="ml-auto">
                      {formatCurrency(displayTotal)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Max {maxQuantity}</span>
                    {hasUnsavedChange && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => saveExtra(extraType, displayQuantity)}
                        disabled={upsertJobExtra.isPending}
                        className="bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        {upsertJobExtra.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {currentQuantity > 0 ? `${currentQuantity} × ${formatCurrency(unitAmount)}` : 'None'}
                    </span>
                    {currentQuantity > 0 && (
                      <Badge variant="secondary" className="">
                        {formatCurrency(currentTotal)}
                      </Badge>
                    )}
                  </div>
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
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
            <p className="text-sm">
              {vehicleDisclaimerText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
