import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users } from 'lucide-react';
import { JobExtrasEditor } from './JobExtrasEditor';
import { formatCurrency } from '@/lib/utils';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { isManagementRole } from '@/utils/permissions';


import { queryKeys } from "@/lib/react-query";
interface JobExtrasManagementProps {
  jobId: string;
  isManager?: boolean;
  technicianId?: string; // when provided (non-manager), restrict view to this tech
  visibleTechnicianIds?: string[];
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

interface CustomTravelRate {
  profile_id: string;
  travel_half_day_eur: number | null;
  travel_full_day_eur: number | null;
}

const cardBase = "bg-card border-border text-card-foreground";
const surface = "bg-muted/30 border-border";
const subtle = "text-muted-foreground";
const pill = "bg-primary/5 border-primary/10 text-primary dark:text-primary-foreground";
const EMPTY_TECHNICIAN_ID = '00000000-0000-0000-0000-000000000000';

export const JobExtrasManagement = ({
  jobId,
  isManager: isManagerProp = false,
  technicianId: technicianIdProp,
  visibleTechnicianIds,
}: JobExtrasManagementProps) => {
  // Defense-in-depth: derive the viewer from auth so this component is safe no
  // matter how a caller wires its props. A non-management viewer (e.g. a house
  // tech) may only ever SEE and never EDIT their own extras — they can never see
  // another technician's financial info even if a caller forgets to scope it.
  const { userRole, user } = useOptimizedAuth();
  const viewerIsManager = isManagementRole(userRole);
  const isManager = isManagerProp && viewerIsManager;
  const technicianId = viewerIsManager ? technicianIdProp : user?.id;
  const scopedTechnicianId = technicianId ?? EMPTY_TECHNICIAN_ID;
  const assignmentScopeKey = isManager ? (technicianId ?? 'all') : scopedTechnicianId;

  const visibleTechnicianIdSet = useMemo(
    () => new Set(visibleTechnicianIds ?? []),
    [visibleTechnicianIds]
  );

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: queryKeys.scope('job-assignments', jobId, assignmentScopeKey, visibleTechnicianIds?.join(',') ?? 'all'),
    queryFn: async () => {
      let query = dataLayerClient.from('job_assignments')
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
      if (!isManager) {
        // Non-managers are strictly limited to their own assignment. If their id
        // is somehow unknown, match nothing rather than leaking every technician.
        query = query.eq('technician_id', scopedTechnicianId);
      } else if (visibleTechnicianIds && visibleTechnicianIds.length > 0) {
        query = query.in('technician_id', visibleTechnicianIds);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as JobAssignment[];
    },
    enabled: !!jobId,
  });

  // Fetch custom travel rates for all assigned technicians
  const visibleAssignments = useMemo(
    () => (assignments ?? []).filter((assignment) => {
      if (!isManager) return assignment.technician_id === scopedTechnicianId;
      if (technicianId) return assignment.technician_id === technicianId;
      if (!visibleTechnicianIds) return true;
      return visibleTechnicianIdSet.has(assignment.technician_id);
    }),
    [assignments, isManager, scopedTechnicianId, technicianId, visibleTechnicianIds, visibleTechnicianIdSet]
  );

  const techIds = useMemo(
    () => visibleAssignments.map((assignment) => assignment.technician_id).sort(),
    [visibleAssignments]
  );
  const techIdsKey = techIds.join(',');
  const { data: customTravelRates, isLoading: customTravelRatesLoading } = useQuery({
    queryKey: queryKeys.scope('custom-travel-rates', jobId, techIdsKey),
    queryFn: async () => {
      if (!techIds.length) return [];
      const { data, error } = await dataLayerClient.from('custom_tech_rates')
        .select('profile_id, travel_half_day_eur, travel_full_day_eur')
        .in('profile_id', techIds);
      if (error) throw error;
      return (data ?? []) as CustomTravelRate[];
    },
    enabled: techIds.length > 0,
  });

  // If technicianId is provided (non-manager), restrict payouts to that technician
  const { data: payoutTotals, isLoading: payoutLoading } = useJobPayoutTotals(
    jobId,
    isManager ? technicianId : scopedTechnicianId,
  );

  if (assignmentsLoading || payoutLoading || customTravelRatesLoading) {
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

  const visiblePayoutTotals = (payoutTotals ?? []).filter((payout) =>
    visibleAssignments.some((assignment) => assignment.technician_id === payout.technician_id)
  );
  const totalExtrasAmount = isManager
    ? visiblePayoutTotals.reduce((sum, payout) => sum + (payout.extras_total_eur || 0), 0)
    : (visiblePayoutTotals[0]?.extras_total_eur || 0);

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

          const techCustomRates = customTravelRates?.find(r => r.profile_id === assignment.technician_id);

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
                  isManagementRole(assignment.profiles?.role) &&
                  Boolean(assignment.profiles?.assignable_as_tech)
                }
                customTravelHalfRate={techCustomRates?.travel_half_day_eur}
                customTravelFullRate={techCustomRates?.travel_full_day_eur}
                showVehicleDisclaimer={technicianPayout?.vehicle_disclaimer || false}
              />

              {index < visibleAssignments.length - 1 && <Separator className="mt-4 sm:mt-6" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
