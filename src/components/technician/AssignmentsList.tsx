import { Button } from "@/components/ui/button";
import { useAssignmentsListSubscriptions } from "@/hooks/useMobileRealtimeSubscriptions";
import { AssignmentCard } from './AssignmentCard';
import { RefreshCw } from 'lucide-react';
import type { JobAssignmentForCard } from "@/hooks/useOptimizedJobCard";

interface AssignmentsListProps {
  assignments: JobAssignmentForCard[];
  loading: boolean;
  onRefresh: () => void;
  techName?: string;
}

export const AssignmentsList = ({ assignments = [], loading = false, onRefresh, techName = '' }: AssignmentsListProps) => {
  useAssignmentsListSubscriptions();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Cargando asignaciones...</p>
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-muted-foreground">No se encontraron asignaciones.</p>
        <Button onClick={onRefresh} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refrescar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map((assignment) => (
        <AssignmentCard key={String(assignment.id ?? `${assignment.job_id}-${assignment.technician_id}`)} assignment={assignment} techName={techName} />
      ))}
    </div>
  );
};

