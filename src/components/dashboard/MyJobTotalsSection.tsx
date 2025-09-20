import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Euro, AlertCircle, Calendar, CheckCircle } from 'lucide-react';
import { useMyJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useTechnicianTourRateQuotes } from '@/hooks/useTourJobRateQuotes';
import { formatCurrency } from '@/lib/utils';

export function MyJobTotalsSection() {
  const { data: payoutTotals = [], isLoading: isLoadingPayouts } = useMyJobPayoutTotals();
  const { data: tourQuotes = [], isLoading: isLoadingTours } = useTechnicianTourRateQuotes();

  const isLoading = isLoadingPayouts || isLoadingTours;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            My Job Totals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading your job totals...</div>
        </CardContent>
      </Card>
    );
  }

  const hasAnyTotals = payoutTotals.length > 0 || tourQuotes.length > 0;

  if (!hasAnyTotals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            My Job Totals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No job totals available yet.</div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalNonTourAmount = payoutTotals.reduce((sum, payout) => sum + payout.total_eur, 0);
  const totalTourAmount = tourQuotes.reduce((sum, quote) => sum + (quote.total_with_extras_eur || quote.total_eur), 0);
  const grandTotal = totalNonTourAmount + totalTourAmount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Euro className="h-5 w-5" />
          My Job Totals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Non-tour jobs */}
        {payoutTotals.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Regular Jobs ({payoutTotals.length})
            </h4>
            
            <div className="space-y-2 pl-6">
              {payoutTotals.map((payout) => (
                <div key={`${payout.job_id}-${payout.technician_id}`} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">Job {payout.job_id.substring(0, 8)}...</span>
                    <div className="text-xs text-muted-foreground">
                      Timesheets: {formatCurrency(payout.timesheets_total_eur)}
                      {payout.extras_total_eur > 0 && (
                        <> + Extras: {formatCurrency(payout.extras_total_eur)}</>
                      )}
                    </div>
                    {payout.vehicle_disclaimer && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        <span>Vehicle compensation may apply</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">
                    {formatCurrency(payout.total_eur)}
                  </Badge>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center pl-6 pt-2 border-t">
              <span className="font-medium">Regular Jobs Total:</span>
              <Badge variant="default">
                {formatCurrency(totalNonTourAmount)}
              </Badge>
            </div>
          </div>
        )}

        {/* Tour jobs */}
        {tourQuotes.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Tour Dates ({tourQuotes.length})
            </h4>
            
            <div className="space-y-2 pl-6">
              {tourQuotes.map((quote) => (
                <div key={`${quote.job_id}-${quote.technician_id}`} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">
                      {quote.title || `Job ${quote.job_id.substring(0, 8)}...`}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      Base: {formatCurrency(quote.total_eur)}
                      {quote.extras_total_eur && quote.extras_total_eur > 0 && (
                        <> + Extras: {formatCurrency(quote.extras_total_eur)}</>
                      )}
                      {quote.is_house_tech && <span className="ml-2 text-blue-600">(House Tech)</span>}
                    </div>
                    {quote.vehicle_disclaimer && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        <span>Vehicle compensation may apply</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">
                    {formatCurrency(quote.total_with_extras_eur || quote.total_eur)}
                  </Badge>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center pl-6 pt-2 border-t">
              <span className="font-medium">Tour Dates Total:</span>
              <Badge variant="default">
                {formatCurrency(totalTourAmount)}
              </Badge>
            </div>
          </div>
        )}

        {/* Grand total */}
        {hasAnyTotals && (
          <>
            <Separator />
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Grand Total:</span>
              <Badge variant="default" className="text-lg px-4 py-2">
                {formatCurrency(grandTotal)}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}