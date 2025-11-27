import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Euro, AlertCircle, Clock, CheckCircle, FileDown, ExternalLink, Send, Receipt } from 'lucide-react';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useManagerJobQuotes } from '@/hooks/useManagerJobQuotes';
import { cn, formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  prepareJobPayoutEmailContext,
  sendJobPayoutEmails,
  type JobPayoutEmailContextResult,
  type TechnicianProfileWithEmail,
} from '@/lib/job-payout-email';
import { sendTourJobEmails } from '@/lib/tour-payout-email';
import { generateJobPayoutPDF, generateRateQuotePDF } from '@/utils/rates-pdf-export';
import { getAutonomoBadgeLabel } from '@/utils/autonomo';
import type { JobExpenseBreakdownItem, JobPayoutTotals } from '@/types/jobExtras';
import type { TourJobRateQuote } from '@/types/tourRates';

interface JobPayoutTotalsPanelProps {
  jobId: string;
  technicianId?: string;
}

const cardBase = "bg-[#0f1219] border-[#1f232e] text-white overflow-hidden";
const surface = "bg-[#151820] border-[#2a2e3b]";
const subtleText = "text-slate-300";
const controlButton = "bg-white/5 border-white/10 text-white hover:bg-white/10";

export function JobPayoutTotalsPanel({ jobId, technicianId }: JobPayoutTotalsPanelProps) {
  const {
    data: jobMeta,
    isLoading: jobMetaLoading,
    error: jobMetaError,
  } = useQuery({
    queryKey: ['job-payout-metadata', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_time, tour_id, rates_approved, job_type')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        title: string;
        start_time: string;
        tour_id: string | null;
        rates_approved: boolean | null;
        job_type: string | null;
      };
    },
    staleTime: 60_000,
  });

  const jobType = jobMeta?.job_type ?? null;
  const isTourDate = jobType === 'tourdate';
  const shouldLoadStandardTotals = !!jobId && !isTourDate && !jobMetaLoading;
  const shouldLoadTourQuotes = !!jobId && isTourDate;

  const {
    data: standardPayoutTotals = [],
    isLoading: standardLoading,
    error: standardError,
  } = useJobPayoutTotals(jobId, technicianId, { enabled: shouldLoadStandardTotals });

  const {
    data: rawTourQuotes = [],
    isLoading: tourQuotesLoading,
    error: tourQuotesError,
  } = useManagerJobQuotes(
    shouldLoadTourQuotes ? jobId : undefined,
    jobType ?? undefined,
    jobMeta?.tour_id ?? undefined
  );

  const visibleTourQuotes = React.useMemo(() => {
    const quotes = (rawTourQuotes as TourJobRateQuote[]) || [];
    if (technicianId) {
      return quotes.filter((quote) => quote.technician_id === technicianId);
    }
    return quotes;
  }, [rawTourQuotes, technicianId]);

  const tourPayoutTotals = React.useMemo<JobPayoutTotals[]>(() => {
    return visibleTourQuotes.map((quote) => {
      const baseTotal = Number(quote.total_eur ?? 0);
      const extrasTotal = Number(
        quote.extras_total_eur ?? (quote.extras?.total_eur != null ? quote.extras.total_eur : 0)
      );
      const totalWithExtras = Number(
        quote.total_with_extras_eur != null ? quote.total_with_extras_eur : baseTotal + extrasTotal
      );
      const extrasBreakdown =
        quote.extras != null
          ? (quote.extras as JobPayoutTotals['extras_breakdown'])
          : ({ items: [], total_eur: extrasTotal } as JobPayoutTotals['extras_breakdown']);

      return {
        job_id: quote.job_id,
        technician_id: quote.technician_id,
        timesheets_total_eur: baseTotal,
        extras_total_eur: extrasTotal,
        total_eur: totalWithExtras,
        extras_breakdown: {
          items: extrasBreakdown.items ?? [],
          total_eur: extrasBreakdown.total_eur ?? extrasTotal,
        },
        vehicle_disclaimer: Boolean(quote.vehicle_disclaimer),
        vehicle_disclaimer_text: quote.vehicle_disclaimer_text ?? undefined,
      } satisfies JobPayoutTotals;
    });
  }, [visibleTourQuotes]);

  const payoutTotals = isTourDate ? tourPayoutTotals : standardPayoutTotals;
  const isLoading = jobMetaLoading || (isTourDate ? tourQuotesLoading : standardLoading);
  const error = jobMetaError ?? (isTourDate ? tourQuotesError : standardError);

  const { data: lpoRows = [] } = useQuery({
    queryKey: ['flex-work-orders-by-job', jobId, technicianId],
    queryFn: async () => {
      let q = supabase.from('flex_work_orders').select('technician_id, lpo_number, flex_element_id').eq('job_id', jobId);
      if (technicianId) q = q.eq('technician_id', technicianId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Array<{ technician_id: string; lpo_number: string | null; flex_element_id: string | null }>;
    },
    enabled: !!jobId,
    staleTime: 30_000,
  });
  const lpoMap = React.useMemo(() => new Map(lpoRows.map((r) => [r.technician_id, r.lpo_number || null])), [lpoRows]);
  const flexElementMap = React.useMemo(
    () => new Map(lpoRows.map((r) => [r.technician_id, r.flex_element_id || null])),
    [lpoRows]
  );
  const FLEX_UI_BASE_URL = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop';
  const FIN_DOC_VIEW_ID = '8238f39c-f42e-11e0-a8de-00e08175e43e'; // fixed view id for fin-doc
  const buildFinDocUrl = React.useCallback((elementId: string | null | undefined) => {
    if (!elementId) return null;
    return `${FLEX_UI_BASE_URL}#fin-doc/${encodeURIComponent(elementId)}/doc-view/${FIN_DOC_VIEW_ID}/detail`;
  }, []);

  // Fetch profile names for technicians shown in the payout list
  const techIds = React.useMemo(
    () => Array.from(new Set(payoutTotals.map((p) => p.technician_id).filter(Boolean))) as string[],
    [payoutTotals]
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-job-payout', jobId, techIds],
    enabled: techIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, autonomo')
        .in('id', techIds);
      if (error) throw error;
      return (data || []) as TechnicianProfileWithEmail[];
    },
    staleTime: 60_000,
  });
  const profilesWithEmail = profiles as TechnicianProfileWithEmail[];
  const autonomoMap = React.useMemo(
    () => new Map(profilesWithEmail.map((p) => [p.id, p.autonomo ?? null])),
    [profilesWithEmail]
  );
  const profileMap = React.useMemo(() => new Map(profilesWithEmail.map((p) => [p.id, p])), [profilesWithEmail]);
  const getTechName = React.useCallback(
    (id: string) => {
      const p = profileMap.get(id);
      if (!p) return id;
      const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      return name || id;
    },
    [profileMap]
  );

  const jobRatesApproved = Boolean(jobMeta?.rates_approved);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isSendingEmails, setIsSendingEmails] = React.useState(false);
  const [sendingByTech, setSendingByTech] = React.useState<Record<string, boolean>>({});
  const [missingEmailTechIds, setMissingEmailTechIds] = React.useState<string[]>([]);
  const [expenseDialog, setExpenseDialog] = React.useState<{
    technicianId: string;
    breakdown: JobExpenseBreakdownItem[];
    name: string;
  } | null>(null);
  const lastPreparedContext = React.useRef<JobPayoutEmailContextResult | null>(null);

  React.useEffect(() => {
    setMissingEmailTechIds([]);
    lastPreparedContext.current = null;
  }, [jobId, isTourDate]);

  const prepareStandardContext = React.useCallback(async () => {
    const context = await prepareJobPayoutEmailContext({
      jobId,
      supabase,
      payouts: standardPayoutTotals,
      profiles: profilesWithEmail,
      lpoMap,
      jobDetails: jobMeta || undefined,
    });
    lastPreparedContext.current = context;
    setMissingEmailTechIds(context.missingEmails);
    return context;
  }, [jobId, standardPayoutTotals, profilesWithEmail, lpoMap, jobMeta]);

  const handleExport = React.useCallback(async () => {
    if (!jobId) return;

    if (isTourDate) {
      if (visibleTourQuotes.length === 0 || !jobMeta) return;
      setIsExporting(true);
      try {
        await generateRateQuotePDF(
          visibleTourQuotes,
          {
            id: jobMeta.id,
            title: jobMeta.title,
            start_time: jobMeta.start_time,
            tour_id: jobMeta.tour_id ?? undefined,
            job_type: jobMeta.job_type ?? undefined,
          },
          profilesWithEmail as any,
          lpoMap
        );
        toast.success('PDF de tarifas generado');
      } catch (err) {
        console.error('[JobPayoutTotalsPanel] Error generating tour payout PDF', err);
        toast.error('No se pudo generar el PDF de pagos de gira');
      } finally {
        setIsExporting(false);
      }
      return;
    }

    if (standardPayoutTotals.length === 0) return;
    setIsExporting(true);
    try {
      const context = await prepareStandardContext();
      await generateJobPayoutPDF(
        context.payouts,
        context.job,
        context.profiles,
        context.lpoMap ?? lpoMap,
        context.timesheetMap
      );
      toast.success('PDF de pagos generado');
    } catch (err) {
      console.error('[JobPayoutTotalsPanel] Error generating payout PDF', err);
      toast.error('No se pudo generar el PDF de pagos');
    } finally {
      setIsExporting(false);
    }
  }, [
    jobId,
    isTourDate,
    visibleTourQuotes,
    jobMeta,
    profilesWithEmail,
    lpoMap,
    standardPayoutTotals.length,
    prepareStandardContext,
  ]);

  const handleSendEmails = React.useCallback(async () => {
    if (!jobId) return;

    if (isTourDate) {
      if (visibleTourQuotes.length === 0) return;
      setIsSendingEmails(true);
      try {
        const result = await sendTourJobEmails({
          jobId,
          supabase,
          quotes: visibleTourQuotes,
          profiles: profilesWithEmail as any,
          technicianIds: technicianId ? [technicianId] : undefined,
        });
        setMissingEmailTechIds(result.context.missingEmails);

        if (result.error) {
          console.error('[JobPayoutTotalsPanel] Error sending tour payout emails', result.error);
          toast.error('No se pudieron enviar los correos de pagos');
        } else {
          const partialFailures = Array.isArray(result.response?.results)
            ? (result.response.results as Array<{ sent: boolean }>).some((r) => !r.sent)
            : false;

          if (result.success && !partialFailures) {
            toast.success('Pagos enviados por correo');
          } else {
            toast.warning('Algunos correos no se pudieron enviar. Revisa el registro.');
          }

          if (result.missingEmails.length) {
            toast.warning('Hay técnicos sin correo configurado.');
          }
        }
      } catch (err) {
        console.error('[JobPayoutTotalsPanel] Unexpected error sending tour payout emails', err);
        toast.error('Se produjo un error al enviar los correos de pagos');
      } finally {
        setIsSendingEmails(false);
      }
      return;
    }

    if (standardPayoutTotals.length === 0) return;
    setIsSendingEmails(true);
    try {
      const result = await sendJobPayoutEmails({
        jobId,
        supabase,
        payouts: standardPayoutTotals,
        profiles: profilesWithEmail,
        lpoMap,
        jobDetails: jobMeta || undefined,
        existingContext: lastPreparedContext.current ?? undefined,
      });
      lastPreparedContext.current = result.context;
      setMissingEmailTechIds(result.context.missingEmails);

      if (result.error) {
        console.error('[JobPayoutTotalsPanel] Error sending payout emails', result.error);
        toast.error('No se pudieron enviar los correos de pagos');
        return;
      }

      const partialFailures = Array.isArray(result.response?.results)
        ? (result.response.results as Array<{ sent: boolean }>).some((r) => !r.sent)
        : false;

      if (result.success && !partialFailures) {
        toast.success('Pagos enviados por correo');
      } else {
        toast.warning('Algunos correos no se pudieron enviar. Revisa el registro.');
      }

      if (result.missingEmails.length) {
        toast.warning('Hay técnicos sin correo configurado.');
      }
    } catch (err) {
      console.error('[JobPayoutTotalsPanel] Unexpected error sending payout emails', err);
      toast.error('Se produjo un error al enviar los correos de pagos');
    } finally {
      setIsSendingEmails(false);
    }
  }, [
    jobId,
    isTourDate,
    visibleTourQuotes,
    supabase,
    profilesWithEmail,
    technicianId,
    standardPayoutTotals,
    lpoMap,
    jobMeta,
  ]);

  const handleSendEmailForTech = React.useCallback(
    async (techId: string) => {
      if (!jobId) return;
      const hasEmail = Boolean(profileMap.get(techId)?.email);
      if (!hasEmail) {
        toast.warning('Este técnico no tiene correo configurado.');
        return;
      }

      setSendingByTech((s) => ({ ...s, [techId]: true }));

      if (isTourDate) {
        try {
          const quotesForTech = visibleTourQuotes.filter((quote) => quote.technician_id === techId);
          if (quotesForTech.length === 0) {
            toast.warning('No hay tarifas disponibles para este técnico.');
            return;
          }
          const result = await sendTourJobEmails({
            jobId,
            supabase,
            quotes: quotesForTech,
            profiles: profilesWithEmail as any,
            technicianIds: [techId],
          });
          setMissingEmailTechIds(result.context.missingEmails);

          if (result.error) {
            console.error('[JobPayoutTotalsPanel] Error sending tour payout email (single)', result.error);
            toast.error('No se pudo enviar el correo a este técnico');
          } else {
            const sentResult = Array.isArray(result.response?.results)
              ? (result.response.results as Array<{ technician_id: string; sent: boolean }>).find(
                  (r) => r.technician_id === techId
                )
              : { sent: result.success } as { sent: boolean };
            if (sentResult?.sent) {
              toast.success('Correo enviado a este técnico');
            } else {
              toast.warning('No se pudo enviar el correo a este técnico');
            }
          }
        } catch (err) {
          console.error('[JobPayoutTotalsPanel] Unexpected error sending single tour payout email', err);
          toast.error('Se produjo un error al enviar el correo');
        } finally {
          setSendingByTech((s) => ({ ...s, [techId]: false }));
        }
        return;
      }

      try {
        const result = await sendJobPayoutEmails({
          jobId,
          supabase,
          payouts: standardPayoutTotals.filter((p) => p.technician_id === techId),
          profiles: profilesWithEmail.filter((p) => p.id === techId),
          lpoMap,
          jobDetails: jobMeta || undefined,
        });

        if (result.error) {
          console.error('[JobPayoutTotalsPanel] Error sending payout email (single)', result.error);
          toast.error('No se pudo enviar el correo a este técnico');
        } else {
          const sent = Array.isArray(result.response?.results)
            ? (result.response.results as Array<{ technician_id: string; sent: boolean }>).find(
                (r) => r.technician_id === techId
              )?.sent
            : true;
          if (result.success && sent) {
            toast.success('Correo enviado a este técnico');
          } else {
            toast.warning('No se pudo enviar el correo a este técnico');
          }
        }
      } catch (err) {
        console.error('[JobPayoutTotalsPanel] Unexpected error sending single payout email', err);
        toast.error('Se produjo un error al enviar el correo');
      } finally {
        setSendingByTech((s) => ({ ...s, [techId]: false }));
      }
    },
    [
      jobId,
      isTourDate,
      profileMap,
      visibleTourQuotes,
      supabase,
      profilesWithEmail,
      standardPayoutTotals,
      lpoMap,
      jobMeta,
    ]
  );

  if (isLoading) {
    return (
      <Card className={`${cardBase} w-full`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={subtleText}>Cargando información de pagos...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${cardBase} w-full`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400">Error al cargar los pagos</div>
        </CardContent>
      </Card>
    );
  }

  if (payoutTotals.length === 0) {
    return (
      <Card className={`${cardBase} w-full`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={subtleText}>No hay información de pagos para este trabajo.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${cardBase} w-full`}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || payoutTotals.length === 0}
              className={controlButton}
            >
              <FileDown className="h-4 w-4 mr-1" />
              {isExporting ? 'Generando…' : 'Exportar PDF'}
            </Button>
            <Button
              size="sm"
              onClick={handleSendEmails}
              disabled={isSendingEmails || !jobRatesApproved || payoutTotals.length === 0}
              variant={jobRatesApproved ? 'default' : 'secondary'}
              title={
                jobRatesApproved
                  ? 'Enviar los resúmenes por correo'
                  : 'Aprueba las tarifas para habilitar el envío'
              }
              className={jobRatesApproved ? "bg-blue-600 hover:bg-blue-500 text-white" : undefined}
            >
              <Send className="h-4 w-4 mr-1" />
              {isSendingEmails ? 'Enviando…' : 'Enviar por correo'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-white w-full overflow-hidden">
        {payoutTotals.map((payout) => (
          <div
            key={payout.technician_id}
            className={cn(
              'border rounded-lg p-4 space-y-3 transition-colors w-full min-w-0',
              surface,
              (!profileMap.get(payout.technician_id)?.email ||
                missingEmailTechIds.includes(payout.technician_id)) &&
                'border-amber-400/70 bg-amber-500/10'
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium text-base text-white">{getTechName(payout.technician_id)}</h4>
                  {(() => {
                    const label = getAutonomoBadgeLabel(autonomoMap.get(payout.technician_id));
                    if (!label) return null;
                    return (
                      <Badge
                        variant="destructive"
                        className="flex items-center gap-1 text-xs"
                      >
                        <AlertCircle className="h-3 w-3" />
                        {label}
                      </Badge>
                    );
                  })()}
                </div>
                <div className="flex flex-col gap-1 text-xs text-slate-300 break-words">
                  <span>Trabajo: {payout.job_id}</span>
                  <span>
                    Correo:{' '}
                    {profileMap.get(payout.technician_id)?.email ? (
                      profileMap.get(payout.technician_id)?.email
                    ) : (
                      <span className="text-amber-300 font-medium">Sin correo configurado</span>
                    )}
                  </span>
                </div>
                {!profileMap.get(payout.technician_id)?.email && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-amber-300 border-amber-500/40 bg-amber-500/10"
                  >
                    Sin correo
                  </Badge>
                )}
                {lpoMap.has(payout.technician_id) && (
                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <span>LPO Nº: {lpoMap.get(payout.technician_id) || '—'}</span>
                    {(() => {
                      const elId = flexElementMap.get(payout.technician_id) || null;
                      const url = buildFinDocUrl(elId);
                      if (!url) return null;
                      return (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-primary hover:underline"
                          title="Abrir en Flex"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" /> Abrir en Flex
                        </a>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="text-right flex flex-col items-end gap-2 sm:min-w-[140px]">
                <div className="text-xl font-bold text-white leading-tight">
                  {formatCurrency(payout.total_eur)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendEmailForTech(payout.technician_id)}
                  disabled={
                    sendingByTech[payout.technician_id] ||
                    !jobRatesApproved ||
                    !profileMap.get(payout.technician_id)?.email
                  }
                  title={
                    jobRatesApproved
                      ? (profileMap.get(payout.technician_id)?.email ? 'Enviar sólo a este técnico' : 'Sin correo configurado')
                      : 'Aprueba las tarifas para habilitar el envío'
                  }
                  className={controlButton}
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {sendingByTech[payout.technician_id] ? 'Enviando…' : 'Enviar a este técnico'}
                </Button>
              </div>
            </div>

            {/* Timesheets breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>Partes aprobados:</span>
                </div>
                <Badge variant={payout.timesheets_total_eur > 0 ? 'default' : 'secondary'}>
                  {formatCurrency(payout.timesheets_total_eur)}
                </Badge>
              </div>

              {/* Extras breakdown */}
              {payout.extras_total_eur > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-slate-400" />
                      <span>Extras del trabajo:</span>
                    </div>
                    <Badge variant="outline">
                      {formatCurrency(payout.extras_total_eur)}
                    </Badge>
                  </div>

                  {/* Detailed extras */}
                  {payout.extras_breakdown?.items && payout.extras_breakdown.items.length > 0 && (
                    <div className="ml-6 space-y-1">
                      {payout.extras_breakdown.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-slate-300">
                          <span>
                            {item.extra_type.replace('_', ' ')} × {item.quantity}
                          </span>
                          <span>{formatCurrency(item.amount_eur)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Expenses breakdown */}
              {((payout.expenses_breakdown && payout.expenses_breakdown.length > 0) || payout.expenses_total_eur > 0) && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-slate-400" />
                    <span>Gastos aprobados:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {formatCurrency(payout.expenses_total_eur)}
                    </Badge>
                    {payout.expenses_breakdown && payout.expenses_breakdown.length > 0 && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-blue-300 hover:text-blue-200 hover:bg-white/10"
                        onClick={() =>
                          setExpenseDialog({
                            technicianId: payout.technician_id,
                            breakdown: payout.expenses_breakdown,
                            name: getTechName(payout.technician_id),
                          })
                        }
                      >
                        Ver desglose
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle disclaimer */}
            {payout.vehicle_disclaimer && payout.vehicle_disclaimer_text && (
              <>
                <Separator className="border-white/10" />
                <div className="flex items-start gap-2 text-sm text-amber-200 bg-amber-500/10 p-3 rounded border border-amber-500/30 w-full">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
                  <span className="break-words whitespace-pre-wrap leading-snug w-full">
                    {payout.vehicle_disclaimer_text.includes('Fuel/drive compensation')
                      ? 'Puede aplicarse compensación de combustible/conducción al usar vehículo propio. Coordina con RR. HH. por cada trabajo.'
                      : payout.vehicle_disclaimer_text}
                  </span>
                </div>
              </>
            )}

            <Separator className="border-white/10" />

            {/* Final total */}
            <div className="flex items-center justify-between font-medium text-white">
              <span>Total final:</span>
              <Badge variant="default" className="text-base px-3 py-1">
                {formatCurrency(payout.total_eur)}
              </Badge>
            </div>
          </div>
        ))}

        <Dialog
          open={Boolean(expenseDialog)}
          onOpenChange={(open) => {
            if (!open) {
              setExpenseDialog(null);
            }
          }}
        >
          <DialogContent className="max-w-lg bg-[#0f1219] border-[#1f232e] text-white">
            <DialogHeader>
              <DialogTitle>
                Gastos — {expenseDialog?.name ?? ''}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {expenseDialog?.breakdown && expenseDialog.breakdown.length > 0 ? (
                expenseDialog.breakdown.map((item) => {
                  const pendingEuros = Number(item.submitted_total_eur ?? 0);
                  const approvedEuros = Number(item.approved_total_eur ?? 0);
                  const draftEuros = Number(item.draft_total_eur ?? 0);
                  const rejectedEuros = Number(item.rejected_total_eur ?? 0);
                  const statusCounts = item.status_counts || {};
                  return (
                    <div
                      key={`${expenseDialog.technicianId}-${item.category_slug}`}
                      className="border border-white/10 rounded-lg p-3 bg-white/5"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold capitalize">
                          {item.category_slug.replace(/_/g, ' ')}
                        </h4>
                        <Badge variant="outline" className="text-white">
                          {formatCurrency(approvedEuros)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <span>Aprobados: {formatCurrency(approvedEuros)}</span>
                        <span>Pendientes: {formatCurrency(pendingEuros)}</span>
                        <span>Borrador: {formatCurrency(draftEuros)}</span>
                        <span>Rechazados: {formatCurrency(rejectedEuros)}</span>
                      </div>
                      {Object.keys(statusCounts).length > 0 && (
                        <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-2">
                          {Object.entries(statusCounts).map(([status, count]) => (
                            <span key={status} className="px-2 py-1 bg-white/10 rounded">
                              {status}: {count}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.last_receipt_at && (
                        <div className="mt-2 text-xs text-slate-400">
                          Último recibo: {format(new Date(item.last_receipt_at), 'PPP HH:mm', { locale: es })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-300">No hay gastos registrados para este técnico.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Grand total if multiple technicians */}
        {payoutTotals.length > 1 && (
          <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10 text-white">
            <div className="flex justify-between items-center text-lg font-bold">

              <span className="text-blue-300">
                {formatCurrency(
                  payoutTotals.reduce((sum, payout) => sum + payout.total_eur, 0)
                )}
              </span>
            </div>
            <div className="text-sm text-slate-300 mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Total partes:</span>
                <span>
                  {formatCurrency(
                    payoutTotals.reduce((sum, payout) => sum + payout.timesheets_total_eur, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total extras:</span>
                <span>
                  {formatCurrency(
                    payoutTotals.reduce((sum, payout) => sum + payout.extras_total_eur, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total gastos:</span>
                <span>
                  {formatCurrency(
                    payoutTotals.reduce((sum, payout) => sum + payout.expenses_total_eur, 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
