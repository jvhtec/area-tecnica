import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { es } from "date-fns/locale";
import { Bell, ChevronDown, ChevronUp, Loader2, Truck } from "lucide-react";

import { ConductorAssignmentCard } from "@/components/logistics/fleet/ConductorAssignmentCard";
import { ConductorLocationSharingCard } from "@/components/logistics/fleet/ConductorLocationSharingCard";
import { DeclineTransportDialog } from "@/components/logistics/fleet/DeclineTransportDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { respondToTransportAssignment } from "@/features/logistics/fleet/fleetApi";
import { formatTransportDateKey, type MyTransportAssignment } from "@/features/logistics/fleet/fleetModel";
import {
  useInvalidateLogisticsFleet,
  useMyTransportAssignments,
  useTransportProducerContacts,
} from "@/features/logistics/fleet/useLogisticsFleet";
import { getErrorMessage } from "@/utils/errorMessage";
import { addMadridCalendarDays, formatMadridDateKey, formatMadridDayKey } from "@/utils/timezoneUtils";

/** How far back the history section reaches. */
const HISTORY_DAYS = 30;

/** Assignments grouped by their transport-local start day, in day order. */
const groupByDay = (assignments: MyTransportAssignment[]) => {
  const groups = new Map<string, MyTransportAssignment[]>();
  for (const assignment of assignments) {
    const dayKey = formatTransportDateKey(assignment.starts_at, assignment.timezone);
    groups.set(dayKey, [...(groups.get(dayKey) ?? []), assignment]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};

const dayLabel = (dayKey: string) => formatMadridDayKey(dayKey, "EEEE d 'de' MMMM", { locale: es });

const ConductorDashboard = () => {
  const { toast } = useToast();
  const { user } = useOptimizedAuth();
  const invalidate = useInvalidateLogisticsFleet();
  // One query covers recent history and everything ahead (no upper bound).
  const fromKey = addMadridCalendarDays(formatMadridDateKey(new Date()), -HISTORY_DAYS);
  const { data, isLoading, error } = useMyTransportAssignments(fromKey);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<MyTransportAssignment | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // A real clock drives countdowns and, critically, the server-backed sharing
  // eligibility boundary even when no query/realtime event causes a rerender.
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(() => setNowIso(new Date().toISOString()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const assignments = useMemo(() => data ?? [], [data]);
  const upcoming = assignments.filter((assignment) => assignment.ends_at > nowIso);
  const past = assignments
    .filter((assignment) => assignment.ends_at <= nowIso)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const days = groupByDay(upcoming);
  // The next run the driver has not refused: it gets the map and the countdown.
  const nextId = upcoming.find((assignment) => assignment.status !== "declined")?.id ?? null;
  const pendingCount = upcoming.filter((assignment) => assignment.status === "assigned").length;
  const jobIds = useMemo(
    () => upcoming.flatMap((assignment) => (assignment.job_id ? [assignment.job_id] : [])),
    [upcoming],
  );
  const producersByJob = useTransportProducerContacts(jobIds);
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

      {/* A failed background refetch (a tunnel, no coverage) keeps the last list on screen
          and, crucially, keeps location sharing mounted so its offline re-send can work. */}
      {error && data && (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          Sin conexión: mostrando la última información disponible.
        </p>
      )}

      {data && user?.id && (
        <ConductorLocationSharingCard assignments={upcoming} nowIso={nowIso} userId={user.id} />
      )}

      {error && !data ? (
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
        days.map(([dayKey, dayAssignments]) => (
          <section key={dayKey} className="space-y-3" aria-label={dayLabel(dayKey)}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {dayLabel(dayKey)}
            </h2>
            {dayAssignments.map((assignment) => (
              <ConductorAssignmentCard
                key={assignment.id}
                assignment={assignment}
                busy={busyId === assignment.id}
                highlight={assignment.id === nextId}
                nowIso={nowIso}
                producers={assignment.job_id ? producersByJob.get(assignment.job_id) : undefined}
                // Declining asks for a reason first; confirming goes straight through.
                onRespond={(response) => (response === "declined" ? setDeclining(assignment) : void respond(assignment, response))}
              />
            ))}
          </section>
        ))
      )}

      {data && past.length > 0 && (
        <section className="space-y-3" aria-label="Transportes anteriores">
          <Button
            variant="ghost"
            size="sm"
            className="px-0 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
            Transportes anteriores ({past.length})
          </Button>
          {showHistory && past.map((assignment) => (
            <ConductorAssignmentCard
              key={assignment.id}
              assignment={assignment}
              busy={false}
              nowIso={nowIso}
              onRespond={() => undefined}
            />
          ))}
        </section>
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
