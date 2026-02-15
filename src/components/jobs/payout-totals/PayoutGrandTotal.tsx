import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { JobPayoutTotals } from '@/types/jobExtras';
import type { JobPayoutOverride } from '../JobPayoutOverrideSection';

interface PayoutGrandTotalProps {
  payoutTotals: JobPayoutTotals[];
  calculatedGrandTotal: number;
  payoutOverrides: JobPayoutOverride[];
}

export function PayoutGrandTotal({
  payoutTotals,
  calculatedGrandTotal,
  payoutOverrides,
}: PayoutGrandTotalProps) {
  if (payoutTotals.length <= 1) return null;

  return (
    <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex justify-between items-center text-lg font-bold">
        <span>Total global del trabajo:</span>
        <div className="flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-300">
            {formatCurrency(calculatedGrandTotal)}
          </span>
          {payoutOverrides.length > 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-500/10">
              {payoutOverrides.length} override{payoutOverrides.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>
      <div className="text-sm text-foreground/70 dark:text-muted-foreground mt-2 space-y-1">
        <div className="flex justify-between">
          <span>Total partes:</span>
          <span>
            {formatCurrency(
              payoutTotals.reduce((sum, payout) => sum + payout.timesheets_total_eur, 0)
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Total extras:</span>
          <span>
            {formatCurrency(
              payoutTotals.reduce((sum, payout) => sum + payout.extras_total_eur, 0)
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
