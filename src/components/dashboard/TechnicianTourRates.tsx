import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Euro, Info, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format, getISOWeek, getISOWeekYear, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useTechnicianTourRateQuotes } from "@/hooks/useTourJobRateQuotes";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useTourRatesApprovalMap } from "@/hooks/useTourRatesApproval";
import { useJobRatesApprovalMap } from "@/hooks/useJobRatesApproval";
import type { TourJobRateQuote } from "@/types/tourRates";

export const TechnicianTourRates: React.FC = () => {
  const { data: quotes, isLoading, error } = useTechnicianTourRateQuotes();
  const { userRole } = useOptimizedAuth();
  // Always compute tourIds and call the hook (it self-disables when empty)
  const tourIds = useMemo(
    () => Array.from(new Set((quotes || []).map(q => q.tour_id).filter(Boolean))) as string[],
    [quotes]
  );
  const jobIds = useMemo(
    () => Array.from(new Set((quotes || []).map(q => q.job_id).filter(Boolean))) as string[],
    [quotes]
  );
  const { data: tourApprovalMap } = useTourRatesApprovalMap(tourIds);
  const { data: jobApprovalMap } = useJobRatesApprovalMap(jobIds);
  // Local state/hooks must not be behind conditional returns
  const [expanded, setExpanded] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDatesBadge = (count: number) => {
    if (count === 1) return '1 fecha esta semana';
    return `${count} fechas esta semana`;
  };

  const weekGroups = useMemo(() => {
    const list = quotes || [];
    return list.reduce((groups, quote) => {
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
  const quoteHasExtras = (quote: TourJobRateQuote) => {
    if ((quote.extras_total_eur ?? 0) > 0) {
      return true;
    }
    return quote.extras?.items?.some(item => item.quantity > 0 && item.amount_eur > 0) ?? false;
  };

  const isQuoteApproved = (quote: TourJobRateQuote) => {
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

  const approvedQuotes = selectedQuotes.filter((quote) => isQuoteApproved(quote));
  const pendingQuotes = selectedQuotes.filter((quote) => !isQuoteApproved(quote));
  const isHouseTech = (quotes && quotes[0]) ? quotes[0].is_house_tech : false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Tus tarifas de gira
          </CardTitle>
          <Badge variant="outline">{formatDatesBadge(selectedQuotes.length)}</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? 'Contraer tarifas de gira' : 'Expandir tarifas de gira'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>
                No se pudieron cargar tus tarifas de gira: {(error as any).message}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {isHouseTech
                    ? "Como técnico residente, recibes la tarifa base específica de tu perfil. Los multiplicadores semanales se aplican cuando formas parte del equipo de la gira."
                    : "Las tarifas de gira usan tu tarifa base de categoría. Los multiplicadores semanales solo se aplican si estás en el equipo de la gira para ese itinerario."}
                </AlertDescription>
              </Alert>

              {(!quotes || quotes.length === 0) && (
                <div className="text-muted-foreground">No tienes asignaciones de fechas de gira próximas.</div>
              )}

          {allowedWeekKeys.length > 0 && activeWeekKey && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium">
                {(() => {
                  const [year, week] = activeWeekKey.split('-W').map(Number);
                  const sampleDate = selectedQuotes[0] ? new Date(selectedQuotes[0].start_time) : new Date();
                  const weekStart = startOfWeek(sampleDate, { weekStartsOn: 1 });
                  const weekEnd = endOfWeek(sampleDate, { weekStartsOn: 1 });
                  return `Semana ${week} de ${year} (${format(weekStart, "d 'de' MMM", { locale: es })} - ${format(weekEnd, "d 'de' MMM", { locale: es })})`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => activeWeekIndex > 0 && setActiveWeekKey(allowedWeekKeys[activeWeekIndex - 1])}
                  disabled={activeWeekIndex <= 0}
                  aria-label="Semana anterior"
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
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

            <div className="space-y-3">
              {approvedQuotes.length > 0 ? (
                approvedQuotes.map((quote) => {
                  const displayTotal = quote.total_with_extras_eur ?? quote.total_eur ?? 0;
                  const baseDayAmount = quote.base_day_eur ?? 0;
                  const extrasAmount = quote.extras_total_eur ?? 0;
                  return (
                    <div
                      key={quote.job_id}
                      className="flex flex-col gap-3 rounded-lg border border-muted bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium leading-tight">{quote.title}</span>
                          {quote.category && (
                            <Badge variant="outline" className="text-xs">
                              {quote.category.charAt(0).toUpperCase() + quote.category.slice(1)}
                            </Badge>
                          )}
                          {quote.is_house_tech && (
                            <Badge variant="secondary" className="text-xs">Tarifa fija</Badge>
                          )}
                          {quote.is_tour_team_member && quote.multiplier > 1 && (
                            <Badge variant="outline" className="text-xs">
                              Multiplicador semanal ×{quote.multiplier}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {format(new Date(quote.start_time), "EEEE, d 'de' MMM, yyyy", { locale: es })}
                        </div>
                        {!quote.is_tour_team_member && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Multiplicador de gira no aplicado: no formas parte del equipo de la gira para este recorrido.
                          </div>
                        )}
                      </div>
                      <div className="sm:text-right">
                        <div className="font-semibold text-lg">{formatCurrency(displayTotal)}</div>
                        <div className="text-xs text-muted-foreground">
                          Base {formatCurrency(baseDayAmount)}
                          {quote.is_tour_team_member && quote.multiplier > 1 && (
                            <span> × {quote.multiplier} ({quote.week_count} {quote.week_count === 1 ? 'fecha' : 'fechas'})</span>
                          )}
                          {extrasAmount > 0 && (
                            <span className="block text-green-600 mt-1">+ Extras {formatCurrency(extrasAmount)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  {pendingQuotes.length > 0
                    ? 'Las tarifas de esta semana están pendientes de aprobación de la gira o de los extras.'
                    : 'No hay tarifas de gira registradas para esta semana.'}
                </div>
              )}
            </div>

            {pendingQuotes.length > 0 && (
              <Alert>
                <AlertDescription>
                  Algunas fechas no se muestran hasta que la dirección apruebe la tarifa base del tour y los extras correspondientes.
                </AlertDescription>
              </Alert>
            )}

            <div className="border-t pt-3 text-xs text-muted-foreground">
              Los importes mostrados son por fecha de gira. Usa la paginación para revisar recorridos pasados o futuros.
            </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};
