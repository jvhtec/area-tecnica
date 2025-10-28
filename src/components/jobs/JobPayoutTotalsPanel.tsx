import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Euro, AlertCircle, Clock, CheckCircle, FileDown, ExternalLink } from 'lucide-react';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateJobPayoutPDF } from '@/utils/rates-pdf-export';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
        .select('id, first_name, last_name')
        .in('id', techIds);
      if (error) throw error;
      return (data || []) as Array<{ id: string; first_name: string | null; last_name: string | null }>;
    },
    staleTime: 60_000,
  });
  const getTechName = React.useCallback(
    (id: string) => {
      const p = (profiles as Array<{ id: string; first_name: string | null; last_name: string | null }>).find(
        (x) => x.id === id
      );
      if (!p) return id;
      const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      return name || id;
    },
    [profiles]
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Euro className="h-5 w-5" />
            Job Payout Totals
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const { data: jobData } = await supabase
                .from('jobs')
                .select('id, title, start_time, tour_id')
                .eq('id', jobId)
                .single();
              
              if (!jobData) {
                toast.error('No se pudo cargar la información del trabajo');
                return;
              }
              
              const techIds = [...new Set(payoutTotals.map(p => p.technician_id))];
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, first_name, last_name')
                .in('id', techIds);

              // Fetch approved timesheets breakdowns for detailed PDF section
              let { data: tsRows } = await supabase
                .from('timesheets')
                .select('technician_id, job_id, date, amount_breakdown, amount_breakdown_visible, approved_by_manager')
                .eq('job_id', jobId)
                .eq('approved_by_manager', true);

              // Fallback to security-definer helper if direct timesheet read is empty (RLS/path issues)
              if (!tsRows || tsRows.length === 0) {
                const { data: visible } = await supabase.rpc('get_timesheet_amounts_visible');
                tsRows = (visible as any[] | null)?.filter(
                  (r) => r.job_id === jobId && r.approved_by_manager === true
                ) || [];
              }

              type TimesheetLine = {
                date?: string | null;
                hours_rounded?: number;
                base_day_eur?: number;
                plus_10_12_hours?: number;
                plus_10_12_amount_eur?: number;
                overtime_hours?: number;
                overtime_hour_eur?: number;
                overtime_amount_eur?: number;
                total_eur?: number;
              };
              const timesheetMap = new Map<string, TimesheetLine[]>();
              (tsRows || []).forEach((row: any) => {
                const b = (row.amount_breakdown || row.amount_breakdown_visible || {}) as Record<string, any>;
                const line: TimesheetLine = {
                  date: row.date ?? null,
                  hours_rounded: Number(b.hours_rounded ?? b.worked_hours_rounded ?? 0) || 0,
                  base_day_eur: b.base_day_eur != null ? Number(b.base_day_eur) : undefined,
                  plus_10_12_hours: b.plus_10_12_hours != null ? Number(b.plus_10_12_hours) : undefined,
                  plus_10_12_amount_eur: b.plus_10_12_amount_eur != null ? Number(b.plus_10_12_amount_eur) : undefined,
                  overtime_hours: b.overtime_hours != null ? Number(b.overtime_hours) : undefined,
                  overtime_hour_eur: b.overtime_hour_eur != null ? Number(b.overtime_hour_eur) : undefined,
                  overtime_amount_eur: b.overtime_amount_eur != null ? Number(b.overtime_amount_eur) : undefined,
                  total_eur: b.total_eur != null ? Number(b.total_eur) : undefined,
                };
                const arr = timesheetMap.get(row.technician_id) || [];
                arr.push(line);
                timesheetMap.set(row.technician_id, arr);
              });
              
              await generateJobPayoutPDF(
                payoutTotals,
                jobData,
                profiles || [],
                lpoMap,
                timesheetMap
              );
              toast.success('PDF de pagos generado');
            }}
          >
            <FileDown className="h-4 w-4 mr-1" />
            Exportar PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {payoutTotals.map((payout) => (
          <div key={payout.technician_id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-base">{getTechName(payout.technician_id)}</h4>
                <p className="text-sm text-muted-foreground">Job: {payout.job_id}</p>
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
              <div className="text-right">
                <div className="text-xl font-bold text-primary">
                  {formatCurrency(payout.total_eur)}
                </div>
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
