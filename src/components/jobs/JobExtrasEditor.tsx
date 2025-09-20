import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Euro, AlertCircle } from 'lucide-react';
import { useJobExtras, useUpsertJobExtra, useDeleteJobExtra } from '@/hooks/useJobExtras';
import { 
  JobExtraType, 
  EXTRA_TYPE_LABELS, 
  EXTRA_TYPE_LIMITS,
  JobExtra 
} from '@/types/jobExtras';
import { formatCurrency } from '@/lib/utils';

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
  const upsertJobExtra = useUpsertJobExtra();
  const deleteJobExtra = useDeleteJobExtra();
  
  const [pendingChanges, setPendingChanges] = useState<Partial<Record<JobExtraType, number>>>({});

  // Get current quantities for each extra type
  const getCurrentQuantity = (extraType: JobExtraType): number => {
    const existing = jobExtras.find(e => e.extra_type === extraType);
    return pendingChanges[extraType] ?? existing?.quantity ?? 0;
  };

  // Update quantity locally
  const updateQuantity = (extraType: JobExtraType, quantity: number) => {
    const maxQuantity = EXTRA_TYPE_LIMITS[extraType];
    const clampedQuantity = Math.max(0, Math.min(quantity, maxQuantity));
    setPendingChanges(prev => ({
      ...prev,
      [extraType]: clampedQuantity,
    }));
  };

  // Save changes to database
  const saveChanges = async () => {
    try {
      for (const [extraType, quantity] of Object.entries(pendingChanges)) {
        if (quantity > 0) {
          await upsertJobExtra.mutateAsync({
            job_id: jobId,
            technician_id: technicianId,
            extra_type: extraType as JobExtraType,
            quantity,
            updated_by: undefined, // Will be set by RLS context
          });
        } else {
          // Delete if quantity is 0
          const existing = jobExtras.find(e => e.extra_type === extraType);
          if (existing) {
            await deleteJobExtra.mutateAsync({
              jobId,
              technicianId,
              extraType: extraType as JobExtraType,
            });
          }
        }
      }
      setPendingChanges({} as Partial<Record<JobExtraType, number>>);
    } catch (error) {
      console.error('Error saving job extras:', error);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = Object.keys(pendingChanges).length > 0;

  // Calculate total extras amount
  const totalExtrasAmount = (Object.keys(EXTRA_TYPE_LABELS) as JobExtraType[])
    .reduce((total, extraType) => {
      const quantity = getCurrentQuantity(extraType);
      const unitAmount = getUnitAmount(extraType);
      return total + (quantity * unitAmount);
    }, 0);

  // Get unit amount for extra type (from rate catalog - hardcoded for now)
  const getUnitAmount = (extraType: JobExtraType): number => {
    const rates = {
      travel_half: 50,
      travel_full: 100,
      day_off: 100,
    };
    return rates[extraType];
  };

  if (isLoading) {
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
          const quantity = getCurrentQuantity(extraType);
          const maxQuantity = EXTRA_TYPE_LIMITS[extraType];
          const unitAmount = getUnitAmount(extraType);
          const totalAmount = quantity * unitAmount;
          
          return (
            <div key={extraType} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {EXTRA_TYPE_LABELS[extraType]}
                </Label>
                <Badge variant="outline" className="text-xs">
                  {formatCurrency(unitAmount)} each
                </Badge>
              </div>
              
              {isManager ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(extraType, quantity - 1)}
                    disabled={quantity <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  
                  <Input
                    type="number"
                    min="0"
                    max={maxQuantity}
                    value={quantity}
                    onChange={(e) => updateQuantity(extraType, parseInt(e.target.value) || 0)}
                    className="w-20 text-center"
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(extraType, quantity + 1)}
                    disabled={quantity >= maxQuantity}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  
                  <div className="text-sm text-muted-foreground ml-2">
                    max {maxQuantity}
                  </div>
                  
                  {totalAmount > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {formatCurrency(totalAmount)}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {quantity > 0 ? `${quantity} × ${formatCurrency(unitAmount)}` : 'None'}
                  </span>
                  {totalAmount > 0 && (
                    <Badge variant="secondary">
                      {formatCurrency(totalAmount)}
                    </Badge>
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
            {upsertJobExtra.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}