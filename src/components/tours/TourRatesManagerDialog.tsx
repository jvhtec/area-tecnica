import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Euro, AlertTriangle, Calendar, Users, ShieldCheck, ShieldX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useTourJobRateQuotesForManager } from '@/hooks/useTourJobRateQuotesForManager';
import { useSaveHouseTechRate } from '@/hooks/useHouseTechRates';
import { JobExtrasEditor } from '@/components/jobs/JobExtrasEditor';
import { formatCurrency } from '@/lib/utils';
import { useTourRatesApproval } from '@/hooks/useTourRatesApproval';
import { ExtrasCatalogEditor, BaseRatesEditor } from '@/features/rates/components/CatalogEditors';

type TourRatesManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
};

export function TourRatesManagerDialog({ open, onOpenChange, tourId }: TourRatesManagerDialogProps) {
  // Fetch tour dates (jobs)
  const { data: tourJobs = [] } = useQuery({
    queryKey: ['tour-jobs-for-rates', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_time, job_type')
        .eq('tour_id', tourId)
        .eq('job_type', 'tourdate')
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

  // Manager view: compute quotes for all tour assignments regardless of auth.uid()
  const { data: quotes = [], isLoading: quotesLoading } = useTourJobRateQuotesForManager(selectedJobId, tourId);

  // Fetch profiles for names
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-rates-manager', quotes.map(q => q.technician_id)],
    queryFn: async () => {
      if (!quotes.length) return [];
      const techIds = [...new Set(quotes.map(q => q.technician_id))];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, default_timesheet_category, role')
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
    }
  });

  const [activeTab, setActiveTab] = useState('by-date');
  const { data: approvalRow, refetch: refetchApproval } = useTourRatesApproval(tourId);
  const approved = !!approvalRow?.rates_approved;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Rates & Extras Manager
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={approved ? 'default' : 'secondary'} className="hidden sm:inline-flex">
                {approved ? 'Rates Approved' : 'Approval Required'}
              </Badge>
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
                  <ShieldX className="h-4 w-4" /> Revoke Approval
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
                  <ShieldCheck className="h-4 w-4" /> Approve Rates
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="by-date">By Date</TabsTrigger>
            <TabsTrigger value="extras">Extras Catalog</TabsTrigger>
            <TabsTrigger value="base">Base Rates</TabsTrigger>
          </TabsList>

          {/* By Date Tab */}
          <TabsContent value="by-date" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" /> Select Tour Date
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Select value={selectedJobId} onValueChange={(v) => setSelectedJobId(v)}>
                  <SelectTrigger className="min-w-[260px]"><SelectValue placeholder="Choose date" /></SelectTrigger>
                  <SelectContent>
                    {tourJobs.map((j: any) => (
                      <SelectItem key={j.id} value={j.id}>
                        {format(new Date(j.start_time), 'MMM d, yyyy')} • {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="ml-auto w-fit">
                  <Users className="h-3 w-3 mr-1" />
                  {quotes.length} assignments
                </Badge>
              </CardContent>
            </Card>

            {/* Quotes list */}
            <div className="space-y-3">
              {quotesLoading && (
                <div className="text-sm text-muted-foreground">Loading rates…</div>
              )}
              {!quotesLoading && quotes.map((q) => {
                const name = getTechName(q.technician_id);
                const hasError = Boolean(q.breakdown?.error);
                const errorCode = q.breakdown?.error as string | undefined;
                const house = q.is_house_tech;

                return (
                  <Card key={q.technician_id + q.job_id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{name}</span>
                          {house && <Badge variant="secondary">House Tech</Badge>}
                          {q.is_tour_team_member && q.multiplier > 1 && (
                            <Badge variant="outline">×{q.multiplier} week multiplier</Badge>
                          )}
                          {q.category && !house && (
                            <Badge variant="outline">{q.category}</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(q.total_with_extras_eur || q.total_eur)}</div>
                          <div className="text-xs text-muted-foreground">
                            Base {formatCurrency(q.base_day_eur)} {q.multiplier > 1 ? `× ${q.multiplier}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Problem solver */}
                      {hasError && (
                        <div className="flex flex-col gap-2 p-3 rounded-lg border bg-amber-50 border-amber-200">
                          <div className="flex items-center gap-2 text-amber-800 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-medium">Issue:</span>
                            <span>{errorCode === 'category_missing' && 'Missing category'}{errorCode === 'house_rate_missing' && 'Missing house tech rate'}{errorCode === 'tour_base_missing' && 'Missing tour base rate for category'}</span>
                          </div>
                          {errorCode === 'category_missing' && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Set category:</Label>
                              <Select onValueChange={(val: any) => fixCategoryMutation.mutate({ technicianId: q.technician_id, category: val })}>
                                <SelectTrigger className="w-48"><SelectValue placeholder="Choose" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tecnico">Técnico</SelectItem>
                                  <SelectItem value="especialista">Especialista</SelectItem>
                                  <SelectItem value="responsable">Responsable</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="outline" size="sm" disabled={fixCategoryMutation.isPending}>
                                Apply
                              </Button>
                            </div>
                          )}
                          {errorCode === 'house_rate_missing' && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs min-w-[120px]">House base day:</Label>
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
                                }
                              }}>Save</Button>
                              {houseRateMap[q.technician_id] !== undefined && (
                                <span className="text-xs text-muted-foreground ml-2">Current: {formatCurrency(houseRateMap[q.technician_id])}</span>
                              )}
                            </div>
                          )}
                          {errorCode === 'tour_base_missing' && (
                            <div className="text-xs text-amber-800">
                              Set the base rate for this category in the Base Rates tab.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Extras editor */}
                      <div className="p-3 rounded-lg border">
                        <div className="text-xs font-medium mb-2">Extras</div>
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
