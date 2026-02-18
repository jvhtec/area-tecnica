import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { supabase } from "@/integrations/supabase/client";
import { syncFlexWorkOrdersForJob } from "@/services/flexWorkOrders";
import { mergePDFs } from "@/utils/pdf/pdfMerge";
import { generateTimesheetPDF } from "@/utils/timesheet-pdf";
import { generateJobPayoutPDF, generateRateQuotePDF } from "@/utils/rates-pdf-export";
import { sendJobPayoutEmails } from "@/lib/job-payout-email";
import { adjustRehearsalQuotesForMultiDay } from "@/lib/tour-payout-email";
import { JobPayoutTotalsPanel } from "@/components/jobs/JobPayoutTotalsPanel";
import { useJobApprovalStatus } from "@/hooks/useJobApprovalStatus";
import { attachPayoutOverridesToTourQuotes } from "@/services/tourPayoutOverrides";

import { enrichTimesheetsWithProfiles } from "../enrichTimesheetsWithProfiles";

interface JobDetailsInfoTabProps {
  open: boolean;
  job: any;
  jobDetails: any;
  resolvedJobId: string;
  isManager: boolean;
  isTechnicianRole: boolean;
  isDryhire: boolean;
  jobRatesApproved: boolean;
}

export const JobDetailsInfoTab: React.FC<JobDetailsInfoTabProps> = ({
  open,
  job,
  jobDetails,
  resolvedJobId,
  isManager,
  isTechnicianRole,
  isDryhire,
  jobRatesApproved,
}) => {
  const queryClient = useQueryClient();

  const showPendingRatesNotice =
    !isDryhire && jobDetails?.job_type === "tourdate" && !isManager && isTechnicianRole && !jobRatesApproved;

  const { data: approvalStatus, isLoading: approvalStatusLoading } = useJobApprovalStatus(resolvedJobId);

  const [isSendingPayoutEmails, setIsSendingPayoutEmails] = useState(false);
  const triggerPayoutEmails = React.useCallback(
    async (jobId: string) => {
      if (!jobId || isSendingPayoutEmails) return;
      setIsSendingPayoutEmails(true);
      try {
        const result = await sendJobPayoutEmails({ jobId, supabase });

        if (result.error) {
          console.error("[JobDetailsDialog] Error sending payout emails", result.error);
          toast.error("No se pudieron enviar los correos de pagos");
        } else {
          const partialFailures = Array.isArray(result.response?.results)
            ? (result.response.results as Array<{ sent: boolean }>).some((r) => !r.sent)
            : false;

          if (result.success && !partialFailures) {
            toast.success("Pagos enviados por correo");
          } else {
            toast.warning("Algunos correos no se pudieron enviar. Revisa el registro.");
          }

          if (result.missingEmails.length) {
            toast.warning("Hay técnicos sin correo configurado.");
          }
        }
      } catch (err) {
        console.error("[JobDetailsDialog] Unexpected error sending payout emails", err);
        toast.error("Se produjo un error al enviar los correos de pagos");
      } finally {
        setIsSendingPayoutEmails(false);
      }
    },
    [isSendingPayoutEmails]
  );

  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return "Sin definir";
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) return "Fecha no válida";
      return format(date, "PPPp", { locale: es });
    } catch {
      return "Fecha no válida";
    }
  };

  // Flex Work Orders progress (manager-only)
  const [isSyncingWorkOrders, setIsSyncingWorkOrders] = useState(false);
  const { data: workOrdersFolder } = useQuery({
    queryKey: ["flex-workorders-folder", resolvedJobId, jobDetails?.job_type, jobDetails?.tour_date_id],
    enabled: open && isManager && !!resolvedJobId,
    queryFn: async () => {
      const isTourDateJob = (jobDetails?.job_type || job?.job_type) === "tourdate";
      const tourDateId = jobDetails?.tour_date_id || job?.tour_date_id || null;

      let query = supabase
        .from("flex_folders")
        .select("element_id, job_id, tour_date_id, created_at")
        .eq("folder_type", "work_orders")
        .eq("department", "personnel");

      if (isTourDateJob) {
        if (tourDateId) {
          query = query.or(`job_id.eq.${resolvedJobId},tour_date_id.eq.${tourDateId}`);
        } else {
          query = query.eq("job_id", resolvedJobId);
        }
      } else {
        query = query.eq("job_id", resolvedJobId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error || !data?.length) return null;

      const preferred =
        data.find((row) => row.job_id === resolvedJobId && (!tourDateId || row.tour_date_id === tourDateId)) ||
        data.find((row) => row.job_id === resolvedJobId) ||
        (tourDateId ? data.find((row) => row.tour_date_id === tourDateId) : null) ||
        data[0];

      return preferred ? { element_id: preferred.element_id } : null;
    },
  });

  const { data: existingWorkOrders = [] } = useQuery({
    queryKey: ["flex-workorders-rows", resolvedJobId],
    enabled: open && isManager && !!resolvedJobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flex_work_orders")
        .select(
          `
          technician_id,
          flex_element_id,
          flex_document_id,
          folder_element_id,
          flex_vendor_id,
          lpo_number,
          profiles:profiles!flex_work_orders_technician_id_fkey(first_name,last_name)
        `
        )
        .eq("job_id", resolvedJobId);
      if (error) return [];
      return (data || []) as Array<any>;
    },
  });

  const desiredTechCount = useMemo(() => {
    const assignments = jobDetails?.job_assignments || [];
    return assignments.filter((a: any) => a && a.status !== "declined").length;
  }, [jobDetails?.job_assignments]);
  const existingWOCount = existingWorkOrders.length;

  const copyToClipboard = async (value: string | undefined | null) => {
    try {
      if (!value) return;
      await navigator.clipboard.writeText(value);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <TabsContent value="info" className="space-y-4 min-w-0 overflow-x-hidden">
      <Card className="p-4 w-full min-w-0 overflow-hidden">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg">{jobDetails?.title}</h3>
            {jobDetails?.description && <p className="text-muted-foreground mt-1">{jobDetails.description}</p>}
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Hora de inicio</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(jobDetails?.start_time)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Hora de finalización</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(jobDetails?.end_time)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium mb-2">Tipo de trabajo</p>
              <Badge variant="outline">{jobDetails?.job_type}</Badge>
            </div>
            {jobDetails?.invoicing_company && (
              <div>
                <p className="text-sm font-medium mb-2">Empresa facturadora</p>
                <Badge variant="secondary">{jobDetails.invoicing_company}</Badge>
              </div>
            )}
          </div>

          {isManager && !isDryhire && (
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge variant={jobRatesApproved ? "default" : "secondary"}>
                  {jobRatesApproved ? "Tarifas aprobadas" : "Aprobación necesaria"}
                </Badge>
                <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                  Controla la visibilidad de los pagos por trabajo para los técnicos
                </span>
              </div>
              <div>
                {jobRatesApproved ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!resolvedJobId) return;
                      await supabase
                        .from("jobs")
                        .update({ rates_approved: false, rates_approved_at: null, rates_approved_by: null } as any)
                        .eq("id", resolvedJobId);
                      queryClient.invalidateQueries({ queryKey: ["job-details", resolvedJobId] });
                      queryClient.invalidateQueries({ queryKey: ["job-rates-approval", resolvedJobId] });
                      queryClient.invalidateQueries({ queryKey: ["job-rates-approval-map"] });
                      queryClient.invalidateQueries({ queryKey: ["job-approval-status", resolvedJobId] });
                    }}
                  >
                    Revocar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!approvalStatusLoading && !!approvalStatus && !approvalStatus.canApprove}
                    onClick={async () => {
                      if (!resolvedJobId) return;
                      if (approvalStatus && !approvalStatus.canApprove) {
                        const reasons = approvalStatus.blockingReasons.join(", ");
                        toast.error(
                          reasons
                            ? `No se puede aprobar: ${reasons}`
                            : "No se puede aprobar mientras haya elementos pendientes"
                        );
                        return;
                      }
                      let approvalSucceeded = false;
                      try {
                        const { data: u } = await supabase.auth.getUser();
                        const { error: approvalError } = await supabase
                          .from("jobs")
                          .update({
                            rates_approved: true,
                            rates_approved_at: new Date().toISOString(),
                            rates_approved_by: u?.user?.id || null,
                          } as any)
                          .eq("id", resolvedJobId);

                        if (approvalError) throw approvalError;
                        approvalSucceeded = true;

                        try {
                          const result = await syncFlexWorkOrdersForJob(resolvedJobId);
                          if (result.created > 0) {
                            toast.success(`Órdenes de trabajo creadas en Flex: ${result.created}`);
                          }
                          result.errors.forEach((message) => toast.error(message));
                        } catch (flexError) {
                          console.error("[JobDetailsDialog] Flex work-order sync failed", flexError);
                          toast.error(
                            `No se pudieron generar las órdenes de trabajo en Flex: ${(flexError as Error).message}`
                          );
                        }
                      } catch (err) {
                        console.error("[JobDetailsDialog] Job rates approval failed", err);
                        toast.error("No se pudieron aprobar las tarifas del trabajo.");
                      } finally {
                        queryClient.invalidateQueries({ queryKey: ["job-details", resolvedJobId] });
                        queryClient.invalidateQueries({ queryKey: ["job-rates-approval", resolvedJobId] });
                        queryClient.invalidateQueries({ queryKey: ["job-rates-approval-map"] });
                        queryClient.invalidateQueries({ queryKey: ["job-approval-status", resolvedJobId] });
                        if (approvalSucceeded) {
                          toast.success("Tarifas aprobadas", {
                            description: "¿Quieres enviar los resúmenes de pagos por correo ahora?",
                            action: resolvedJobId
                              ? {
                                label: "Enviar ahora",
                                onClick: () => {
                                  if (isSendingPayoutEmails) return;
                                  triggerPayoutEmails(resolvedJobId);
                                },
                              }
                              : undefined,
                          });
                        }
                      }
                    }}
                  >
                    Aprobar
                  </Button>
                )}
              </div>
            </div>
          )}

          {showPendingRatesNotice && (
            <Alert
              variant="default"
              className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-100">
                Las tarifas de este trabajo están pendientes de aprobación y no son visibles por el momento.
              </AlertDescription>
            </Alert>
          )}

          {approvalStatus && approvalStatus.blockingReasons.length > 0 && (
            <div className="mt-2 text-xs text-foreground/70 dark:text-muted-foreground">Pendiente: {approvalStatus.blockingReasons.join(", ")}</div>
          )}

          {jobDetails?.locations && (
            <div>
              <p className="text-sm font-medium">Recinto</p>
              <p className="text-sm text-muted-foreground">{jobDetails.locations.name}</p>
              {jobDetails.locations.formatted_address && (
                <p className="text-sm text-muted-foreground">{jobDetails.locations.formatted_address}</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {isManager && resolvedJobId && <JobPayoutTotalsPanel jobId={resolvedJobId} />}

      {isManager && !isDryhire && (
        <Card className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">Órdenes de Trabajo (Flex)</div>
              <div className="text-muted-foreground">
                Progreso: {existingWOCount}/{desiredTechCount} {desiredTechCount > 0 ? "técnicos" : ""}
              </div>
              <div className="text-muted-foreground">Carpeta: {workOrdersFolder?.element_id ? "creada" : "no creada"}</div>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                if (!resolvedJobId) return;
                setIsSyncingWorkOrders(true);
                try {
                  const result = await syncFlexWorkOrdersForJob(resolvedJobId);
                  if (result.created > 0) {
                    toast.success(`Órdenes de trabajo creadas en Flex: ${result.created}`);
                  } else if (result.skipped > 0) {
                    toast(`Sin cambios. Técnicos omitidos: ${result.skipped}`);
                  }
                  result.errors.forEach((message) => toast.error(message));
                } catch (e) {
                  toast.error(`No se pudo sincronizar con Flex: ${(e as Error).message}`);
                } finally {
                  setIsSyncingWorkOrders(false);
                  queryClient.invalidateQueries({ queryKey: ["flex-workorders-folder", resolvedJobId] });
                  queryClient.invalidateQueries({ queryKey: ["flex-workorders-rows", resolvedJobId] });
                }
              }}
              disabled={isSyncingWorkOrders}
            >
              {isSyncingWorkOrders ? "Sincronizando…" : "Sincronizar órdenes de trabajo"}
            </Button>
          </div>
        </Card>
      )}

      {isManager && !isDryhire && (
        <Card className="p-3 mt-2">
          <div className="text-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">Impresión rápida</div>
              <Button
                size="sm"
                variant="default"
                onClick={async () => {
                  if (!resolvedJobId) return;
                  try {
                    const isTourDateJob = (jobDetails?.job_type || job?.job_type) === "tourdate";

                    // 1) Fetch timesheets for this job (tourdate is fixed-rate and doesn't require approvals)
                    let tsQuery = supabase
                      .from("timesheets")
                      .select("*")
                      .eq("job_id", resolvedJobId)
                      .eq("is_active", true);
                    if (!isTourDateJob) {
                      tsQuery = tsQuery.eq("approved_by_manager", true);
                    }

                    const { data: ts } = await tsQuery;

                    // Fallback to visibility function when RLS blocks
                    let timesheets = ts || [];
                    if (!timesheets.length) {
                      const { data: visible } = await supabase.rpc("get_timesheet_amounts_visible");
                      timesheets =
                        (visible as any[] | null)?.filter(
                          (r) =>
                            r.job_id === resolvedJobId &&
                            (r.is_active == null || r.is_active === true) &&
                            (isTourDateJob || r.approved_by_manager === true)
                        ) || [];
                    }

                    const { timesheets: enrichedTimesheets, profileMap } = await enrichTimesheetsWithProfiles(
                      supabase,
                      timesheets as any[]
                    );

                    timesheets = enrichedTimesheets;

                    // 2) Build job object for timesheet PDF
                    const jobObj = {
                      id: resolvedJobId,
                      title: jobDetails?.title || job?.title || "Job",
                      start_time: jobDetails?.start_time || job?.start_time,
                      end_time: jobDetails?.end_time || job?.end_time,
                      job_type: jobDetails?.job_type || job?.job_type,
                      created_at: jobDetails?.created_at || new Date().toISOString(),
                    } as any;

                    let tsBlob: Blob | null = null;
                    if (!isTourDateJob) {
                      const tsDoc = await generateTimesheetPDF({
                        job: jobObj,
                        timesheets: timesheets as any,
                        date: "all-dates",
                      });
                      tsBlob = tsDoc.output("blob") as Blob;
                    }

                    // 3) Build inputs for payout PDF (tourdate uses rate quotes, others use payout totals)
                    const { data: lpoRows } = await supabase
                      .from("flex_work_orders")
                      .select("technician_id, lpo_number")
                      .eq("job_id", resolvedJobId);
                    const lpoMap = new Map((lpoRows || []).map((r: any) => [r.technician_id, r.lpo_number || null]));

                    // Timesheet breakdowns for payout details (non-tourdate PDF section)
                    const tsByTech = new Map<string, any[]>();
                    (timesheets || []).forEach((row: any) => {
                      const b = (row.amount_breakdown || row.amount_breakdown_visible || {}) as any;
                      const line = {
                        date: row.date,
                        hours_rounded: Number(b.hours_rounded ?? b.worked_hours_rounded ?? 0) || 0,
                        base_day_eur: b.base_day_eur != null ? Number(b.base_day_eur) : undefined,
                        plus_10_12_hours: b.plus_10_12_hours != null ? Number(b.plus_10_12_hours) : undefined,
                        plus_10_12_amount_eur:
                          b.plus_10_12_amount_eur != null ? Number(b.plus_10_12_amount_eur) : undefined,
                        overtime_hours: b.overtime_hours != null ? Number(b.overtime_hours) : undefined,
                        overtime_hour_eur: b.overtime_hour_eur != null ? Number(b.overtime_hour_eur) : undefined,
                        overtime_amount_eur:
                          b.overtime_amount_eur != null ? Number(b.overtime_amount_eur) : undefined,
                        total_eur: b.total_eur != null ? Number(b.total_eur) : undefined,
                      };
                      const arr = tsByTech.get(row.technician_id) || [];
                      arr.push(line);
                      tsByTech.set(row.technician_id, arr);
                    });

                    let payoutBlob: Blob;
                    if (isTourDateJob) {
                      // Compute quotes via RPC per technician for this tour date job
                      const { data: jobAssignments, error: jaErr } = await supabase
                        .from("job_assignments")
                        .select("technician_id")
                        .eq("job_id", resolvedJobId);
                      if (jaErr) {
                        console.error("[JobDetailsDialog] Failed loading job assignments for quotes", jaErr);
                      }
                      const techIdsForQuotes = Array.from(
                        new Set(((jobAssignments || []) as any[]).map((a: any) => a.technician_id).filter(Boolean))
                      );

                      let quotes: any[] = [];
                      if (techIdsForQuotes.length > 0) {
                        quotes = await Promise.all(
                          techIdsForQuotes.map(async (techId: string) => {
                            const { data, error } = await supabase.rpc("compute_tour_job_rate_quote_2025", {
                              _job_id: resolvedJobId,
                              _tech_id: techId,
                            });
                            if (error) {
                              console.error("[JobDetailsDialog] RPC quote error", error);
                              return {
                                job_id: resolvedJobId,
                                technician_id: techId,
                                start_time: jobObj.start_time,
                                end_time: jobObj.end_time,
                                job_type: "tourdate",
                                tour_id: jobDetails?.tour_id ?? null,
                                title: jobObj.title,
                                is_house_tech: false,
                                is_tour_team_member: false,
                                category: "",
                                base_day_eur: 0,
                                week_count: 1,
                                multiplier: 1,
                                per_job_multiplier: 1,
                                iso_year: null,
                                iso_week: null,
                                total_eur: 0,
                                extras: undefined,
                                extras_total_eur: undefined,
                                total_with_extras_eur: undefined,
                                breakdown: { error: error.message || String(error) },
                              } as any;
                            }
                            return data as any;
                          })
                        );
                      }

                      // Ensure we have profiles for all quoted technicians
                      const missingProfileIds = techIdsForQuotes.filter(
                        (id): id is string => typeof id === "string" && !profileMap.has(id)
                      );
                      if (missingProfileIds.length) {
                        const { data: extraProfiles, error: extraProfilesError } = await supabase
                          .from("profiles")
                          .select("id, first_name, last_name, department, autonomo")
                          .in("id", missingProfileIds);
                        if (extraProfilesError) {
                          console.error("[JobDetailsDialog] Failed to load technician profiles for quotes", extraProfilesError);
                        } else {
                          (extraProfiles || []).forEach((profile: any) => {
                            if (profile?.id) profileMap.set(profile.id, profile);
                          });
                        }
                      }

                      const payoutProfiles = Array.from(profileMap.values());
                      const techDates = new Map<string, Set<string>>();
                      (timesheets || []).forEach((row: any) => {
                        if (!row?.technician_id || !row?.date) return;
                        if (!techDates.has(row.technician_id)) techDates.set(row.technician_id, new Set());
                        techDates.get(row.technician_id)!.add(row.date);
                      });
                      const daysCounts = new Map<string, number>();
                      techDates.forEach((dates, techId) => daysCounts.set(techId, dates.size));
                      const adjustedQuotes = adjustRehearsalQuotesForMultiDay(quotes as any, daysCounts);
                      const quotesWithOverrides = await attachPayoutOverridesToTourQuotes(
                        resolvedJobId,
                        adjustedQuotes as any
                      );
                      const quoteBlob = (await generateRateQuotePDF(
                        quotesWithOverrides as any,
                        {
                          id: jobObj.id,
                          title: jobObj.title,
                          start_time: jobObj.start_time,
                          tour_id: jobDetails?.tour_id ?? null,
                          job_type: jobObj.job_type,
                        },
                        payoutProfiles as any,
                        lpoMap,
                        { download: false }
                      )) as Blob;
                      payoutBlob = quoteBlob;
                    } else {
                      // Standard jobs: use aggregated payout totals view
                      const { data: payouts } = await supabase
                        .from("v_job_tech_payout_2025")
                        .select("*")
                        .eq("job_id", resolvedJobId);

                      const techIds = Array.from(new Set((payouts || []).map((p: any) => p.technician_id)));
                      const missingProfileIds = techIds.filter(
                        (id): id is string => typeof id === "string" && !profileMap.has(id)
                      );
                      if (missingProfileIds.length) {
                        const { data: extraProfiles, error: extraProfilesError } = await supabase
                          .from("profiles")
                          .select("id, first_name, last_name, department, autonomo")
                          .in("id", missingProfileIds);
                        if (extraProfilesError) {
                          console.error("[JobDetailsDialog] Failed to load technician profiles for payouts", extraProfilesError);
                        } else {
                          (extraProfiles || []).forEach((profile: any) => {
                            if (profile?.id) profileMap.set(profile.id, profile);
                          });
                        }
                      }

                      const payoutProfiles = Array.from(profileMap.values());
                      payoutBlob = (await generateJobPayoutPDF(
                        (payouts || []) as any,
                        {
                          id: jobObj.id,
                          title: jobObj.title,
                          start_time: jobObj.start_time,
                          end_time: jobObj.end_time,
                          tour_id: jobDetails?.tour_id ?? null,
                        },
                        payoutProfiles as any,
                        lpoMap,
                        tsByTech as any,
                        { download: false }
                      )) as Blob;
                    }

                    // 4) Build final file (tourdate: payouts only, no timesheet section)
                    const finalBlob = isTourDateJob || !tsBlob ? payoutBlob : await mergePDFs([tsBlob, payoutBlob]);
                    const url = URL.createObjectURL(finalBlob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `pack_${(jobObj.title || "job")
                      .replace(/[^\w\s-]/g, "")
                      .replace(/\s+/g, "_")}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error("Failed to generate document pack", e);
                    toast.error("No se pudo generar el pack de documentos");
                  }
                }}
              >
                Imprimir Pack (Partes + Pagos)
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">Mapa de LPO (depuración)</div>
                <div className="text-muted-foreground">Carpeta padre (work_orders): {workOrdersFolder?.element_id || "—"}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(workOrdersFolder?.element_id)}>
                Copiar carpeta
              </Button>
            </div>

            {existingWorkOrders && existingWorkOrders.length > 0 ? (
              <div className="border-t pt-2 space-y-1">
                {existingWorkOrders.map((row: any) => {
                  const name =
                    [row?.profiles?.first_name, row?.profiles?.last_name].filter(Boolean).join(" ") || row.technician_id;
                  const elementId = row?.flex_element_id || row?.flex_document_id || "—";
                  const vendorId = row?.flex_vendor_id || "—";
                  const lpoNumber = row?.lpo_number || "—";
                  return (
                    <div key={`${row.technician_id}-${elementId}`} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate">
                          <span className="font-medium">{name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          LPO: {elementId}
                          {elementId && (
                            <a
                              className="ml-2 text-primary hover:underline inline-flex items-center"
                              href={`https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/${encodeURIComponent(
                                elementId
                              )}/doc-view/8238f39c-f42e-11e0-a8de-00e08175e43e/detail`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" /> Abrir en Flex
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">Vendor: {vendorId}</div>
                        <div className="text-xs text-muted-foreground truncate">Número: {lpoNumber}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(String(elementId))}>
                          Copiar LPO
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(String(lpoNumber))}>
                          Copiar Nº
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(String(vendorId))}>
                          Copiar Vendor
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No hay LPO registrados en BD para este trabajo.</div>
            )}
          </div>
        </Card>
      )}
    </TabsContent>
  );
};
