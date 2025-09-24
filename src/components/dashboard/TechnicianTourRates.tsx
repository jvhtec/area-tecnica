import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Euro, Info, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format, getISOWeek, getISOWeekYear, startOfWeek, endOfWeek } from "date-fns";
import { useTechnicianTourRateQuotes } from "@/hooks/useTourJobRateQuotes";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useTourRatesApprovalMap } from "@/hooks/useTourRatesApproval";

export const TechnicianTourRates: React.FC = () => {
  const { data: quotes, isLoading, error } = useTechnicianTourRateQuotes();
  const { userRole } = useOptimizedAuth();

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

  const tourIds = Array.from(new Set((quotes || []).map(q => q.tour_id).filter(Boolean))) as string[];
  const { data: approvalMap } = useTourRatesApprovalMap(tourIds);

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

  const [expanded, setExpanded] = useState(true);

  const weekGroups = useMemo(() => {
    return quotes.reduce((groups, quote) => {
      const weekKey = quote.iso_year && quote.iso_week
        ? `${quote.iso_year}-W${quote.iso_week.toString().padStart(2, '0')}`
        : `${getISOWeekYear(new Date(quote.start_time))}-W${getISOWeek(new Date(quote.start_time)).toString().padStart(2, '0')}`;
      if (!groups[weekKey]) {
        groups[weekKey] = [];
      }
      groups[weekKey].push(quote);
      return groups;
    }, {} as Record<string, typeof quotes>);
  }, [quotes]);

  const sortedWeekKeys = useMemo(() => {
    return Object.keys(weekGroups).sort((a, b) => {
      const [aYear, aWeek] = a.split('-W').map(Number);
      const [bYear, bWeek] = b.split('-W').map(Number);
      if (aYear === bYear) return aWeek - bWeek;
      return aYear - bYear;
    });
  }, [weekGroups]);

  const currentWeekKey = useMemo(() => {
    const today = new Date();
    return `${getISOWeekYear(today)}-W${getISOWeek(today).toString().padStart(2, '0')}`;
  }, []);

  const [activeWeekKey, setActiveWeekKey] = useState<string | null>(null);

  // Disallow navigating to future weeks
  const allowedWeekKeys = useMemo(() => {
    const [curYear, curWeek] = currentWeekKey.split('-W').map(Number);
    return sortedWeekKeys.filter(k => {
      const [y, w] = k.split('-W').map(Number);
      return y < curYear || (y === curYear && w <= curWeek);
    });
  }, [sortedWeekKeys, currentWeekKey]);

  useEffect(() => {
    if (allowedWeekKeys.length === 0) {
      setActiveWeekKey(null);
      return;
    }
    const matchingKey = allowedWeekKeys.find((key) => key === currentWeekKey);
    // Default to the latest allowed week (usually current, else most recent past)
    setActiveWeekKey(matchingKey ?? allowedWeekKeys[allowedWeekKeys.length - 1]);
  }, [allowedWeekKeys, currentWeekKey]);

  const activeWeekIndex = activeWeekKey ? allowedWeekKeys.indexOf(activeWeekKey) : -1;
  const selectedQuotes = activeWeekKey ? weekGroups[activeWeekKey] ?? [] : [];
  const approvedQuotes = selectedQuotes.filter(q => !q.tour_id || (approvalMap?.get(q.tour_id) ?? false));
  const pendingQuotes = selectedQuotes.filter(q => q.tour_id && !(approvalMap?.get(q.tour_id) ?? false));
  const isHouseTech = quotes[0]?.is_house_tech;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Your Tour Rates
          </CardTitle>
          <Badge variant="outline">{selectedQuotes.length} dates this week</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? 'Collapse tour rates' : 'Expand tour rates'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {isHouseTech
                ? "As a house technician, you receive your profile-specific base rate. Weekly multipliers apply when you're assigned to the tour team."
                : "Tour rates use your category base. Weekly multipliers only apply if you're on the tour team for that routing."
              }
            </AlertDescription>
          </Alert>

          {allowedWeekKeys.length > 0 && activeWeekKey && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium">
                {(() => {
                  const [year, week] = activeWeekKey.split('-W').map(Number);
                  const sampleDate = selectedQuotes[0] ? new Date(selectedQuotes[0].start_time) : new Date();
                  const weekStart = startOfWeek(sampleDate, { weekStartsOn: 1 });
                  const weekEnd = endOfWeek(sampleDate, { weekStartsOn: 1 });
                  return `Week ${week} of ${year} (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => activeWeekIndex > 0 && setActiveWeekKey(allowedWeekKeys[activeWeekIndex - 1])}
                  disabled={activeWeekIndex <= 0}
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {activeWeekIndex + 1} / {allowedWeekKeys.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => activeWeekIndex >= 0 && activeWeekIndex < allowedWeekKeys.length - 1 && setActiveWeekKey(allowedWeekKeys[activeWeekIndex + 1])}
                  disabled={activeWeekIndex === allowedWeekKeys.length - 1}
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {approvedQuotes.length > 0 ? (
              approvedQuotes.map((quote) => (
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
                      {quote.is_tour_team_member && quote.multiplier > 1 && (
                        <Badge variant="outline" className="text-xs">
                          Week multiplier ×{quote.multiplier}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {format(new Date(quote.start_time), 'EEEE, MMM d, yyyy')}
                    </div>
                    {!quote.is_tour_team_member && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Tour multiplier not applied — you are not on the tour team for this routing.
                      </div>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <div className="font-semibold text-lg">{formatCurrency(quote.total_eur)}</div>
                    <div className="text-xs text-muted-foreground">
                      Base {formatCurrency(quote.base_day_eur)}
                      {quote.is_tour_team_member && quote.multiplier > 1 && (
                        <span> × {quote.multiplier} ({quote.week_count} dates)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                {pendingQuotes.length > 0 ? 'Rates for this week are pending approval.' : 'No tour rate entries for this week.'}
              </div>
            )}
          </div>

          <div className="border-t pt-3 text-xs text-muted-foreground">
            Amounts shown are per tour date. Use pagination to review past or upcoming routings.
          </div>
        </CardContent>
      )}
    </Card>
  );
};
