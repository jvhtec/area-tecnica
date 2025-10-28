import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Euro, AlertCircle, Clock, CheckCircle, FileDown } from 'lucide-react';
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
                .select('id, title, start_time')
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
              
              await generateJobPayoutPDF(
                payoutTotals,
                jobData,
                profiles || [],
                lpoMap
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
                <h4 className="font-medium text-base">Technician ID: {payout.technician_id}</h4>
                <p className="text-sm text-muted-foreground">Job: {payout.job_id}</p>
                {lpoMap.has(payout.technician_id) && (
                  <p className="text-xs text-muted-foreground">LPO Nº: {lpoMap.get(payout.technician_id) || '—'}</p>
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
