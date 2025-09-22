import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Euro, Users, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useTourJobRateQuotes } from "@/hooks/useTourJobRateQuotes";
import { TourJobRateQuote } from "@/types/tourRates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface TourRatesPanelProps {
  jobId: string;
}

export const TourRatesPanel: React.FC<TourRatesPanelProps> = ({ jobId }) => {
  const { data: quotes, isLoading, error } = useTourJobRateQuotes(jobId);

  // Fetch technician profiles for display names
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-tour-rates', quotes?.map(q => q.technician_id)],
    queryFn: async () => {
      if (!quotes?.length) return [];
      
      const techIds = [...new Set(quotes.map(q => q.technician_id))];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', techIds);
      
      if (error) throw error;
      return data;
    },
    enabled: !!quotes?.length,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Tour Rates
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
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load tour rates: {error.message}
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
            Tour Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No tour rate assignments found for this job.</p>
        </CardContent>
      </Card>
    );
  }

  // Group quotes by ISO week
  const weekGroups = quotes.reduce((groups, quote) => {
    // Handle null values for iso_year and iso_week
    const year = quote.iso_year || new Date().getFullYear();
    const week = quote.iso_week || 1;
    const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
    if (!groups[weekKey]) {
      groups[weekKey] = [];
    }
    groups[weekKey].push(quote);
    return groups;
  }, {} as Record<string, TourJobRateQuote[]>);

  const getTechnicianName = (techId: string) => {
    const profile = profiles?.find(p => p.id === techId);
    return profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Tour Rates (No Timesheets)
        </h3>
        <Badge variant="outline" className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {quotes.length} assignments
        </Badge>
      </div>

      <Alert>
        <AlertDescription>
          Tour dates use fixed rates without timesheet logging. Weekly multipliers apply only to technicians on the tour team for this routing (including house technicians when they are on the tour team).
        </AlertDescription>
      </Alert>

      {Object.entries(weekGroups).map(([weekKey, weekQuotes]) => (
        <Card key={weekKey}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Week {weekKey}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weekQuotes.map((quote) => (
                <div key={`${quote.job_id}-${quote.technician_id}`} className="space-y-3">
                  {/* Main quote card */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{getTechnicianName(quote.technician_id)}</span>
                        {quote.is_house_tech && (
                          <Badge variant="secondary" className="text-xs">House Tech</Badge>
                        )}
                        {quote.category && (
                          <Badge variant="outline" className="text-xs">
                            {quote.category.charAt(0).toUpperCase() + quote.category.slice(1)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(quote.start_time), 'MMM d, yyyy')} • {quote.title}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        {formatCurrency(quote.total_with_extras_eur || quote.total_eur)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(quote.base_day_eur)} × {quote.multiplier}
                        {quote.week_count > 1 && ` (${quote.week_count} dates)`}
                        {quote.extras_total_eur && quote.extras_total_eur > 0 && (
                          <div className="text-green-600 mt-1">
                            +{formatCurrency(quote.extras_total_eur)} extras
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Extras breakdown */}
                  {quote.extras && quote.extras.items && quote.extras.items.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm font-medium text-green-800 mb-2">Job Extras:</div>
                      <div className="space-y-1">
                        {quote.extras.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm text-green-700">
                            <span>{item.extra_type.replace('_', ' ')} × {item.quantity}</span>
                            <span>{formatCurrency(item.amount_eur)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-medium text-green-800 border-t border-green-300 pt-1 mt-2">
                          <span>Extras Total:</span>
                          <span>{formatCurrency(quote.extras.total_eur)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vehicle disclaimer */}
                  {quote.vehicle_disclaimer && quote.vehicle_disclaimer_text && (
                    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{quote.vehicle_disclaimer_text}</span>
                    </div>
                  )}

                  {/* Error breakdown */}
                  {quote.breakdown?.error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        {quote.breakdown.error === 'category_missing' && 'Missing category - please set technician category'}
                        {quote.breakdown.error === 'house_rate_missing' && 'Missing house tech rate - please configure in settings'}
                        {quote.breakdown.error === 'tour_base_missing' && 'Missing tour base rate for category'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
            
            {/* Week total */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-between items-center font-semibold">
                <span>Week Total:</span>
                <span className="text-lg">
                  {formatCurrency(weekQuotes.reduce((sum, quote) => sum + (quote.total_with_extras_eur || quote.total_eur), 0))}
                </span>
              </div>
              
              {/* Week breakdown */}
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Base rates:</span>
                  <span>{formatCurrency(weekQuotes.reduce((sum, quote) => sum + quote.total_eur, 0))}</span>
                </div>
                {weekQuotes.some(q => q.extras_total_eur && q.extras_total_eur > 0) && (
                  <div className="flex justify-between text-green-600">
                    <span>Extras:</span>
                    <span>{formatCurrency(weekQuotes.reduce((sum, quote) => sum + (quote.extras_total_eur || 0), 0))}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Grand total */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center font-bold text-lg">
            <span>Total Job Amount:</span>
            <span className="text-xl">
              {formatCurrency(quotes.reduce((sum, quote) => sum + (quote.total_with_extras_eur || quote.total_eur), 0))}
            </span>
          </div>
          
          {/* Grand total breakdown */}
          <div className="text-sm text-muted-foreground mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Total base rates:</span>
              <span>{formatCurrency(quotes.reduce((sum, quote) => sum + quote.total_eur, 0))}</span>
            </div>
            {quotes.some(q => q.extras_total_eur && q.extras_total_eur > 0) && (
              <div className="flex justify-between text-green-600">
                <span>Total extras:</span>
                <span>{formatCurrency(quotes.reduce((sum, quote) => sum + (quote.extras_total_eur || 0), 0))}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
