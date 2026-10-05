import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchAssignmentConsistencyIssues,
  fetchAssignmentSideEffectBacklog,
  retryAssignmentSideEffects,
  type AssignmentConsistencyIssue,
  type AssignmentSideEffect,
} from "@/features/assignments/commands";
import { queryKeys } from "@/lib/react-query";
import { getErrorMessage } from "@/utils/errorMessage";

const MADRID_TIME_ZONE = "Europe/Madrid";

const ISSUE_LABELS: Record<AssignmentConsistencyIssue["issue"], string> = {
  membership_without_schedule: "Asignación sin días activos",
  schedule_without_membership: "Días activos sin asignación",
  scoped_date_not_scheduled: "Día de la asignación no programado",
  declined_with_active_schedule: "Rechazada con días activos",
};

const ISSUE_ORDER: Array<AssignmentConsistencyIssue["issue"]> = [
  "membership_without_schedule",
  "schedule_without_membership",
  "scoped_date_not_scheduled",
  "declined_with_active_schedule",
];

const effectLabel = (effect: AssignmentSideEffect) => {
  if (effect.kind === "notification") return "Notificación";
  const action = effect.action === "remove" ? "quitar de" : "añadir a";
  return `Flex (${action} ${effect.department === "lights" ? "luces" : "sonido"})`;
};

const backlogKey = queryKeys.scope("assignment-side-effect-backlog");
const issuesKey = queryKeys.scope("assignment-consistency-issues");

/**
 * Reconciliation view for assignment commands: post-commit effects (Flex,
 * notifications) that failed or never reported back, with a retry, and
 * read-only membership/schedule diagnostics. No repair action by design.
 */
export function AssignmentReconciliationPanel() {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState<string | null>(null);

  const backlog = useQuery({ queryKey: backlogKey, queryFn: () => fetchAssignmentSideEffectBacklog(50) });
  const issues = useQuery({ queryKey: issuesKey, queryFn: () => fetchAssignmentConsistencyIssues(200) });

  const retry = async (commandId: string) => {
    setRetrying(commandId);
    try {
      const summary = await retryAssignmentSideEffects(commandId);
      if (summary.failed > 0) toast.error(`${summary.failed} efecto(s) siguen fallando`);
      else toast.success("Efectos reintentados correctamente");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo reintentar"));
    } finally {
      setRetrying(null);
      void queryClient.invalidateQueries({ queryKey: backlogKey });
    }
  };

  const issueCounts = ISSUE_ORDER
    .map((issue) => ({ issue, count: (issues.data ?? []).filter((row) => row.issue === issue).length }))
    .filter(({ count }) => count > 0);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Sincronizaciones pendientes o fallidas</h3>
          <Button
            variant="outline"
            size="sm"
            aria-label="Recargar diagnóstico de asignaciones"
            onClick={() => {
              void backlog.refetch();
              void issues.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {backlog.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : backlog.error ? (
          <p className="text-sm text-destructive">{getErrorMessage(backlog.error, "No se pudo cargar")}</p>
        ) : (backlog.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay sincronizaciones pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {(backlog.data ?? []).map((row) => (
              <li key={row.command_id} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs break-all">{row.command_id}</span>
                  <Badge variant={row.side_effects_status === "failed" ? "destructive" : "secondary"}>
                    {row.side_effects_status === "failed" ? "Fallida" : "Sin confirmar"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatInTimeZone(row.created_at, MADRID_TIME_ZONE, "dd/MM/yyyy HH:mm")} · trabajo {row.job_id} · técnico {row.technician_id}
                </p>
                <ul className="text-xs">
                  {row.side_effects.map((effect, index) => (
                    <li key={index}>
                      {effectLabel(effect)}: {effect.status === "succeeded" ? "correcto" : effect.status === "failed" ? `error${effect.last_error ? ` (${effect.last_error})` : ""}` : "pendiente"}
                    </li>
                  ))}
                </ul>
                <Button size="sm" disabled={retrying === row.command_id} onClick={() => void retry(row.command_id)}>
                  {retrying === row.command_id ? "Reintentando…" : "Reintentar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Coherencia asignación / días (últimos 30 días y futuro)</h3>
        {issues.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : issues.error ? (
          <p className="text-sm text-destructive">{getErrorMessage(issues.error, "No se pudo cargar")}</p>
        ) : (issues.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin incoherencias detectadas.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {issueCounts.map(({ issue, count }) => (
                <Badge key={issue} variant="outline">
                  {ISSUE_LABELS[issue]}: {count}
                </Badge>
              ))}
            </div>
            <ul className="space-y-1 text-xs">
              {(issues.data ?? []).slice(0, 50).map((issue) => (
                <li key={`${issue.issue}-${issue.job_id}-${issue.technician_id}`} className="break-all">
                  {ISSUE_LABELS[issue.issue]} · trabajo {issue.job_id} · técnico {issue.technician_id}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
