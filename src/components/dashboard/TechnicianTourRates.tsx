import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Euro, Info, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertTriangle, Calendar } from "lucide-react";
import { format, getISOWeek, getISOWeekYear, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useTechnicianTourRateQuotes } from "@/hooks/useTourJobRateQuotes";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useTourRatesApprovalMap } from "@/hooks/useTourRatesApproval";
import { useJobRatesApprovalMap } from "@/hooks/useJobRatesApproval";
import { calculateQuoteTotal, formatMultiplier, getPerJobMultiplier, shouldDisplayMultiplier } from "@/lib/tourRateMath";
import type { TourJobRateQuote } from "@/types/tourRates";

interface TechnicianTourRatesProps {
  theme?: {
    bg: string;
    nav: string;
    card: string;
    textMain: string;
    textMuted: string;
    accent: string;
    input: string;
    modalOverlay: string;
    divider: string;
    danger: string;
    success: string;
    warning: string;
    cluster: string;
  };
  isDark?: boolean;
}

export const TechnicianTourRates: React.FC<TechnicianTourRatesProps> = ({ theme, isDark = false }) => {
  const { data: quotes, isLoading, error } = useTechnicianTourRateQuotes();
  const { userRole } = useOptimizedAuth();

  // Default theme fallback
  const t = theme || {
    bg: isDark ? "bg-[#05070a]" : "bg-slate-50",
    nav: isDark ? "bg-[#0f1219] border-t border-[#1f232e]" : "bg-white border-t border-slate-200",
    card: isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-white border-slate-200 shadow-sm",
    textMain: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-[#94a3b8]" : "text-slate-500",
    accent: "bg-blue-600 hover:bg-blue-500 text-white",
    input: isDark ? "bg-[#0a0c10] border-[#2a2e3b] text-white focus:border-blue-500" : "bg-white border-slate-300 text-slate-900 focus:border-blue-500",
    modalOverlay: isDark ? "bg-black/90 backdrop-blur-md" : "bg-slate-900/40 backdrop-blur-md",
    divider: isDark ? "border-[#1f232e]" : "border-slate-100",
    danger: isDark ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-red-700 bg-red-50 border-red-200",
    success: isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-700 bg-emerald-50 border-emerald-200",
    warning: isDark ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-700 bg-amber-50 border-amber-200",
    cluster: isDark ? "bg-white text-black" : "bg-slate-900 text-white"
  };

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
    // For tour dates, tour must be approved first
    if (quote.tour_id) {
      const tourApproved = tourApprovalMap?.get(quote.tour_id) ?? false;
      if (!tourApproved) {
        return false;
      }

      // Job-level approval is only required if extras exist
      const extrasPresent = quoteHasExtras(quote);
      if (extrasPresent) {
        return quote.job_id ? (jobApprovalMap?.get(quote.job_id) ?? false) : false;
      }

      // No extras = tour approval is sufficient
      return true;
    }

    // For standalone jobs (no tour_id), approval depends on extras
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
    <div className={`rounded-2xl border ${t.card} overflow-hidden`}>
      <div
        className={`p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600'}`}>
            <Euro size={20} />
          </div>
          <div>
            <h3 className={`font-bold ${t.textMain}`}>Tus tarifas de gira</h3>
            <div className={`text-xs ${t.textMuted} flex items-center gap-2`}>
              {formatDatesBadge(selectedQuotes.length)}
            </div>
          </div>
        </div>
        <div className={t.textMuted}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {expanded && (
        <div className={`p-4 border-t ${t.divider} space-y-4`}>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className={`h-4 ${isDark ? 'bg-white/10' : 'bg-slate-200'} rounded w-3/4`}></div>
              <div className={`h-4 ${isDark ? 'bg-white/10' : 'bg-slate-200'} rounded w-1/2`}></div>
            </div>
          ) : error ? (
            <div className={`p-3 rounded-lg ${t.danger} flex items-start gap-2 text-sm`}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>No se pudieron cargar tus tarifas de gira: {(error as any).message}</span>
            </div>
          ) : (
            <>
              <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'} text-xs flex gap-2`}>
                <Info className="h-4 w-4 shrink-0" />
                <span>
                  {isHouseTech
                    ? "Como técnico residente, recibes la tarifa base específica de tu perfil. Los multiplicadores semanales se aplican cuando formas parte del equipo de la gira."
                    : "Las tarifas de gira usan tu tarifa base de categoría. Los multiplicadores semanales solo se aplican si estás en el equipo de la gira para ese itinerario."}
                </span>
              </div>

              {(!quotes || quotes.length === 0) && (
                <div className={`text-sm ${t.textMuted} text-center py-4`}>
                  No tienes asignaciones de fechas de gira próximas.
                </div>
              )}

              {allowedWeekKeys.length > 0 && activeWeekKey && (
                <div className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => activeWeekIndex > 0 && setActiveWeekKey(allowedWeekKeys[activeWeekIndex - 1])}
                    disabled={activeWeekIndex <= 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="text-xs font-bold text-center">
                    {(() => {
                      const [year, week] = activeWeekKey.split('-W').map(Number);
                      const sampleDate = selectedQuotes[0] ? new Date(selectedQuotes[0].start_time) : new Date();
                      const weekStart = startOfWeek(sampleDate, { weekStartsOn: 1 });
                      const weekEnd = endOfWeek(sampleDate, { weekStartsOn: 1 });
                      return (
                        <div className="flex flex-col items-center">
                          <span className={t.textMain}>Semana {week} de {year}</span>
                          <span className={t.textMuted}>
                            {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM", { locale: es })}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => activeWeekIndex >= 0 && activeWeekIndex < allowedWeekKeys.length - 1 && setActiveWeekKey(allowedWeekKeys[activeWeekIndex + 1])}
                    disabled={activeWeekIndex === allowedWeekKeys.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {approvedQuotes.length > 0 ? (
                  approvedQuotes.map((quote) => {
                    const displayTotal = calculateQuoteTotal(quote);
                    const baseDayAmount = quote.base_day_eur ?? 0;
                    const extrasAmount = quote.extras_total_eur ?? 0;
                    const perJobMultiplier = getPerJobMultiplier(quote);
                    const breakdownBase = quote.breakdown?.after_discount ?? quote.breakdown?.base_calculation;
                    const hasValidMultiplier = typeof perJobMultiplier === 'number' && perJobMultiplier > 0;
                    const preMultiplierBase =
                      breakdownBase ?? (hasValidMultiplier ? baseDayAmount / perJobMultiplier : baseDayAmount);
                    const formattedMultiplier = formatMultiplier(perJobMultiplier);
                    const trimmedMultiplier = formattedMultiplier.startsWith('×')
                      ? formattedMultiplier.slice(1)
                      : formattedMultiplier;
                    const hasError = quote.breakdown?.error;

                    return (
                      <div
                        key={quote.job_id}
                        className={`rounded-xl border ${t.divider} p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className={`font-bold text-sm ${t.textMain}`}>{quote.title}</div>
                            <div className={`text-xs ${t.textMuted} flex items-center gap-1 mt-0.5`}>
                              <Calendar size={10} />
                              {format(new Date(quote.start_time), "EEEE, d 'de' MMM", { locale: es })}
                            </div>
                          </div>
                          <div className={`font-bold text-lg ${t.textMain}`}>
                            {formatCurrency(displayTotal)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {quote.category && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${t.divider} ${t.textMuted}`}>
                              {quote.category}
                            </span>
                          )}
                          {quote.is_house_tech && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-purple-500/10 text-purple-500 border border-purple-500/20`}>
                              Fija
                            </span>
                          )}
                          {quote.is_tour_team_member && shouldDisplayMultiplier(quote.multiplier) && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20`}>
                              Multiplicador {formatMultiplier(quote.multiplier)}
                            </span>
                          )}
                        </div>

                        {!quote.is_tour_team_member && !hasError && (
                          <div className={`text-xs ${t.textMuted} mb-2 italic`}>
                            Multiplicador de gira no aplicado: no formas parte del equipo de la gira para este recorrido.
                          </div>
                        )}

                        {hasError && (
                          <div className={`p-2 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-xs mb-2`}>
                            <div className="flex gap-1.5">
                              <AlertTriangle size={12} className="mt-0.5" />
                              <span>
                                {quote.breakdown.error === 'category_missing' && 'Falta configurar tu categoría de técnico.'}
                                {quote.breakdown.error === 'house_rate_missing' && 'Falta configurar tu tarifa de técnico residente.'}
                                {quote.breakdown.error === 'tour_base_missing' && 'Falta la tarifa base de gira para tu categoría.'}
                                {!['category_missing', 'house_rate_missing', 'tour_base_missing'].includes(quote.breakdown.error) && `Error: ${quote.breakdown.error}`}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className={`text-xs ${t.textMuted} pt-2 border-t ${t.divider} flex justify-between items-center`}>
                          <span>
                            {quote.is_tour_team_member && shouldDisplayMultiplier(perJobMultiplier) ? (
                              <>Base {formatCurrency(preMultiplierBase)} × {trimmedMultiplier}</>
                            ) : (
                              <>Base {formatCurrency(baseDayAmount)}</>
                            )}
                          </span>
                          {extrasAmount > 0 && (
                            <span className="text-emerald-500 font-medium">+ Extras {formatCurrency(extrasAmount)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`text-sm ${t.textMuted} text-center py-6 italic`}>
                    {pendingQuotes.length > 0
                      ? 'Las tarifas de esta semana están pendientes de aprobación.'
                      : 'No hay tarifas de gira registradas para esta semana.'}
                  </div>
                )}
              </div>

              {pendingQuotes.length > 0 && (
                <div className={`p-3 rounded-lg ${t.warning} text-xs flex gap-2`}>
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Algunas fechas no se muestran hasta que la dirección apruebe tanto la tarifa base del tour como cada fecha individual.
                  </span>
                </div>
              )}

              <div className={`border-t ${t.divider} pt-3 text-[10px] ${t.textMuted} text-center`}>
                Los importes mostrados son por fecha de gira. Usa la paginación para revisar recorridos pasados o futuros.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
