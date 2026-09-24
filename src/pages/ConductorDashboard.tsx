import { useState } from "react";
import { Link } from "react-router-dom";
import { es } from "date-fns/locale";
import { Bell, Loader2, Truck } from "lucide-react";

import { ConductorAssignmentCard } from "@/components/logistics/fleet/ConductorAssignmentCard";
import { DeclineTransportDialog } from "@/components/logistics/fleet/DeclineTransportDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { respondToTransportAssignment } from "@/features/logistics/fleet/fleetApi";
import { formatTransportDateKey, type MyTransportAssignment } from "@/features/logistics/fleet/fleetModel";
import { useInvalidateLogisticsFleet, useMyTransportAssignments } from "@/features/logistics/fleet/useLogisticsFleet";
import { getErrorMessage } from "@/utils/errorMessage";
import { formatMadridDayKey } from "@/utils/timezoneUtils";

/** Upcoming (not yet finished) assignments grouped by their transport-local start day. */
const groupUpcomingByDay = (assignments: MyTransportAssignment[], nowIso: string) => {
  const groups = new Map<string, MyTransportAssignment[]>();
  for (const assignment of assignments) {
    if (assignment.ends_at < nowIso) continue;
    const dayKey = formatTransportDateKey(assignment.starts_at, assignment.timezone);
    groups.set(dayKey, [...(groups.get(dayKey) ?? []), assignment]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};

const ConductorDashboard = () => {
  const { toast } = useToast();
  const { user } = useOptimizedAuth();
  const invalidate = useInvalidateLogisticsFleet();
  const { data, isLoading, error } = useMyTransportAssignments();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<MyTransportAssignment | null>(null);

  // Evaluated on every render (list refreshes, realtime, responses) so finished runs drop off.
  const nowIso = new Date().toISOString();
  const days = groupUpcomingByDay(data ?? [], nowIso);
  const pendingCount = (data ?? []).filter((assignment) => assignment.status === "assigned" && assignment.ends_at >= nowIso).length;
  const firstName = typeof user?.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null;

  const respond = async (assignment: MyTransportAssignment, response: "confirmed" | "declined", reason?: string) => {
    setBusyId(assignment.id);
    try {
      await respondToTransportAssignment(assignment.id, response, reason);
      toast({ title: response === "confirmed" ? "Transporte confirmado" : "Has indicado que no puedes hacerlo" });
      await invalidate();
    } catch (respondError) {
      toast({ title: "No se pudo enviar tu respuesta", description: getErrorMessage(respondError), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Mis transportes</h1>
          <p className="text-sm text-muted-foreground">
            {firstName ? `Hola, ${firstName}. ` : ""}
            {pendingCount > 0
              ? `Tienes ${pendingCount} ${pendingCount === 1 ? "transporte pendiente" : "transportes pendientes"} de confirmar.`
              : "Tus próximos transportes asignados."}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/notifications">
            <Bell className="mr-1 h-4 w-4" /> Notificaciones
          </Link>
        </Button>
      </div>

      {error ? (
        <Card><CardContent className="py-8 text-center text-sm text-destructive">{getErrorMessage(error)}</CardContent></Card>
      ) : isLoading ? (
        <Card><CardContent className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : days.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No tienes transportes asignados</p>
            <p className="text-sm text-muted-foreground">
              Te avisaremos con una notificación cuando logística te asigne uno.
            </p>
          </CardContent>
        </Card>
      ) : (
        days.map(([dayKey, assignments]) => (
          <section key={dayKey} className="space-y-3" aria-label={formatMadridDayKey(dayKey, "EEEE d 'de' MMMM", { locale: es })}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {formatMadridDayKey(dayKey, "EEEE d 'de' MMMM", { locale: es })}
            </h2>
            {assignments.map((assignment) => (
              <ConductorAssignmentCard
                key={assignment.id}
                assignment={assignment}
                busy={busyId === assignment.id}
                // Declining asks for a reason first; confirming goes straight through.
                onRespond={(response) => (response === "declined" ? setDeclining(assignment) : void respond(assignment, response))}
              />
            ))}
          </section>
        ))
      )}

      <DeclineTransportDialog
        assignment={declining}
        busy={Boolean(declining && busyId === declining.id)}
        onOpenChange={(open) => { if (!open) setDeclining(null); }}
        onDecline={async (reason) => {
          if (!declining) return;
          await respond(declining, "declined", reason);
          setDeclining(null);
        }}
      />
    </div>
  );
};

export default ConductorDashboard;
