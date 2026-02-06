import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Euro, AlertCircle, Clock, CheckCircle, FileDown, ExternalLink, Send, Receipt } from 'lucide-react';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useManagerJobQuotes } from '@/hooks/useManagerJobQuotes';
import {
  useSetTechnicianPayoutOverride,
  useRemoveTechnicianPayoutOverride,
  useJobTechnicianPayoutOverrides,
} from '@/hooks/useJobPayoutOverride';
import { cn, formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  prepareJobPayoutEmailContext,
  sendJobPayoutEmails,
  type JobPayoutEmailContextResult,
  type TechnicianProfileWithEmail,
} from '@/lib/job-payout-email';
import { sendTourJobEmails, prepareTourJobEmailContext, adjustRehearsalQuotesForMultiDay } from '@/lib/tour-payout-email';
import { generateJobPayoutPDF, generateRateQuotePDF } from '@/utils/rates-pdf-export';
import { getAutonomoBadgeLabel } from '@/utils/autonomo';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToggleTechnicianPayoutApproval } from '@/hooks/useToggleTechnicianPayoutApproval';
import type { JobExpenseBreakdownItem, JobPayoutTotals } from '@/types/jobExtras';
import type { TourJobRateQuote } from '@/types/tourRates';
import { JobPayoutOverrideSection, type JobPayoutOverride } from './JobPayoutOverrideSection';
import { PayoutEmailPreview } from './PayoutEmailPreview';

interface JobPayoutTotalsPanelProps {
  jobId: string;
  technicianId?: string;
}

