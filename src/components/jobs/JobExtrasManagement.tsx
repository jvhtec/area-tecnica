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
}

interface JobAssignment {
  technician_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

export const JobExtrasManagement = ({ jobId, isManager = false }: JobExtrasManagementProps) => {
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['job-assignments', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          technician_id,
          profiles:technician_id (
            first_name,
            last_name
          )
        `)
        .eq('job_id', jobId);

      if (error) throw error;
      return data as JobAssignment[];
    },
    enabled: !!jobId,
  });

  const { data: payoutTotals, isLoading: payoutLoading } = useJobPayoutTotals(jobId);

  if (assignmentsLoading || payoutLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Job Extras & Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assignments?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Job Extras & Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">No technicians assigned to this job</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalExtrasAmount = payoutTotals?.reduce((sum, payout) => 
    sum + (payout.extras_total_eur || 0), 0
  ) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Job Extras & Rates
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {assignments.length} technician{assignments.length !== 1 ? 's' : ''}
          </div>
          {totalExtrasAmount > 0 && (
            <Badge variant="secondary">
              Total Extras: {formatCurrency(totalExtrasAmount)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {assignments.map((assignment, index) => {
          const technicianName = `${assignment.profiles.first_name} ${assignment.profiles.last_name}`;
          const technicianPayout = payoutTotals?.find(p => p.technician_id === assignment.technician_id);
          
          return (
            <div key={assignment.technician_id}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">{technicianName}</h3>
                {technicianPayout && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Extras: {formatCurrency(technicianPayout.extras_total_eur || 0)}</span>
                    {technicianPayout.vehicle_disclaimer && (
                      <Badge variant="outline" className="text-xs">
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
                showVehicleDisclaimer={technicianPayout?.vehicle_disclaimer || false}
              />
              
              {index < assignments.length - 1 && <Separator className="mt-6" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};