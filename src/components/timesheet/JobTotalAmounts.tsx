import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, Users, TrendingUp, Clock } from "lucide-react";
import { useJobTotals } from "@/hooks/useJobTotals";
import { format } from "date-fns";

interface JobTotalAmountsProps {
  jobId: string;
  jobTitle?: string;
}

export const JobTotalAmounts = ({ jobId, jobTitle }: JobTotalAmountsProps) => {
  const { data: totals, isLoading, error } = useJobTotals(jobId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Loading job totals...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !totals) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load job totals</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const categoryEntries = Object.entries(totals.breakdown_by_category || {}) as Array<[
    string,
    { count?: number; total_eur?: number }
  ]>;
  const hasApprovedAmounts = totals.total_approved_eur > 0;
  const hasPendingAmounts =
    totals.total_pending_eur > 0 || totals.pending_item_count > 0 || totals.expenses_pending_eur > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Job Cost Summary
          {jobTitle && <span className="text-sm font-normal text-muted-foreground">- {jobTitle}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border bg-green-50 border-green-200">
            <p className="text-sm text-green-700 font-medium">Approved Total</p>
            <p className="text-2xl font-bold text-green-800">€{totals.total_approved_eur.toFixed(2)}</p>
            {totals.expenses_total_eur > 0 && (
              <p className="text-xs text-green-700 mt-1">
                Includes €{totals.expenses_total_eur.toFixed(2)} in approved expenses
              </p>
            )}
          </div>
          {hasPendingAmounts && (
            <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
              <p className="text-sm text-yellow-700 font-medium">Pending Submissions</p>
              <p className="text-2xl font-bold text-yellow-800">€{totals.total_pending_eur.toFixed(2)}</p>
              <p className="text-xs text-yellow-700 mt-1">
                {totals.pending_item_count} item{totals.pending_item_count === 1 ? '' : 's'} awaiting review
              </p>
              {totals.expenses_pending_eur > 0 && (
                <p className="text-xs text-yellow-700">
                  €{totals.expenses_pending_eur.toFixed(2)} of the pending total comes from expenses
                </p>
              )}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        {hasApprovedAmounts && categoryEntries.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Breakdown by Category
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {categoryEntries.map(([category, data]) => (
                <div key={category} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="capitalize">
                      {category}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {Number(data.count ?? 0)} timesheet{Number(data.count ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-lg font-bold">€{Number(data.total_eur ?? 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual amounts (only if user can see them) */}
        {totals.user_can_see_all && totals.individual_amounts?.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Individual Timesheet Details</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {totals.individual_amounts.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded border bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.technician_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {item.category}
                      </Badge>
                      <span>{format(new Date(item.date), 'MMM d')}</span>
                    </div>
                  </div>
                  <p className="font-semibold">€{item.amount_eur.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasApprovedAmounts && (
          <div className="text-center p-6 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2" />
            <p>No approved timesheets with calculated amounts yet</p>
            <p className="text-sm mt-1">Totals will appear once timesheets are approved by management</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
