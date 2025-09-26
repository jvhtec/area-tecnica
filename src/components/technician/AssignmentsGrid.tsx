import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { AssignmentCard } from "./AssignmentCard";

interface AssignmentsGridProps {
  assignments: any[];
  loading: boolean;
  onRefresh: () => void;
  techName?: string;
}

export const AssignmentsGrid = ({ assignments = [], loading = false, onRefresh, techName = '' }: AssignmentsGridProps) => {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {assignments.map((assignment) => (
        <AssignmentCard key={assignment.id || `${assignment.job_id}-${assignment.technician_id}`} assignment={assignment} techName={techName} />
      ))}
    </div>
  );
};

