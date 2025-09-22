import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Euro, Info } from "lucide-react";
import { format } from "date-fns";
import { useTechnicianTourRateQuotes } from "@/hooks/useTourJobRateQuotes";

export const TechnicianTourRates: React.FC = () => {
  const { data: quotes, isLoading, error } = useTechnicianTourRateQuotes();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Your Tour Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load your tour rates: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!quotes?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Your Tour Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You have no upcoming tour date assignments.</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const isHouseTech = quotes[0]?.is_house_tech;
  const MAX_VISIBLE = 5;
  const visibleQuotes = quotes.slice(0, MAX_VISIBLE);
  const remainingCount = Math.max(0, quotes.length - visibleQuotes.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Your Tour Rates
          </CardTitle>
          <Badge variant="outline">{quotes.length} upcoming dates</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {isHouseTech
              ? "As a house technician, you receive your profile-specific base rate for all tour dates. Weekly multipliers do not apply."
              : "Tour rates are based on your category. Weekly multipliers only apply if you're on the tour team for that routing."
            }
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {visibleQuotes.map((quote) => (
            <div key={quote.job_id} className="flex flex-col gap-3 rounded-lg border border-muted bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium leading-tight">{quote.title}</span>
                  {quote.category && (
                    <Badge variant="outline" className="text-xs">
                      {quote.category.charAt(0).toUpperCase() + quote.category.slice(1)}
                    </Badge>
                  )}
                  {quote.is_house_tech && (
                    <Badge variant="secondary" className="text-xs">House Rate</Badge>
                  )}
                  {!quote.is_house_tech && quote.is_tour_team_member && quote.multiplier > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Week multiplier ×{quote.multiplier}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(new Date(quote.start_time), 'EEEE, MMM d, yyyy')}
                </div>
                {!quote.is_house_tech && !quote.is_tour_team_member && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Tour multiplier not applied — you are not on the tour team for this routing.
                  </div>
                )}
              </div>
              <div className="sm:text-right">
                <div className="font-semibold text-lg">{formatCurrency(quote.total_eur)}</div>
                <div className="text-xs text-muted-foreground">
                  Base {formatCurrency(quote.base_day_eur)}
                  {(!quote.is_house_tech && quote.is_tour_team_member && quote.multiplier > 1) && (
                    <span> × {quote.multiplier} ({quote.week_count} dates)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {remainingCount > 0 && (
          <p className="text-xs text-muted-foreground">
            +{remainingCount} more tour dates scheduled further out. Check the tour calendar for the full list.
          </p>
        )}

        <div className="border-t pt-3 text-xs text-muted-foreground">
          Amounts shown above are per tour date. Contact production for detailed breakdowns.
        </div>
      </CardContent>
    </Card>
  );
};
