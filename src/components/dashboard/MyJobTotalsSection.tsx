import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Euro, AlertCircle, Calendar, CheckCircle } from 'lucide-react';
import { useMyJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useTechnicianTourRateQuotes } from '@/hooks/useTourJobRateQuotes';
import { formatCurrency } from '@/lib/utils';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTourRatesApprovalMap } from '@/hooks/useTourRatesApproval';
import { useJobRatesApprovalMap } from '@/hooks/useJobRatesApproval';
import type { TourJobRateQuote } from '@/types/tourRates';

export function MyJobTotalsSection() {
  const { userRole } = useOptimizedAuth();
  const { data: payoutTotals = [], isLoading: isLoadingPayouts } = useMyJobPayoutTotals();
  const { data: tourQuotes = [], isLoading: isLoadingTours } = useTechnicianTourRateQuotes();

  const tourIds = useMemo(
    () => Array.from(new Set((tourQuotes || []).map(q => q.tour_id).filter(Boolean))) as string[],
    [tourQuotes]
  );
  const tourJobIds = useMemo(
    () => Array.from(new Set((tourQuotes || []).map(q => q.job_id).filter(Boolean))) as string[],
    [tourQuotes]
  );
  const regularJobIds = useMemo(
    () => Array.from(new Set(payoutTotals.map(p => p.job_id))),
    [payoutTotals]
  );
  const jobIdsForApproval = useMemo(
    () => Array.from(new Set([...regularJobIds, ...tourJobIds])),
    [regularJobIds, tourJobIds]
  );

  const { data: tourApprovalMap } = useTourRatesApprovalMap(tourIds);
  const { data: jobApprovalMap } = useJobRatesApprovalMap(jobIdsForApproval);

  const isLoading = isLoadingPayouts || isLoadingTours;

  const isTech = ['technician', 'house_tech'].includes(userRole || '');

  const quoteHasExtras = (quote: TourJobRateQuote) => {
    if ((quote.extras_total_eur ?? 0) > 0) {
      return true;
    }
    return quote.extras?.items?.some(item => item.quantity > 0 && item.amount_eur > 0) ?? false;
  };

  const isTourQuoteApproved = (quote: TourJobRateQuote) => {
    const tourApproved = !quote.tour_id || (tourApprovalMap?.get(quote.tour_id) ?? false);
    if (!tourApproved) {
      return false;
    }

    const extrasPresent = quoteHasExtras(quote);
    if (!extrasPresent) {
      return true;
    }

    if (!quote.job_id) {
      return false;
    }

    return jobApprovalMap?.get(quote.job_id) ?? false;
  };

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
  const approvedTourQuotes = tourQuotes.filter((quote) => isTourQuoteApproved(quote));
  const pendingTourQuotes = tourQuotes.filter((quote) => !isTourQuoteApproved(quote));

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
  const approvedPayouts = payoutTotals.filter(p => jobApprovalMap?.get(p.job_id) ?? false);
  const pendingPayouts = payoutTotals.filter(p => !(jobApprovalMap?.get(p.job_id) ?? false));
  const totalNonTourAmount = approvedPayouts.reduce((sum, payout) => sum + payout.total_eur, 0);
  const totalTourAmount = approvedTourQuotes.reduce((sum, quote) => {
    const base = quote.total_with_extras_eur ?? quote.total_eur ?? 0;
    return sum + base;
  }, 0);
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
        {approvedPayouts.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Regular Jobs ({approvedPayouts.length})
            </h4>
            
            <div className="space-y-2 pl-6">
              {approvedPayouts.map((payout) => (
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

        {pendingPayouts.length > 0 && (
          <Alert>
            <AlertDescription>
              Some regular job amounts are hidden until management approves rates for those jobs.
            </AlertDescription>
          </Alert>
        )}

        {/* Tour jobs */}
        {approvedTourQuotes.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Tour Dates ({approvedTourQuotes.length})
            </h4>
            
            <div className="space-y-2 pl-6">
              {approvedTourQuotes.map((quote) => (
                <div key={`${quote.job_id}-${quote.technician_id}`} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">
                      {quote.title || `Job ${quote.job_id.substring(0, 8)}...`}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      Base: {formatCurrency(quote.total_eur ?? 0)}
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
                    {formatCurrency((quote.total_with_extras_eur ?? quote.total_eur ?? 0))}
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

        {pendingTourQuotes.length > 0 && (
          <Alert>
            <AlertDescription>
              Some tour amounts are hidden until management finalizes the tour base rates and approves per-date extras.
            </AlertDescription>
          </Alert>
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
