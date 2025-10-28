import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Euro, AlertCircle, Clock, CheckCircle, FileDown, ExternalLink, Send } from 'lucide-react';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
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
import { generateJobPayoutPDF } from '@/utils/rates-pdf-export';

interface JobPayoutTotalsPanelProps {
  jobId: string;
  technicianId?: string;
}

export function JobPayoutTotalsPanel({ jobId, technicianId }: JobPayoutTotalsPanelProps) {
  const { data: payoutTotals = [], isLoading, error } = useJobPayoutTotals(jobId, technicianId);
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
  const lpoMap = React.useMemo(() => new Map(lpoRows.map(r => [r.technician_id, r.lpo_number || null])), [lpoRows]);
  const flexElementMap = React.useMemo(() => new Map(lpoRows.map(r => [r.technician_id, r.flex_element_id || null])), [lpoRows]);
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
        .select('id, first_name, last_name, email')
        .in('id', techIds);
      if (error) throw error;
      return (data || []) as TechnicianProfileWithEmail[];
    },
    staleTime: 60_000,
  });
  const profilesWithEmail = profiles as TechnicianProfileWithEmail[];
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

  const { data: jobMeta } = useQuery({
    queryKey: ['job-payout-metadata', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_time, tour_id, rates_approved')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        title: string;
        start_time: string;
        tour_id: string | null;
        rates_approved: boolean | null;
      };
    },
    staleTime: 60_000,
  });

  const jobRatesApproved = Boolean(jobMeta?.rates_approved);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isSendingEmails, setIsSendingEmails] = React.useState(false);
  const [sendingByTech, setSendingByTech] = React.useState<Record<string, boolean>>({});
  const [missingEmailTechIds, setMissingEmailTechIds] = React.useState<string[]>([]);
  const lastPreparedContext = React.useRef<JobPayoutEmailContextResult | null>(null);

  const handlePrepareContext = React.useCallback(async () => {
    const context = await prepareJobPayoutEmailContext({
      jobId,
      supabase,
      payouts: payoutTotals,
      profiles: profilesWithEmail,
      lpoMap,
      jobDetails: jobMeta || undefined,
    });
    lastPreparedContext.current = context;
    setMissingEmailTechIds(context.missingEmails);
    return context;
  }, [jobId, payoutTotals, profilesWithEmail, lpoMap, jobMeta]);

  const handleExport = React.useCallback(async () => {
    if (!jobId || payoutTotals.length === 0) return;
    setIsExporting(true);
    try {
      const context = await handlePrepareContext();
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
  }, [jobId, payoutTotals.length, handlePrepareContext, lpoMap]);

  const handleSendEmails = React.useCallback(async () => {
    if (!jobId || payoutTotals.length === 0) return;
    setIsSendingEmails(true);
    try {
      const result = await sendJobPayoutEmails({
        jobId,
        supabase,
        payouts: payoutTotals,
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
  }, [jobId, payoutTotals, profilesWithEmail, lpoMap, jobMeta]);

  const handleSendEmailForTech = React.useCallback(
    async (techId: string) => {
      if (!jobId) return;
      const hasEmail = Boolean(profileMap.get(techId)?.email);
      if (!hasEmail) {
        toast.warning('Este técnico no tiene correo configurado.');
        return;
      }
      setSendingByTech((s) => ({ ...s, [techId]: true }));
      try {
        const result = await sendJobPayoutEmails({
          jobId,
          supabase,
          payouts: payoutTotals.filter((p) => p.technician_id === techId),
          profiles: profilesWithEmail.filter((p) => p.id === techId),
          lpoMap,
          jobDetails: jobMeta || undefined,
        });

        if (result.error) {
          console.error('[JobPayoutTotalsPanel] Error sending payout email (single)', result.error);
          toast.error('No se pudo enviar el correo a este técnico');
        } else {
          const sent = Array.isArray(result.response?.results)
            ? (result.response.results as Array<{ technician_id: string; sent: boolean }>).
                find((r) => r.technician_id === techId)?.sent
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
    [jobId, payoutTotals, profilesWithEmail, lpoMap, jobMeta, profileMap]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Job Payout Totals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading payout information...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Job Payout Totals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">Error loading payout totals</div>
        </CardContent>
      </Card>
    );
  }

  if (payoutTotals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Job Payout Totals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No payout information available for this job.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Job Payout Totals
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || payoutTotals.length === 0}
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
            >
              <Send className="h-4 w-4 mr-1" />
              {isSendingEmails ? 'Enviando…' : 'Enviar por correo'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {payoutTotals.map((payout) => (
          <div
            key={payout.technician_id}
            className={cn(
              'border rounded-lg p-4 space-y-3 transition-colors',
              (!profileMap.get(payout.technician_id)?.email ||
                missingEmailTechIds.includes(payout.technician_id)) &&
                'border-amber-400/70 bg-amber-50/80 dark:border-amber-400/60 dark:bg-amber-500/10'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-base">{getTechName(payout.technician_id)}</h4>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>Job: {payout.job_id}</span>
                  <span>
                    Correo:{' '}
                    {profileMap.get(payout.technician_id)?.email ? (
                      profileMap.get(payout.technician_id)?.email
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">Sin correo configurado</span>
                    )}
                  </span>
                </div>
                {!profileMap.get(payout.technician_id)?.email && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-amber-700 border-amber-300 bg-amber-100/60 dark:border-amber-500/50 dark:text-amber-200 dark:bg-amber-500/10"
                  >
                    Sin correo
                  </Badge>
                )}
                {lpoMap.has(payout.technician_id) && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
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
              <div className="text-right flex flex-col items-end gap-2">
                <div className="text-xl font-bold text-primary">
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
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Approved Timesheets:</span>
                </div>
                <Badge variant={payout.timesheets_total_eur > 0 ? "default" : "secondary"}>
                  {formatCurrency(payout.timesheets_total_eur)}
                </Badge>
              </div>

              {/* Extras breakdown */}
              {payout.extras_total_eur > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Job Extras:</span>
                    </div>
                    <Badge variant="outline">
                      {formatCurrency(payout.extras_total_eur)}
                    </Badge>
                  </div>

                  {/* Detailed extras */}
                  {payout.extras_breakdown?.items && payout.extras_breakdown.items.length > 0 && (
                    <div className="ml-6 space-y-1">
                      {payout.extras_breakdown.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-muted-foreground">
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
            </div>

            {/* Vehicle disclaimer */}
            {payout.vehicle_disclaimer && payout.vehicle_disclaimer_text && (
              <>
                <Separator />
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{payout.vehicle_disclaimer_text}</span>
                </div>
              </>
            )}

            <Separator />
            
            {/* Final total */}
            <div className="flex items-center justify-between font-medium">
              <span>Final Total:</span>
              <Badge variant="default" className="text-base px-3 py-1">
                {formatCurrency(payout.total_eur)}
              </Badge>
            </div>
          </div>
        ))}

        {/* Grand total if multiple technicians */}
        {payoutTotals.length > 1 && (
          <div className="mt-6 p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Job Grand Total:</span>
              <span className="text-primary">
                {formatCurrency(
                  payoutTotals.reduce((sum, payout) => sum + payout.total_eur, 0)
                )}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Total Timesheets:</span>
                <span>
                  {formatCurrency(
                    payoutTotals.reduce((sum, payout) => sum + payout.timesheets_total_eur, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Extras:</span>
                <span>
                  {formatCurrency(
                    payoutTotals.reduce((sum, payout) => sum + payout.extras_total_eur, 0)
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
