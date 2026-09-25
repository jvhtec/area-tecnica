import { useMemo, useState } from "react";
import { BedDouble, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRANSPORT_PROVIDERS, type TransportProvider } from "@/constants/transportProviders";
import {
  SLEEPER_BUS_HIRE_PROVIDERS,
  plannedBusLabel,
  sleeperBusDayContext,
  suggestSleeperBusPlans,
  type SleeperBusPlan,
} from "@/features/logistics/fleet/sleeperBusPlanning";
import { useJobCrewCount, useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";

export type SleeperBusBerthPlannerProps = {
  jobId: string | null;
  dateKey: string;
  eventType: string;
  /** The event being edited, so its own bus and berths are not counted twice. */
  eventId?: string | null;
  berthCount: number | null;
  onBerthCountChange: (value: number | null) => void;
  provider: TransportProvider | null;
  onProviderChange: (value: TransportProvider | null) => void;
  /**
   * Crew transfers: the people on this run. When given it replaces the job crew
   * as the head count, since a transfer may carry only part of it.
   */
  passengers?: number | null;
};

const isHireProvider = (provider: TransportProvider | null) =>
  (SLEEPER_BUS_HIRE_PROVIDERS as readonly string[]).includes(provider ?? "");

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Berths for a sleeper-bus run: how many people the job needs to seat, what its
 * other bus runs that day already provide, and ranked fleet/hire combinations.
 * Applying a suggestion sets this run's berths (the first bus of the plan) and,
 * for a hired bus, the company it is hired from.
 */
export function SleeperBusBerthPlanner({
  jobId,
  dateKey,
  eventType,
  eventId,
  berthCount,
  onBerthCountChange,
  provider,
  onProviderChange,
  passengers = null,
}: SleeperBusBerthPlannerProps) {
  const [extra, setExtra] = useState(0);
  const crew = useJobCrewCount(jobId);
  const matrix = useLogisticsMatrix(dateKey, dateKey, Boolean((jobId || passengers !== null) && dateKey));

  const context = useMemo(
    () =>
      matrix.data
        ? sleeperBusDayContext(matrix.data, { jobId, dateKey, eventType, excludeEventId: eventId })
        : null,
    [matrix.data, jobId, dateKey, eventType, eventId],
  );
  const headcount = passengers ?? (crew.data?.total ?? 0) + extra;
  const stillNeeded = Math.max(0, headcount - (context?.otherBerths ?? 0));
  const plans = useMemo(
    () => suggestSleeperBusPlans(stillNeeded, context?.candidates ?? []),
    [stillNeeded, context],
  );
  const unconfigured = context?.candidates.filter((bus) => bus.layouts.length === 0) ?? [];
  const shortfall = Math.max(0, stillNeeded - (berthCount ?? 0));

  const apply = (plan: SleeperBusPlan, hireProvider?: TransportProvider) => {
    const [first] = plan.buses;
    onBerthCountChange(first.berths);
    if (first.kind === "hire" && hireProvider) onProviderChange(hireProvider);
    // One of our own buses is not hired from anyone.
    if (first.kind === "fleet" && isHireProvider(provider)) onProviderChange(null);
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="sleeper-bus-berths" className="flex items-center gap-2">
          <BedDouble className="h-4 w-4" /> Literas de este autobús
        </Label>
        <Input
          id="sleeper-bus-berths"
          type="number"
          inputMode="numeric"
          min={1}
          max={80}
          className="w-24"
          value={berthCount ?? ""}
          onChange={(changeEvent) => {
            const value = Number.parseInt(changeEvent.target.value, 10);
            onBerthCountChange(Number.isFinite(value) && value > 0 ? Math.min(value, 80) : null);
          }}
        />
      </div>

      {!jobId && passengers === null ? (
        <p className="text-xs text-muted-foreground">
          Elige un trabajo para calcular las literas según el personal asignado.
        </p>
      ) : crew.isLoading || matrix.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Cargando personal y flota" />
      ) : (
        <div className="space-y-2 text-sm">
          {passengers !== null ? (
            <p>Viajan: <strong>{plural(passengers, "persona", "personas")}</strong></p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Personal asignado: <strong>{crew.data?.total ?? 0}</strong>
                {crew.data ? ` (${crew.data.confirmed} confirmados)` : ""}
              </span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Personas extra
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={80}
                  className="h-8 w-16"
                  aria-label="Personas extra (artistas, invitados…)"
                  value={extra}
                  onChange={(changeEvent) => setExtra(Math.min(80, Math.max(0, Number.parseInt(changeEvent.target.value, 10) || 0)))}
                />
              </label>
            </div>
          )}
          {passengers === null && crew.error && <p className="text-xs text-destructive">No se pudo cargar el personal del trabajo.</p>}
          {context && context.otherRuns > 0 && (
            <p className="text-xs text-muted-foreground">
              Otros autobuses cama de este trabajo ese día: {plural(context.otherRuns, "autobús", "autobuses")}
              {" · "}{plural(context.otherBerths, "litera", "literas")}
              {context.otherRunsWithoutBerths > 0 ? ` (${context.otherRunsWithoutBerths} sin literas indicadas)` : ""}
            </p>
          )}
          <p className={shortfall > 0 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
            {headcount === 0
              ? "El trabajo aún no tiene personal asignado."
              : shortfall > 0
                ? `Faltan ${plural(shortfall, "litera", "literas")}: ajusta este autobús o añade otro transporte de autobús cama.`
                : "Todo el personal tiene litera."}
          </p>

          {matrix.error && (
            <p className="text-xs text-muted-foreground">No se pudo cargar la flota: solo se sugieren autobuses de alquiler.</p>
          )}
          {unconfigured.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Sin literas configuradas en Flota: {unconfigured.map((bus) => bus.name).join(", ")}.
            </p>
          )}

          {stillNeeded > 0 && plans.length > 0 && (
            <ul className="space-y-2" aria-label="Sugerencias de autobuses">
              {plans.map((plan) => {
                const first = plan.buses[0];
                return (
                  <li key={plan.buses.map(plannedBusLabel).join("+")} className="rounded border bg-muted/40 p-2">
                    <p className="font-medium">{plan.buses.map(plannedBusLabel).join(" + ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {plural(plan.berths, "litera", "literas")}
                      {plan.spare > 0 ? ` · ${plural(plan.spare, "libre", "libres")}` : " · sin literas libres"}
                      {plan.buses.length > 1 ? " · un transporte por autobús: este sería el primero" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {first.kind === "fleet" ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => apply(plan)}>
                          Configurar este transporte: {first.name} ({first.berths})
                        </Button>
                      ) : (
                        SLEEPER_BUS_HIRE_PROVIDERS.map((hireProvider) => (
                          <Button
                            key={hireProvider}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => apply(plan, hireProvider)}
                          >
                            Alquilar a {TRANSPORT_PROVIDERS[hireProvider].label} ({first.berths})
                          </Button>
                        ))
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
