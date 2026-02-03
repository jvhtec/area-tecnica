import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Euro, Plus, User, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { formatCurrency } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJobRatesApproval } from '@/hooks/useJobRatesApproval';

interface MyJobTotalProps {
  jobId: string;
  filterTechnicianId?: string;
}

/**
 * Render a card showing technician payout totals for a job, with selection behavior for non-technician users.
 *
 * Shows the current technician's totals when the authenticated user is a technician, and for management users
 * it displays a selector to choose a technician and view their totals. Handles loading, no-data, and rates-not-approved states.
 *
 * @param jobId - The job identifier used to fetch payout totals and approvals.
 * @param filterTechnicianId - Optional technician id to preselect the displayed technician for management users.
 * @returns The JSX element that displays the payout totals card for the specified job and technician.
 */
export function MyJobTotal({ jobId, filterTechnicianId }: MyJobTotalProps) {
  const { user, userRole } = useAuth();
  const isTech = userRole === 'technician' || userRole === 'house_tech';
  // Techs: filter by current user. Management: fetch all rows for job.
  const { data: rows = [], isLoading, error } = useJobPayoutTotals(jobId, isTech ? user?.id : undefined);
  const { data: approvalRow } = useJobRatesApproval(jobId);

  // For management, fetch names to display in selector
  const { data: assignments = [] } = useQuery({
    queryKey: ['job-assignments-names', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`technician_id, profiles:technician_id ( first_name, last_name )`)
        .eq('job_id', jobId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId && !isTech,
    staleTime: 60 * 1000,
  });

  const getTechName = (technicianId: string) => {
    const a = (assignments as any[]).find(x => x.technician_id === technicianId);
    const fn = a?.profiles?.first_name || '';
    const ln = a?.profiles?.last_name || '';
    const name = `${fn} ${ln}`.trim();
    return name || `Tech ${technicianId.slice(0, 8)}…`;
  };

  // Management: allow choosing the technician
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  
  // Sync internal selection with parent filter if provided
  useEffect(() => {
    if (filterTechnicianId) {
      setSelectedTechId(filterTechnicianId);
    } else if (!isTech && rows.length && !selectedTechId) {
      // Default behavior if no filter: select first
      setSelectedTechId(rows[0].technician_id);
    }
  }, [isTech, rows, selectedTechId, filterTechnicianId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Euro className="h-5 w-5" /> {isTech ? 'My Total For This Job' : 'Technician Total For This Job'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading…</div>
        </CardContent>
      </Card>
    );
  }

  const isApproved = approvalRow?.rates_approved ?? false;

  if ((isTech && !isApproved) || error || rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Euro className="h-5 w-5" /> {isTech ? 'My Total For This Job' : 'Technician Total For This Job'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isTech && !isApproved ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Rates for this job are pending approval by management.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No approved amounts yet.</div>
          )}
        </CardContent>
      </Card>
    );
  }

  const row = isTech ? rows[0] : rows.find(r => r.technician_id === selectedTechId) || rows[0];
  const timesheets = row.timesheets_total_eur || 0;
  const extras = row.extras_total_eur || 0;
  const expenses = row.expenses_total_eur || 0;
  const total = row.total_eur || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <Euro className="h-5 w-5" /> {isTech ? 'Mi Total Para Este Trabajo' : 'Total del Técnico Para Este Trabajo'}
          </CardTitle>
          {!isTech && rows.length > 0 && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedTechId ?? undefined} onValueChange={(v) => setSelectedTechId(v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map(r => (
                    <SelectItem key={r.technician_id} value={r.technician_id}>
                      {getTechName(r.technician_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <div>Partes: <span className="font-medium text-foreground">{formatCurrency(timesheets)}</span></div>
          {extras > 0 && (
            <div className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Extras: <span className="font-medium text-foreground">{formatCurrency(extras)}</span>
            </div>
          )}
          {expenses > 0 && (
            <div className="flex items-center gap-1">
              <Plus className="h-3 w-3" /> Gastos: <span className="font-medium text-foreground">{formatCurrency(expenses)}</span>
            </div>
          )}
        </div>
        <Badge variant="default" className="text-base px-4 py-2">
          {formatCurrency(total)}
        </Badge>
      </CardContent>
    </Card>
  );
}