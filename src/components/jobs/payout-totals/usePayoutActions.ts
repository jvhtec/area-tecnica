import React from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useSetTechnicianPayoutOverride,
  useRemoveTechnicianPayoutOverride,
} from '@/hooks/useJobPayoutOverride';
import { useToggleTechnicianPayoutApproval } from '@/hooks/useToggleTechnicianPayoutApproval';
import {
  prepareJobPayoutEmailContext,
  sendJobPayoutEmails,
  type JobPayoutEmailContextResult,
  type TechnicianProfileWithEmail,
} from '@/lib/job-payout-email';
import { sendTourJobEmails, prepareTourJobEmailContext, adjustRehearsalQuotesForMultiDay } from '@/lib/tour-payout-email';
import { generateJobPayoutPDF, generateRateQuotePDF } from '@/utils/rates-pdf-export';
import type { JobPayoutTotals } from '@/types/jobExtras';
import type { TourJobRateQuote } from '@/types/tourRates';
import type { JobMetadata, PayoutActions } from './types';

interface UsePayoutActionsArgs {
  jobId: string;
  technicianId?: string;
  isTourDate: boolean;
  jobMeta: JobMetadata | null | undefined;
  standardPayoutTotals: JobPayoutTotals[];
  visibleTourQuotes: TourJobRateQuote[];
  tourTimesheetDays: Map<string, number>;
  payoutTotals: JobPayoutTotals[];
  profilesWithEmail: TechnicianProfileWithEmail[];
  profileMap: Map<string, TechnicianProfileWithEmail>;
  lpoMap: Map<string, string | null>;
  getTechName: (id: string) => string;
  getTechOverride: (techId: string) => { override_amount_eur: number } | undefined;
}

export function usePayoutActions({
  jobId,
  technicianId,
  isTourDate,
  jobMeta,
  standardPayoutTotals,
  visibleTourQuotes,
  tourTimesheetDays,
  payoutTotals,
  profilesWithEmail,
  profileMap,
  lpoMap,
  getTechName,
  getTechOverride,
}: UsePayoutActionsArgs): PayoutActions {
  /* ── State ── */
  const [isExporting, setIsExporting] = React.useState(false);
  const [isSendingEmails, setIsSendingEmails] = React.useState(false);
  const [sendingByTech, setSendingByTech] = React.useState<Record<string, boolean>>({});
  const [missingEmailTechIds, setMissingEmailTechIds] = React.useState<string[]>([]);
  const lastPreparedContext = React.useRef<JobPayoutEmailContextResult | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewContext, setPreviewContext] = React.useState<JobPayoutEmailContextResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  const [editingTechId, setEditingTechId] = React.useState<string | null>(null);
  const [editingAmount, setEditingAmount] = React.useState('');

  /* ── Mutations ── */
  const setOverrideMutation = useSetTechnicianPayoutOverride();
  const removeOverrideMutation = useRemoveTechnicianPayoutOverride();
  const toggleApprovalMutation = useToggleTechnicianPayoutApproval();

  /* ── Reset on job/type change ── */
  React.useEffect(() => {
    setMissingEmailTechIds([]);
    lastPreparedContext.current = null;
  }, [jobId, isTourDate]);

  /* ── Override handlers ── */
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

  /* ── Email context preparation (standard) ── */
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

  /* ── PDF export ── */
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

  /* ── Bulk email send ── */
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

  /* ── Email preview ── */
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

  /* ── Single technician email ── */
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

  return {
    isExporting,
    isSendingEmails,
    sendingByTech,
    missingEmailTechIds,
    previewOpen,
    previewContext,
    isLoadingPreview,
    editingTechId,
    editingAmount,
    setEditingAmount,
    handleExport,
    handleSendEmails,
    handlePreviewEmails,
    handleSendEmailForTech,
    handleStartEdit,
    handleSaveOverride,
    handleRemoveOverride,
    handleCancelEdit,
    closePreview: () => setPreviewOpen(false),
    setOverridePending: setOverrideMutation.isPending,
    removeOverridePending: removeOverrideMutation.isPending,
    toggleApprovalMutation,
  };
}
