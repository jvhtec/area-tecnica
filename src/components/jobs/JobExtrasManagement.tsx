import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users } from 'lucide-react';
import { JobExtrasEditor } from './JobExtrasEditor';
import { formatCurrency } from '@/lib/utils';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';

interface JobExtrasManagementProps {
  jobId: string;
  isManager?: boolean;
  technicianId?: string; // when provided (non-manager), restrict view to this tech
}

interface JobAssignment {
  technician_id: string;
  profiles: {
    first_name?: string | null;
    last_name?: string | null;
    role?: string | null;
    assignable_as_tech?: boolean | null;
  } | null;
}

const cardBase = "bg-card border-border text-card-foreground";
const surface = "bg-muted/30 border-border";
const subtle = "text-muted-foreground";
const pill = "bg-primary/5 border-primary/10 text-primary dark:text-primary-foreground";

export const JobExtrasManagement = ({ jobId, isManager = false, technicianId }: JobExtrasManagementProps) => {
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['job-assignments', jobId],
    queryFn: async () => {
      let query = supabase
        .from('job_assignments')
        .select(`
          technician_id,
          profiles:technician_id (
            first_name,
            last_name,
            role,
            assignable_as_tech
          )
        `)
        .eq('job_id', jobId);
      if (technicianId && !isManager) {
        query = query.eq('technician_id', technicianId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as JobAssignment[];
    },
    enabled: !!jobId,
  });

  // If technicianId is provided (non-manager), restrict payouts to that technician
  const { data: payoutTotals, isLoading: payoutLoading } = useJobPayoutTotals(jobId, technicianId);

  if (assignmentsLoading || payoutLoading) {
    return (
      <Card className={cardBase}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Job Extras & Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className={`text-sm ${subtle}`}>Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // When not manager and technicianId provided, filter assignments to that technician only
  const visibleAssignments = assignments?.filter(a => !technicianId || a.technician_id === technicianId) || [];

  if (assignmentsLoading || payoutLoading) {
    // covered above, but keep logic order consistent
  }

  if (!visibleAssignments.length) {
    return (
      <Card className={cardBase}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Job Extras & Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className={`text-sm ${subtle}`}>No extras available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalExtrasAmount = (isManager ? (payoutTotals?.reduce((sum, payout) => sum + (payout.extras_total_eur || 0), 0) || 0) : (payoutTotals?.[0]?.extras_total_eur || 0));

  return (
    <Card className={cardBase}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
          Job Extras & Rates
        </CardTitle>
        {isManager && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-foreground/70 dark:text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {visibleAssignments.length} technician{visibleAssignments.length !== 1 ? 's' : ''}
            </div>
            {totalExtrasAmount > 0 && (
              <Badge variant="secondary" className={pill}>
                Total Extras: {formatCurrency(totalExtrasAmount)}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {visibleAssignments.map((assignment, index) => {
          const technicianName = (
            `${assignment.profiles?.first_name ?? ''} ${assignment.profiles?.last_name ?? ''}`
          ).trim() || 'Unnamed Technician';
          const technicianPayout = payoutTotals?.find(p => p.technician_id === assignment.technician_id);

          return (
            <div key={assignment.technician_id} className={surface + " rounded-xl p-4 sm:p-5"}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h3 className="font-semibold">{technicianName}</h3>
                {technicianPayout && (
                  <div className="flex items-center gap-2 text-sm text-foreground/70 dark:text-muted-foreground">
                    <span>Extras: {formatCurrency(technicianPayout.extras_total_eur || 0)}</span>
                    {technicianPayout.vehicle_disclaimer && (
                      <Badge variant="outline" className="text-xs text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/40 dark:bg-amber-500/10">
                        Vehicle
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <JobExtrasEditor
                jobId={jobId}
                technicianId={assignment.technician_id}
                technicianName={technicianName}
                isManager={isManager}
                isHouseTech={assignment.profiles?.role === 'house_tech'}
                isAssignableManagement={
                  ['admin', 'management'].includes(assignment.profiles?.role || '') &&
                  Boolean(assignment.profiles?.assignable_as_tech)
                }
                showVehicleDisclaimer={technicianPayout?.vehicle_disclaimer || false}
              />

              {index < assignments.length - 1 && <Separator className="mt-4 sm:mt-6" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
