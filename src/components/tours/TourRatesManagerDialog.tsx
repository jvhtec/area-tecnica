import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Euro, AlertTriangle, Calendar, Users, ShieldCheck, ShieldX, FileDown, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useManagerJobQuotes } from '@/hooks/useManagerJobQuotes';
import { useSaveHouseTechRate } from '@/hooks/useHouseTechRates';
import { useUpdateMultiplierOverride } from '@/hooks/useJobAssignments';
import { JobExtrasEditor } from '@/components/jobs/JobExtrasEditor';
import { formatMultiplier, getPerJobMultiplier, shouldDisplayMultiplier } from '@/lib/tourRateMath';
import { formatCurrency } from '@/lib/utils';
import { useTourRatesApproval } from '@/hooks/useTourRatesApproval';
import { useJobRatesApproval, useJobRatesApprovalMap } from '@/hooks/useJobRatesApproval';
import { ExtrasCatalogEditor, BaseRatesEditor } from '@/features/rates/components/CatalogEditors';
import { invalidateRatesContext } from '@/services/ratesService';
import { syncFlexWorkOrdersForJob, FlexWorkOrderSyncResult } from '@/services/flexWorkOrders';
import { toast } from 'sonner';
import { generateRateQuotePDF, generateTourRatesSummaryPDF } from '@/utils/rates-pdf-export';
import { sendTourJobEmails } from '@/lib/tour-payout-email';
import { buildTourRatesExportPayload } from '@/services/tourRatesExport';

type TourRatesManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
};

