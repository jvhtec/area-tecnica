import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Euro, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useTourJobRateQuotes, TourJobRateQuote } from "@/hooks/useTourJobRateQuotes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
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
          Tour dates use fixed rates without timesheet logging. House technicians receive their profile-specific rate, while other technicians receive category-based rates with weekly multipliers.
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
            <div className="space-y-3">
              {weekQuotes.map((quote) => (
                <div key={`${quote.job_id}-${quote.technician_id}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                    {quote.breakdown?.error && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTriangle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          {quote.breakdown.error === 'category_missing' && 'Missing category - please set technician category'}
                          {quote.breakdown.error === 'house_rate_missing' && 'Missing house tech rate - please configure in settings'}
                          {quote.breakdown.error === 'tour_base_missing' && 'Missing tour base rate for category'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg">{formatCurrency(quote.total_eur)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(quote.base_day_eur)} × {quote.multiplier}
                      {quote.week_count > 1 && ` (${quote.week_count} dates)`}
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

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center font-bold text-lg">
            <span>Total Job Amount:</span>
            <span className="text-xl">
              {formatCurrency(quotes.reduce((sum, quote) => sum + quote.total_eur, 0))}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};