const cardBase = "bg-card border-border text-card-foreground overflow-hidden";
const surface = "bg-muted/30 border-border";
const subtleText = "text-muted-foreground";
const controlButton = "variant-outline border-border";
const NON_AUTONOMO_DEDUCTION_EUR = 30;

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
        .select('id, title, start_time, tour_id, rates_approved, job_type, invoicing_company')
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
        invoicing_company: string | null;
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

  // Fetch approvals and timesheet day counts for tour dates
  const { data: tourTimesheetData = { approvals: new Map<string, boolean>(), daysCounts: new Map<string, number>() } } = useQuery({
    queryKey: ['job-tech-payout', jobId, 'tour-timesheet-data'],
    enabled: !!jobId && isTourDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('technician_id, date, approved_by_manager')
        .eq('job_id', jobId)
        .eq('is_active', true);

      if (error) throw error;

      const techApprovals = new Map<string, boolean[]>();
      const techDates = new Map<string, Set<string>>();
      (data || []).forEach(t => {
        if (!t.technician_id) return;
        // Approvals
        const current = techApprovals.get(t.technician_id) || [];
        current.push(t.approved_by_manager || false);
        techApprovals.set(t.technician_id, current);
        // Day counts
        if (t.date) {
          if (!techDates.has(t.technician_id)) techDates.set(t.technician_id, new Set());
          techDates.get(t.technician_id)!.add(t.date);
        }
      });

      const approvalMap = new Map<string, boolean>();
      techApprovals.forEach((statuses, techId) => {
        const allApproved = statuses.length > 0 && statuses.every(s => s === true);
        approvalMap.set(techId, allApproved);
      });

      const daysCountMap = new Map<string, number>();
      techDates.forEach((dates, techId) => daysCountMap.set(techId, dates.size));

      return { approvals: approvalMap, daysCounts: daysCountMap };
    },
    staleTime: 30 * 1000,
  });
  const tourApprovals = tourTimesheetData.approvals;
  const tourTimesheetDays = tourTimesheetData.daysCounts;

  // Fetch timesheet unique days count for standard jobs (approved + total)
  const { data: techDaysMaps = { approved: new Map<string, number>(), total: new Map<string, number>() } } = useQuery({
    queryKey: ['job-tech-days', jobId],
    enabled: !!jobId && !isTourDate && !jobMetaLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('technician_id, date, approved_by_manager, status')
        .eq('job_id', jobId);
      if (error) throw error;

      const approvedMap = new Map<string, Set<string>>();
      const totalMap = new Map<string, Set<string>>();
      data?.forEach(row => {
        if (!row.technician_id || !row.date) return;
        // Total dates (all timesheets)
        if (!totalMap.has(row.technician_id)) totalMap.set(row.technician_id, new Set());
        totalMap.get(row.technician_id)!.add(row.date);
        // Approved dates (approved_by_manager for IRPF deduction)
        if (row.approved_by_manager) {
          if (!approvedMap.has(row.technician_id)) approvedMap.set(row.technician_id, new Set());
          approvedMap.get(row.technician_id)!.add(row.date);
        }
      });

      const approvedCount = new Map<string, number>();
      approvedMap.forEach((dates, tech) => approvedCount.set(tech, dates.size));
      const totalCount = new Map<string, number>();
      totalMap.forEach((dates, tech) => totalCount.set(tech, dates.size));
      return { approved: approvedCount, total: totalCount };
    },
    staleTime: 60_000,
  });
  const techDaysMap = techDaysMaps.approved;
  const techTotalDaysMap = techDaysMaps.total;

  const visibleTourQuotes = React.useMemo(() => {
    const quotes = (rawTourQuotes as TourJobRateQuote[]) || [];
    if (technicianId) {
      return quotes.filter((quote) => quote.technician_id === technicianId);
    }
    return quotes;
  }, [rawTourQuotes, technicianId]);

  const tourPayoutTotals = React.useMemo<JobPayoutTotals[]>(() => {
    return visibleTourQuotes.map((quote) => {
      // For rehearsal flat-rate quotes, the RPC returns a per-day rate.
      // Multiply by the number of scheduled timesheet days for correct total.
      const isRehearsalFlat = quote.category === 'rehearsal';
      const scheduledDays = isRehearsalFlat
        ? (tourTimesheetDays.get(quote.technician_id) || 1)
        : 1;

      const perDayRate = Number(quote.total_eur ?? 0);
      const baseTotal = perDayRate * scheduledDays;
      const extrasTotal = Number(
        quote.extras_total_eur ?? (quote.extras?.total_eur != null ? quote.extras.total_eur : 0)
      );
      const totalWithExtras = baseTotal + extrasTotal;
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
        payout_approved: tourApprovals.get(quote.technician_id) ?? false,
        expenses_total_eur: 0,
        expenses_breakdown: [],
      } satisfies JobPayoutTotals;
    });
  }, [visibleTourQuotes, tourApprovals, tourTimesheetDays]);

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
  const FIN_DOC_VIEW_ID = '8238f39c-f42e-11e0-a8de-00e08175e43e';
  const buildFinDocUrl = React.useCallback((elementId: string | null | undefined) => {
    if (!elementId) return null;
    return `${FLEX_UI_BASE_URL}#fin-doc/${encodeURIComponent(elementId)}/doc-view/${FIN_DOC_VIEW_ID}/detail`;
  }, []);

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
  const lastPreparedContext = React.useRef<JobPayoutEmailContextResult | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewContext, setPreviewContext] = React.useState<JobPayoutEmailContextResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);

  const { userRole } = useOptimizedAuth();
  const isManager = userRole === 'admin' || userRole === 'management';

  const { data: payoutOverrides = [] } = useJobTechnicianPayoutOverrides(jobId);
  const setOverrideMutation = useSetTechnicianPayoutOverride();
  const removeOverrideMutation = useRemoveTechnicianPayoutOverride();
  const toggleApprovalMutation = useToggleTechnicianPayoutApproval();

  const [editingTechId, setEditingTechId] = React.useState<string | null>(null);
  const [editingAmount, setEditingAmount] = React.useState('');

  React.useEffect(() => {
    setMissingEmailTechIds([]);
    lastPreparedContext.current = null;
  }, [jobId, isTourDate]);

  const calculatedGrandTotal = React.useMemo(() => {
    return payoutTotals.reduce((sum, payout) => {
      const override = payoutOverrides.find(o => o.technician_id === payout.technician_id);

      let deduction = 0;
      const isNonAutonomo = autonomoMap.get(payout.technician_id) === false;
      // For tourdate jobs, discount is already applied server-side to base before multipliers
      // For regular jobs, apply deduction per day
      if (isNonAutonomo && !override && !isTourDate) {
        const days = techDaysMap.get(payout.technician_id) || (payout.timesheets_total_eur > 0 ? 1 : 0);
        deduction = days * NON_AUTONOMO_DEDUCTION_EUR;
      }

      const effectiveTotal = (override?.override_amount_eur ?? payout.total_eur) - (override ? 0 : deduction);
      return sum + effectiveTotal;
    }, 0);
  }, [payoutTotals, payoutOverrides, autonomoMap, isTourDate, techDaysMap]);

  const getTechOverride = React.useCallback((techId: string) => {
    return payoutOverrides.find(o => o.technician_id === techId);
  }, [payoutOverrides]);

  const handleStartEdit = React.useCallback((techId: string, currentAmount: number) => {
    setEditingTechId(techId);
    const override = getTechOverride(techId);
    setEditingAmount((override?.override_amount_eur ?? currentAmount).toString());
  }, [getTechOverride]);

  const handleSaveOverride = React.useCallback((techId: string, techName: string, calculatedTotal: number) => {
    const amountValue = parseFloat(editingAmount);
    if (isNaN(amountValue) || amountValue < 0 || !Number.isFinite(amountValue) || amountValue > 99999999.99) {
      toast.error('El monto debe ser un número válido entre 0 y 99.999.999,99');
      return;
    }

    setOverrideMutation.mutate({
      jobId,
      technicianId: techId,
      amountEur: amountValue,
      calculatedTotal,
      technicianName: techName,
    }, {
      onSuccess: () => {
        setEditingTechId(null);
        setEditingAmount('');
      },
    });
  }, [jobId, editingAmount, setOverrideMutation]);

  const handleRemoveOverride = React.useCallback((techId: string) => {
    removeOverrideMutation.mutate({
      jobId,
      technicianId: techId,
      technicianName: getTechName(techId),
    });
  }, [jobId, removeOverrideMutation, getTechName]);

  const handleCancelEdit = React.useCallback(() => {
    setEditingTechId(null);
    setEditingAmount('');
  }, []);

  const prepareStandardContext = React.useCallback(async (payouts: JobPayoutTotals[]) => {
    const context = await prepareJobPayoutEmailContext({
      jobId,
      supabase,
      payouts,
      profiles: profilesWithEmail,
      lpoMap,
      jobDetails: jobMeta || undefined,
    });
    lastPreparedContext.current = context;
    setMissingEmailTechIds(context.missingEmails);
    return context;
  }, [jobId, profilesWithEmail, lpoMap, jobMeta]);

  const handleExport = React.useCallback(async () => {
    if (!jobId) return;

    if (isTourDate) {
      if (visibleTourQuotes.length === 0 || !jobMeta) return;
      setIsExporting(true);
      try {
        const adjustedQuotes = adjustRehearsalQuotesForMultiDay(visibleTourQuotes, tourTimesheetDays);
        await generateRateQuotePDF(
          adjustedQuotes,
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
      const context = await prepareStandardContext(standardPayoutTotals);
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
    standardPayoutTotals,
    prepareStandardContext,
    tourTimesheetDays,
  ]);

  const handleSendEmails = React.useCallback(async () => {
    if (!jobId) return;

    if (isTourDate) {
      // Tour logic remains separate for now
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

    // Standard Job Logic: Filter by granular approval
    const approvedPayouts = standardPayoutTotals.filter(p => p.payout_approved);

    if (approvedPayouts.length === 0) {
      toast.warning('No hay técnicos aprobados para enviar correos.');
      return;
    }

    setIsSendingEmails(true);
    try {
      const result = await sendJobPayoutEmails({
        jobId,
        supabase,
        payouts: approvedPayouts,
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

  const handlePreviewEmails = React.useCallback(async () => {
    if (!jobId) return;

    setIsLoadingPreview(true);
    try {
      if (isTourDate) {
        if (visibleTourQuotes.length === 0) {
          toast.warning('No hay tarifas disponibles para previsualizar.');
          return;
        }

        const tourContext = await prepareTourJobEmailContext({
          jobId,
          supabase,
          quotes: visibleTourQuotes,
          profiles: profilesWithEmail as any,
        });

        // Convert tour context to standard format for PayoutEmailPreview
        const standardContext: JobPayoutEmailContextResult = {
          job: {
            id: tourContext.job.id,
            title: tourContext.job.title,
            start_time: tourContext.job.start_time,
            tour_id: tourContext.job.tour_id ?? null,
            rates_approved: tourContext.job.rates_approved ?? null,
            invoicing_company: tourContext.job.invoicing_company ?? null,
          },
          payouts: [],
          profiles: profilesWithEmail,
          lpoMap: tourContext.lpoMap,
          timesheetMap: new Map(
            Array.from(tourContext.timesheetDateMap.entries()).map(([techId, dates]) => [
              techId,
              Array.from(dates).sort().map(d => ({
                date: d,
                hours_rounded: 0,
              })),
            ])
          ),
          attachments: tourContext.attachments.map((a) => {
            const baseTotal = Number(a.quote.total_eur ?? 0);
            const extrasTotal = Number(
              a.quote.extras_total_eur ?? (a.quote.extras?.total_eur != null ? a.quote.extras.total_eur : 0)
            );
            const totalWithExtras =
              a.quote.total_with_extras_eur != null ? Number(a.quote.total_with_extras_eur) : baseTotal + extrasTotal;

            return {
              technician_id: a.technician_id,
              email: a.email,
              full_name: a.full_name,
              payout: {
                job_id: jobId,
                technician_id: a.technician_id,
                timesheets_total_eur: baseTotal,
                extras_total_eur: extrasTotal,
                total_eur: totalWithExtras,
                extras_breakdown: { items: a.quote.extras?.items ?? [], total_eur: extrasTotal },
                expenses_total_eur: 0,
                expenses_breakdown: [],
              },
              deduction_eur: a.deduction_eur,
              pdfBase64: a.pdfBase64,
              filename: a.filename,
              autonomo: a.autonomo,
              is_house_tech: a.is_house_tech,
              lpo_number: a.lpo_number,
            };
          }),
          missingEmails: tourContext.missingEmails,
        };

        setPreviewContext(standardContext);
        setPreviewOpen(true);
        return;
      }

      const approvedPayouts = standardPayoutTotals.filter(p => p.payout_approved);

      if (approvedPayouts.length === 0) {
        toast.warning('No hay técnicos aprobados para previsualizar.');
        return;
      }

      const context = await prepareJobPayoutEmailContext({
        jobId,
        supabase,
        payouts: approvedPayouts,
        profiles: profilesWithEmail,
        lpoMap,
        jobDetails: jobMeta || undefined,
      });

      setPreviewContext(context);
      setPreviewOpen(true);
    } catch (err) {
      console.error('[JobPayoutTotalsPanel] Error preparing preview:', err);
      toast.error('No se pudo generar la vista previa');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [jobId, isTourDate, visibleTourQuotes, standardPayoutTotals, supabase, profilesWithEmail, lpoMap, jobMeta]);

  const handleSendEmailForTech = React.useCallback(
    async (techId: string, isApproved?: boolean) => {
      if (!jobId) return;

      if (!isTourDate && !isApproved) {
        toast.warning('Debes aprobar el pago de este técnico antes de enviar el correo.');
        return;
      }

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
          <CardTitle className="flex items-center gap-2 text-lg">
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
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Pagos del trabajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400">Error al cargar los pagos</div>
          {error && (
            <div className="text-xs text-red-300 mt-2 font-mono whitespace-pre-wrap">
              {error instanceof Error
                ? error.message
                : JSON.stringify(error, null, 2)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (payoutTotals.length === 0) {
    return (
      <Card className={`${cardBase} w-full`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
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
          <CardTitle className="flex items-center gap-2 text-lg">
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
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewEmails}
                disabled={isLoadingPreview || payoutTotals.length === 0}
                className={controlButton}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {isLoadingPreview ? 'Cargando…' : 'Previsualizar'}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSendEmails}
              disabled={isSendingEmails || payoutTotals.length === 0}
              variant="default"
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Send className="h-4 w-4 mr-1" />
              {isSendingEmails ? 'Enviando…' : 'Enviar aprobados'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 w-full overflow-hidden">
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
                  <h4 className="font-medium text-base">{getTechName(payout.technician_id)}</h4>
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
                <div className="flex flex-col gap-1 text-xs text-foreground/70 dark:text-muted-foreground break-words">
                  <span>Trabajo: {payout.job_id}</span>
                  <span>
                    Correo:{' '}
                    {profileMap.get(payout.technician_id)?.email ? (
                      profileMap.get(payout.technician_id)?.email
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300 font-medium">Sin correo configurado</span>
                    )}
                  </span>
                </div>
                {!profileMap.get(payout.technician_id)?.email && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-amber-600 border-amber-500/40 bg-amber-500/10 dark:text-amber-300"
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
              <div className="text-right flex flex-col items-end gap-2 sm:min-w-[140px]">
                {!isTourDate && (
                  <div className="flex items-center gap-2 mb-1 bg-muted p-1.5 rounded-md border border-border">
                    <label htmlFor={`approve-${payout.technician_id}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                      {payout.payout_approved ? 'Aprobado' : 'Pendiente'}
                    </label>
                    <Switch
                      id={`approve-${payout.technician_id}`}
                      checked={!!payout.payout_approved}
                      onCheckedChange={(checked) => toggleApprovalMutation.mutate({
                        jobId,
                        technicianId: payout.technician_id,
                        approved: checked
                      })}
                      disabled={toggleApprovalMutation.isPending}
                    />
                  </div>
                )}
                <div className="text-xl font-bold leading-tight">
                  {(() => {
                    const isNonAutonomo = autonomoMap.get(payout.technician_id) === false;
                    let deduction = 0;
                    let daysUsed = 0;
                    // For tourdate jobs, discount is already applied server-side to base before multipliers
                    // For regular jobs, apply deduction per day
                    if (isNonAutonomo && !isTourDate) {
                      daysUsed = techDaysMap.get(payout.technician_id) || (payout.timesheets_total_eur > 0 ? 1 : 0);
                      deduction = daysUsed * NON_AUTONOMO_DEDUCTION_EUR;
                    }
                    const effectiveTotal = payout.total_eur - deduction;

                    return (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(effectiveTotal)}</span>
                        {deduction > 0 && (
                          <span className="text-[10px] text-red-400 font-normal">
                            (-{formatCurrency(deduction)} IRPF por alta obligatoria)
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendEmailForTech(payout.technician_id, payout.payout_approved)}
                  disabled={
                    sendingByTech[payout.technician_id] ||
                    (!isTourDate && !payout.payout_approved) ||
                    !profileMap.get(payout.technician_id)?.email
                  }
                  title={
                    !isTourDate && !payout.payout_approved
                      ? 'Aprueba el pago para habilitar el envío'
                      : (profileMap.get(payout.technician_id)?.email ? 'Enviar sólo a este técnico' : 'Sin correo configurado')
                  }
                  className={controlButton}
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {sendingByTech[payout.technician_id] ? 'Enviando…' : 'Enviar a este'}
                </Button>
              </div>
            </div>

            {/* Timesheets breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Partes aprobados:</span>
                </div>
                <Badge variant={payout.timesheets_total_eur > 0 ? 'default' : 'secondary'}>
                  {formatCurrency(payout.timesheets_total_eur)}
                </Badge>
              </div>
              {!isTourDate && (() => {
                const totalDays = techTotalDaysMap.get(payout.technician_id) || 0;
                const approvedDays = techDaysMap.get(payout.technician_id) || 0;
                if (totalDays > 1 && approvedDays < totalDays) {
                  return (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>
                        Solo {approvedDays} de {totalDays} partes aprobados — el total puede no reflejar todos los días asignados
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Extras breakdown */}
              {payout.extras_total_eur > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
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
                <Separator className="border-border" />
                <div className="flex items-start gap-2 text-sm text-yellow-800 bg-yellow-500/10 p-3 rounded border border-yellow-500/30 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 w-full">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600 dark:text-amber-300" />
                  <span className="break-words whitespace-pre-wrap leading-snug w-full">
                    {payout.vehicle_disclaimer_text.includes('Fuel/drive compensation')
                      ? 'Puede aplicarse compensación de combustible/conducción al usar vehículo propio. Coordina con RR. HH. por cada trabajo.'
                      : payout.vehicle_disclaimer_text}
                  </span>
                </div>
              </>
            )}

            <Separator className="border-border" />

            {/* Payout Override Section (Admin/Management only) */}
            {isManager && (() => {
              const override = getTechOverride(payout.technician_id) as JobPayoutOverride | undefined;
              const isEditing = editingTechId === payout.technician_id;
              const techName = getTechName(payout.technician_id);

              return (
                <JobPayoutOverrideSection
                  override={override}
                  isEditing={isEditing}
                  techName={techName}
                  calculatedTotalEur={payout.total_eur}
                  editingAmount={editingAmount}
                  onEditingAmountChange={setEditingAmount}
                  onStartEdit={() => handleStartEdit(payout.technician_id, payout.total_eur)}
                  onSave={() => handleSaveOverride(payout.technician_id, techName, payout.total_eur)}
                  onCancel={handleCancelEdit}
                  onRemove={() => handleRemoveOverride(payout.technician_id)}
                  isSaving={setOverrideMutation.isPending}
                  isRemoving={removeOverrideMutation.isPending}
                />
              );
            })()}

            <Separator className="border-border" />

            {/* Final total */}
            <div className="flex items-center justify-between font-medium">
              <span>Total final:</span>
              <Badge variant="default" className="text-base px-3 py-1">
                {formatCurrency(getTechOverride(payout.technician_id)?.override_amount_eur ?? payout.total_eur)}
              </Badge>
            </div>
          </div>
        ))}

        {/* Grand total if multiple technicians */}
        {payoutTotals.length > 1 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total global del trabajo:</span>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-300">
                  {formatCurrency(calculatedGrandTotal)}
                </span>
                {payoutOverrides.length > 0 && (
                  <Badge variant="outline" className="text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/40 dark:bg-amber-500/10">
                    {payoutOverrides.length} override{payoutOverrides.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-sm text-foreground/70 dark:text-muted-foreground mt-2 space-y-1">
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
            </div>
          </div>
        )}
      </CardContent>

      <PayoutEmailPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        context={previewContext}
        jobTitle={jobMeta?.title || 'Trabajo'}
      />
    </Card>
  );
}
