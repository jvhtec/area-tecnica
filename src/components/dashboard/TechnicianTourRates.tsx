import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Euro, Calendar, Info } from "lucide-react";
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

  // Group by tour and week for better organization
  const tourGroups = quotes.reduce((groups, quote) => {
    const tourKey = quote.tour_id || 'standalone';
    if (!groups[tourKey]) {
      groups[tourKey] = {};
    }
    
    const weekKey = `${quote.iso_year}-W${quote.iso_week.toString().padStart(2, '0')}`;
    if (!groups[tourKey][weekKey]) {
      groups[tourKey][weekKey] = [];
    }
    
    groups[tourKey][weekKey].push(quote);
    return groups;
  }, {} as Record<string, Record<string, typeof quotes>>);

  const isHouseTech = quotes[0]?.is_house_tech;
  const totalAmount = quotes.reduce((sum, quote) => sum + quote.total_eur, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Your Tour Rates
        </h3>
        <Badge variant="outline">
          {quotes.length} upcoming dates
        </Badge>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {isHouseTech 
            ? "As a house technician, you receive your profile-specific base rate for all tour dates. Weekly multipliers do not apply."
            : "Tour rates are calculated using category-based rates with weekly multipliers. No time logging is required for tour dates."
          }
        </AlertDescription>
      </Alert>

      {Object.entries(tourGroups).map(([tourId, weeks]) => (
        <div key={tourId} className="space-y-4">
          {Object.entries(weeks).map(([weekKey, weekQuotes]) => (
            <Card key={weekKey}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Week {weekKey}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weekQuotes.map((quote) => (
                    <div key={quote.job_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{quote.title}</span>
                          {quote.is_house_tech && (
                            <Badge variant="secondary" className="text-xs">House Rate</Badge>
                          )}
                          {quote.category && (
                            <Badge variant="outline" className="text-xs">
                              {quote.category.charAt(0).toUpperCase() + quote.category.slice(1)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(quote.start_time), 'EEEE, MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg">{formatCurrency(quote.total_eur)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(quote.base_day_eur)}
                          {!quote.is_house_tech && quote.multiplier !== 1 && (
                            <span> × {quote.multiplier} ({quote.week_count} dates)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-3 border-t">
                  <div className="flex justify-between items-center font-semibold">
                    <span>Week Total:</span>
                    <span className="text-lg">
                      {formatCurrency(weekQuotes.reduce((sum, quote) => sum + quote.total_eur, 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center font-bold text-lg">
            <span>Total Upcoming Tour Amount:</span>
            <span className="text-xl text-primary">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};