export function TourRatesManagerDialog({ open, onOpenChange, tourId }: TourRatesManagerDialogProps) {
  // Fetch tour jobs (include tour dates + single/festival; exclude dryhire)
  const { data: tourJobs = [] } = useQuery({
    queryKey: ['tour-jobs-for-rates', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_time, end_time, job_type, tour_id')
        .eq('tour_id', tourId)
        .neq('job_type', 'dryhire')
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tourId,
  });

  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open && tourJobs.length && !selectedJobId) {
      setSelectedJobId(tourJobs[0].id);
    }
  }, [open, tourJobs, selectedJobId]);

  // Manager view: compute quotes for selected job (tourdate -> RPC; single/festival -> payout totals)
  const selectedJob = useMemo(() => tourJobs.find((j: any) => j.id === selectedJobId), [tourJobs, selectedJobId]);
  const { data: quotes = [], isLoading: quotesLoading } = useManagerJobQuotes(selectedJobId, selectedJob?.job_type, tourId);

  const jobIds = useMemo(() => tourJobs.map((job: any) => job.id).filter(Boolean), [tourJobs]);
  const { data: jobApprovalMap } = useJobRatesApprovalMap(jobIds);
  const { data: jobApprovalRow } = useJobRatesApproval(selectedJobId);
  const selectedJobApproved = selectedJobId
    ? !!(jobApprovalRow?.rates_approved ?? jobApprovalMap?.get(selectedJobId))
    : false;

  // Fetch profiles for names
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-rates-manager', quotes.map(q => q.technician_id)],
    queryFn: async () => {
      if (!quotes.length) return [];
      const techIds = [...new Set(quotes.map(q => q.technician_id))];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, default_timesheet_category, role')
        .in('id', techIds);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!quotes.length,
  });

  const getTechName = (id: string) => {
    const p = profiles.find((x: any) => x.id === id);
    return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown';
  };

  // Debug logging for manager view
  useEffect(() => {
    if (quotes.length > 0 && selectedJobId) {
      console.log('TourRatesManagerDialog - Quotes for job:', selectedJobId, quotes);
      quotes.forEach((q, idx) => {
        if ((q.total_eur ?? 0) === 0) {
          console.warn(`Manager view - Quote ${idx} has zero total:`, {
            technician: getTechName(q.technician_id),
            job_id: q.job_id,
            category: q.category,
            base_day_eur: q.base_day_eur,
            multiplier: q.multiplier,
            per_job_multiplier: q.per_job_multiplier,
            week_count: q.week_count,
            is_tour_team_member: q.is_tour_team_member,
            total_eur: q.total_eur,
            breakdown: q.breakdown,
          });
        }
      });
    }
  }, [quotes, selectedJobId]);

  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [sendingByTech, setSendingByTech] = useState<Record<string, boolean>>({});

  // House rates in bulk (to show current values when fixing)
  const { data: houseRates = [] } = useQuery({
    queryKey: ['house-tech-rates-bulk', quotes.map(q => q.technician_id)],
    queryFn: async () => {
      if (!quotes.length) return [] as Array<{ profile_id: string; base_day_eur: number }>;
      const techIds = [...new Set(quotes.map(q => q.technician_id))];
      const { data, error } = await supabase
        .from('house_tech_rates')
        .select('profile_id, base_day_eur')
        .in('profile_id', techIds);
      if (error) throw error;
      return data as Array<{ profile_id: string; base_day_eur: number }>;
    },
    enabled: open && !!quotes.length,
  });

  const houseRateMap = useMemo(() => Object.fromEntries(houseRates.map(r => [r.profile_id, r.base_day_eur])), [houseRates]);

  // Fixers
  const queryClient = useQueryClient();
  const saveHouseRate = useSaveHouseTechRate();
  const updateMultiplierOverride = useUpdateMultiplierOverride();
  const fixCategoryMutation = useMutation({
    mutationFn: async ({ technicianId, category }: { technicianId: string; category: 'tecnico' | 'especialista' | 'responsable' }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ default_timesheet_category: category })
        .eq('id', technicianId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-for-rates-manager'] });
      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes-manager'] });
    }
  });

  const [activeTab, setActiveTab] = useState('by-date');
  const [exportingTour, setExportingTour] = useState(false);
  const { data: approvalRow, refetch: refetchApproval } = useTourRatesApproval(tourId);
  const approved = !!approvalRow?.rates_approved;

  interface ToggleJobApprovalResult {
    jobId: string;
    approve: boolean;
    syncResult?: FlexWorkOrderSyncResult | null;
    syncError?: string | null;
  }

  const toggleJobApproval = useMutation<ToggleJobApprovalResult, unknown, { jobId: string; approve: boolean }>({
    mutationFn: async ({ jobId, approve }: { jobId: string; approve: boolean }) => {
      if (!jobId) {
        throw new Error('Job ID requerido');
      }

      if (approve) {
        const { data: user } = await supabase.auth.getUser();
        const approver = user?.user?.id || null;
        const { error } = await supabase
          .from('jobs')
          .update({
            rates_approved: true,
            rates_approved_at: new Date().toISOString(),
            rates_approved_by: approver,
          } as any)
          .eq('id', jobId);
        if (error) throw error;
        let syncResult: FlexWorkOrderSyncResult | null = null;
        let syncError: string | null = null;
        try {
          syncResult = await syncFlexWorkOrdersForJob(jobId);
        } catch (flexError) {
          console.error('[TourRatesManagerDialog] Flex work-order sync failed', flexError);
          syncError = (flexError as Error).message || 'Error desconocido al crear órdenes en Flex';
        }
        return { jobId, approve, syncResult, syncError };
      } else {
        const { error } = await supabase
          .from('jobs')
          .update({
            rates_approved: false,
            rates_approved_at: null,
            rates_approved_by: null,
          } as any)
          .eq('id', jobId);
        if (error) throw error;
        return { jobId, approve, syncResult: null, syncError: null };
      }
    },
    onSuccess: (data, { jobId }) => {
      invalidateRatesContext(queryClient);
      queryClient.invalidateQueries({ queryKey: ['job-rates-approval', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-rates-approval-map'] });
      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes-manager', jobId] });
      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes-manager', jobId, tourId] });
      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes-manager'] });
      if (data?.approve) {
        if (data?.syncResult?.created) {
          toast.success(`Órdenes de trabajo creadas en Flex: ${data.syncResult.created}`);
        }
        data?.syncResult?.errors?.forEach((message) => toast.error(message));
        if (data?.syncError) {
          toast.error(`No se pudieron generar algunas órdenes de trabajo en Flex: ${data.syncError}`);
        }
      }
    },
    onError: (error: any) => {
      const message = error?.message || 'No se pudo actualizar la aprobación del trabajo.';
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
              <Euro className="h-4 w-4 md:h-5 md:w-5" />
              Gestor de Tarifas y Extras
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={approved ? 'default' : 'secondary'} className="hidden sm:inline-flex">
                {approved ? 'Tarifas base liberadas' : 'Aprobación base pendiente'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={exportingTour}
                onClick={async () => {
                  setExportingTour(true);
                  try {
                    const { data: tourData } = await supabase
                      .from('tours')
                      .select('name')
                      .eq('id', tourId)
                      .single();

                    // Fetch all eligible jobs for export (include 'single'/'festival' linked to this tour; exclude dryhire)
                    const { data: allJobs, error: jobsError } = await supabase
                      .from('jobs')
                      .select('id, title, start_time, end_time, job_type')
                      .eq('tour_id', tourId)
                      .order('start_time', { ascending: true });
                    if (jobsError) throw jobsError;

                    const eligible = (allJobs || []).filter((j: any) => (j.job_type ?? '').toLowerCase() !== 'dryhire');
                    const jobsForExport = eligible.map((job: any) => ({
                      id: job.id,
                      title: job.title,
                      start_time: job.start_time,
                      end_time: job.end_time ?? null,
                      job_type: job.job_type ?? null,
                    }));

                    const { jobsWithQuotes, profiles: exportProfiles } = await buildTourRatesExportPayload(
                      tourId,
                      jobsForExport
                    );

                    if (!jobsWithQuotes.length) {
                      toast.error('No hay asignaciones con tarifas para exportar.');
                      return;
                    }

                    await generateTourRatesSummaryPDF(
                      tourData?.name || 'Tour',
                      jobsWithQuotes,
                      exportProfiles
                    );
                    toast.success('PDF de gira generado');
                  } catch (error) {
                    console.error('Error generating tour PDF', error);
                    toast.error('No se pudo generar el PDF de la gira');
                  } finally {
                    setExportingTour(false);
                  }
                }}
                className="flex items-center gap-1"
              >
                <FileDown className="h-4 w-4" /> Exportar Gira
              </Button>
              {approved ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('tours')
                      .update({ rates_approved: false, rates_approved_at: null, rates_approved_by: null } as any)
                      .eq('id', tourId);
                    if (!error) {
                      refetchApproval();
                    }
                  }}
                  className="flex items-center gap-1"
                >
                  <ShieldX className="h-4 w-4" /> Revocar base
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const { data: user } = await supabase.auth.getUser();
                    const approver = user?.user?.id || null;
                    const { error } = await supabase
                      .from('tours')
                      .update({ rates_approved: true, rates_approved_at: new Date().toISOString(), rates_approved_by: approver } as any)
                      .eq('id', tourId);
                    if (!error) {
                      refetchApproval();
                    }
                  }}
                  className="flex items-center gap-1"
                >
                  <ShieldCheck className="h-4 w-4" /> Liberar tarifas base
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            La aprobación de la gira libera las tarifas base para todo el equipo. Cada fecha también puede liberar el pago final
            (base + extras) para que los responsables finalicen importes desde un único lugar.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="by-date">Por fecha</TabsTrigger>
            <TabsTrigger value="extras">Catálogo de extras</TabsTrigger>
            <TabsTrigger value="base">Tarifas base</TabsTrigger>
          </TabsList>

          {/* By Date Tab */}
          <TabsContent value="by-date" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" /> Seleccionar fecha de gira
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Select value={selectedJobId} onValueChange={(v) => setSelectedJobId(v)}>
                  <SelectTrigger className="min-w-[260px]"><SelectValue placeholder="Elegir fecha" /></SelectTrigger>
                  <SelectContent>
                    {tourJobs.map((j: any) => (
                      <SelectItem
                        key={j.id}
                        value={j.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>{format(new Date(j.start_time), 'PPP', { locale: es })} • {j.title}</span>
                        <Badge variant={jobApprovalMap?.get(j.id) ? 'default' : 'secondary'}>
                          {jobApprovalMap?.get(j.id) ? 'Pago final liberado' : 'Pendiente'}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-auto">
                  <Badge variant="outline" className="w-fit">
                    <Users className="h-3 w-3 mr-1" />
                    {quotes.length} asignaciones
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedJobId || quotes.length === 0}
                    onClick={async () => {
                      const job = tourJobs.find((j: any) => j.id === selectedJobId);
                      if (!job) return;
                      
                      const { data: lpoRows } = await supabase
                        .from('flex_work_orders')
                        .select('technician_id, lpo_number')
                        .eq('job_id', selectedJobId);
                      
                      const lpoMap = new Map(
                        (lpoRows || []).map(r => [r.technician_id, r.lpo_number])
                      );
                      
                      await generateRateQuotePDF(quotes, job, profiles as any, lpoMap);
                      toast.success('PDF generado');
                    }}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Exportar Fecha
                  </Button>
                  <Button
                    size="sm"
                    disabled={!selectedJobId || quotes.length === 0 || !selectedJobApproved || isSendingEmails}
                    onClick={async () => {
                      if (!selectedJobId) return;
                      setIsSendingEmails(true);
                      try {
                        const result = await sendTourJobEmails({
                          jobId: selectedJobId,
                          supabase,
                          quotes,
                          profiles: profiles as any,
                        });
                        if (result.error) {
                          console.error('[TourRatesManagerDialog] Error sending tour-date emails', result.error);
                          toast.error('No se pudieron enviar los correos');
                        } else {
                          const partialFailures = Array.isArray(result.response?.results)
                            ? (result.response.results as Array<{ sent: boolean }>).some((r) => !r.sent)
                            : false;
                          if (result.success && !partialFailures) {
                            toast.success('Correos enviados');
                          } else {
                            toast.warning('Algunos correos no se pudieron enviar');
                          }
                          if (result.missingEmails.length) {
                            toast.warning('Hay técnicos sin correo configurado');
                          }
                        }
                      } catch (err) {
                        console.error('[TourRatesManagerDialog] Unexpected error sending emails', err);
                        toast.error('Se produjo un error al enviar');
                      } finally {
                        setIsSendingEmails(false);
                      }
                    }}
                    title={selectedJobApproved ? 'Enviar correos a los técnicos de esta fecha' : 'Liberar pago final para habilitar envío'}
                  >
                    {isSendingEmails ? 'Enviando…' : 'Enviar por correo'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quotes list */}
            <div className="space-y-3">
              {quotesLoading && (
                <div className="text-sm text-muted-foreground">Cargando tarifas…</div>
              )}
              {!quotesLoading && quotes.map((q) => {
                const name = getTechName(q.technician_id);
                const hasError = Boolean(q.breakdown?.error);
                const errorCode = q.breakdown?.error as string | undefined;
                const house = q.is_house_tech;
                const perJobMultiplier = getPerJobMultiplier(q);
                const breakdownBase = q.breakdown?.after_discount ?? q.breakdown?.base_calculation;
                const baseDayAmount = q.base_day_eur ?? 0;
                const hasValidMultiplier = typeof perJobMultiplier === 'number' && perJobMultiplier > 0;
                const preMultiplierBase =
                  breakdownBase ?? (hasValidMultiplier ? baseDayAmount / perJobMultiplier : baseDayAmount);
                const formattedMultiplier = formatMultiplier(perJobMultiplier);
                const trimmedMultiplier = formattedMultiplier.startsWith('×')
                  ? formattedMultiplier.slice(1)
                  : formattedMultiplier;

                return (
                  <Card key={q.technician_id + q.job_id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{name}</span>
                          {house && <Badge variant="secondary">Técnico en plantilla</Badge>}
                          {q.is_tour_team_member && shouldDisplayMultiplier(q.multiplier) && (
                            <Badge variant="outline">{formatMultiplier(q.multiplier)} multiplicador semanal</Badge>
                          )}
                          {q.category && !house && (
                            <Badge variant="outline">{q.category}</Badge>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <div className="font-semibold">{formatCurrency(q.total_with_extras_eur || q.total_eur)}</div>
                          <div className="text-xs text-muted-foreground">
                            {shouldDisplayMultiplier(perJobMultiplier) ? (
                              <>
                                Base {formatCurrency(preMultiplierBase)} × {trimmedMultiplier} ={' '}
                                {formatCurrency(baseDayAmount)}
                                {q.week_count > 1 ? ` (${q.week_count} fechas en la semana)` : ''}
                              </>
                            ) : (
                              <>Base {formatCurrency(baseDayAmount)}</>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !selectedJobId || !selectedJobApproved || !!sendingByTech[q.technician_id] ||
                              !(profiles.find((p: any) => p.id === q.technician_id)?.email)
                            }
                            onClick={async () => {
                              if (!selectedJobId) return;
                              setSendingByTech((s) => ({ ...s, [q.technician_id]: true }));
                              try {
                                const result = await sendTourJobEmails({
                                  jobId: selectedJobId,
                                  supabase,
                                  quotes: quotes.filter(qq => qq.technician_id === q.technician_id),
                                  profiles: profiles as any,
                                  technicianIds: [q.technician_id],
                                });
                                if (result.error) {
                                  toast.error('No se pudo enviar el correo a este técnico');
                                } else {
                                  const r = Array.isArray(result.response?.results)
                                    ? (result.response.results as Array<{ technician_id: string; sent: boolean }>).
                                        find((x) => x.technician_id === q.technician_id)
                                    : { sent: result.success } as any;
                                  if (r?.sent) {
                                    toast.success('Correo enviado a este técnico');
                                  } else {
                                    toast.warning('No se pudo enviar el correo a este técnico');
                                  }
                                }
                              } catch (e) {
                                toast.error('Se produjo un error al enviar');
                              } finally {
                                setSendingByTech((s) => ({ ...s, [q.technician_id]: false }));
                              }
                            }}
                            title={selectedJobApproved ? (profiles.find((p: any) => p.id === q.technician_id)?.email ? 'Enviar a este técnico' : 'Sin correo configurado') : 'Liberar pago final para habilitar envío'}
                          >
                            {sendingByTech[q.technician_id] ? 'Enviando…' : 'Enviar'}
                          </Button>
                        </div>
                      </div>

                      {/* Tour Multiplier Override - Only show for non-tour-team members on tour dates */}
                      {selectedJob?.job_type === 'tourdate' && !q.is_tour_team_member && !house && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border bg-blue-50 border-blue-200">
                          <TooltipProvider>
                            <div className="flex items-center gap-3 w-full">
                              <Checkbox
                                id={`override-${q.job_id}-${q.technician_id}`}
                                checked={q.use_tour_multipliers ?? false}
                                onCheckedChange={(checked) => {
                                  updateMultiplierOverride.mutate({
                                    jobId: q.job_id,
                                    technicianId: q.technician_id,
                                    useTourMultipliers: checked as boolean,
                                  });
                                }}
                                disabled={updateMultiplierOverride.isPending}
                              />
                              <Label
                                htmlFor={`override-${q.job_id}-${q.technician_id}`}
                                className="flex items-center gap-2 cursor-pointer text-sm font-normal"
                              >
                                Aplicar multiplicadores tour
                                {q.use_tour_multipliers && (
                                  <Badge variant="secondary" className="ml-2">
                                    Override activo
                                  </Badge>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-blue-600 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>
                                      Fuerza el cálculo de multiplicadores de tour para este técnico en esta fecha,
                                      aunque no esté asignado a todo el tour. Útil cuando el técnico solo trabaja
                                      fechas específicas pero debe recibir multiplicadores.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                            </div>
                          </TooltipProvider>
                        </div>
                      )}

                      {/* Show when tech is already tour-wide assigned */}
                      {selectedJob?.job_type === 'tourdate' && q.is_tour_team_member && !q.use_tour_multipliers && (
                        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-md flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Asignado tour completo</Badge>
                          <span>Multiplicadores aplicados automáticamente</span>
                        </div>
                      )}

                      {/* Problem solver */}
                      {hasError && (
                        <div className="flex flex-col gap-2 p-3 rounded-lg border bg-amber-50 border-amber-200">
                          <div className="flex items-center gap-2 text-amber-800 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-medium">Problema:</span>
                            <span>{errorCode === 'category_missing' && 'Falta categoría'}{errorCode === 'house_rate_missing' && 'Falta tarifa de house tech'}{errorCode === 'tour_base_missing' && 'Falta tarifa base de gira para la categoría'}</span>
                          </div>
                          {errorCode === 'category_missing' && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Establecer categoría:</Label>
                              <Select onValueChange={(val: any) => fixCategoryMutation.mutate({ technicianId: q.technician_id, category: val })}>
                                <SelectTrigger className="w-48"><SelectValue placeholder="Elegir" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tecnico">Técnico</SelectItem>
                                  <SelectItem value="especialista">Especialista</SelectItem>
                                  <SelectItem value="responsable">Responsable</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="outline" size="sm" disabled={fixCategoryMutation.isPending}>
                                Aplicar
                              </Button>
                            </div>
                          )}
                          {errorCode === 'house_rate_missing' && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs min-w-[120px]">Día base (en plantilla):</Label>
                              <Input
                                type="number"
                                placeholder="EUR"
                                className="w-40"
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat((e.target as HTMLInputElement).value);
                                    if (!isNaN(val)) {
                                      await saveHouseRate.mutateAsync({ profile_id: q.technician_id, base_day_eur: val, plus_10_12_eur: null, overtime_hour_eur: null });
                                      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
                                      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes-manager'] });
                                    }
                                  }
                                }}
                              />
                              <Button size="sm" variant="outline" onClick={async () => {
                                const el = (document.activeElement as HTMLInputElement);
                                const val = parseFloat(el?.value || '');
                                if (!isNaN(val)) {
                                  await saveHouseRate.mutateAsync({ profile_id: q.technician_id, base_day_eur: val, plus_10_12_eur: null, overtime_hour_eur: null });
                                  queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
                                  queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes-manager'] });
                                }
                              }}>Guardar</Button>
                              {houseRateMap[q.technician_id] !== undefined && (
                                <span className="text-xs text-muted-foreground ml-2">Actual: {formatCurrency(houseRateMap[q.technician_id])}</span>
                              )}
                            </div>
                          )}
                          {errorCode === 'tour_base_missing' && (
                            <div className="text-xs text-amber-800">
                              Define la tarifa base para esta categoría en la pestaña "Tarifas base".
                            </div>
                          )}
                        </div>
                      )}

                      {/* Extras editor */}
                      <div className="p-3 rounded-lg border space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={selectedJobApproved ? 'default' : 'secondary'}>
                              {selectedJobApproved ? 'Pago final liberado (base + extras)' : 'Pendiente liberar base + extras'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              El pago final muestra a los técnicos la suma de la tarifa base y los extras asignados.
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant={selectedJobApproved ? 'outline' : 'default'}
                            disabled={toggleJobApproval.isPending || !selectedJobId}
                            onClick={() => selectedJobId && toggleJobApproval.mutate({ jobId: selectedJobId, approve: !selectedJobApproved })}
                            className="flex items-center gap-1"
                          >
                            {selectedJobApproved ? (
                              <>
                                <ShieldX className="h-4 w-4" /> Revocar pago final
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4" /> Liberar pago final
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="text-xs font-medium">Extras</div>
                        <JobExtrasEditor
                          jobId={q.job_id}
                          technicianId={q.technician_id}
                          technicianName={name}
                          isManager={true}
                          showVehicleDisclaimer={Boolean(q.vehicle_disclaimer)}
                          vehicleDisclaimerText={q.vehicle_disclaimer_text}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Extras Catalog Tab */}
          <TabsContent value="extras" className="space-y-4">
            <ExtrasCatalogEditor />
          </TabsContent>

          {/* Base Rates Tab */}
          <TabsContent value="base" className="space-y-4">
            <BaseRatesEditor />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
