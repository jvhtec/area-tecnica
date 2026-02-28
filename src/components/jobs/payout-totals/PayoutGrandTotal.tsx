import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { JobPayoutTotals } from '@/types/jobExtras';
import type { JobPayoutOverride } from '@/components/jobs/JobPayoutOverrideSection';

interface PayoutGrandTotalProps {
  payoutTotals: JobPayoutTotals[];
  calculatedGrandTotal: number;
  payoutOverrides: JobPayoutOverride[];
  isCicloJob?: boolean;
}

export function PayoutGrandTotal({
  payoutTotals,
  calculatedGrandTotal,
  payoutOverrides,
  isCicloJob = false,
}: PayoutGrandTotalProps) {
  if (payoutTotals.length <= 1) return null;

  const totalExpenses = payoutTotals.reduce((sum, payout) => sum + (payout.expenses_total_eur || 0), 0);
  const overrideLabel = isCicloJob
    ? payoutOverrides.length > 1 ? 'pagos fijos' : 'pago fijo'
    : payoutOverrides.length > 1 ? 'anulaciones' : 'anulación';

  return (
    <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex justify-between items-center text-lg font-bold">
        <span>Total global del trabajo:</span>
        <div className="flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-300">
            {formatCurrency(calculatedGrandTotal)}
          </span>
          {payoutOverrides.length > 0 && (
            <Badge
              variant="outline"
              className={
                isCicloJob
                  ? "text-blue-700 border-blue-500/30 bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/40 dark:bg-blue-500/10"
                  : "text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-500/10"
              }
            >
              {payoutOverrides.length} {overrideLabel}
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
        {totalExpenses > 0 && (
          <div className="flex justify-between">
            <span>Total gastos:</span>
            <span>{formatCurrency(totalExpenses)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
