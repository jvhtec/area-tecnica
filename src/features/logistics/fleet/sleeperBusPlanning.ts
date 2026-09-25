/**
 * Sleeper-bus (autobús cama) berth planning: how many berths a job needs, what is
 * already planned for it, and which combinations of our own buses (in one of
 * their berth layouts) and buses hired from The Wild Tour or Montoya cover it.
 *
 * Pure helpers only; the event dialog and the assignment form feed them the
 * logistics matrix read model and the job's crew count.
 */
import type { TransportProvider } from "@/constants/transportProviders";

import {
  assignmentDayKeys,
  type FleetVehicle,
  type LogisticsMatrixData,
  type MatrixTransportEvent,
} from "./fleetModel";

/** Berth counts hired nightliners come in, up to the 20-bed double-deckers. */
export const SLEEPER_BUS_HIRE_SIZES = [12, 14, 16, 18, 20] as const;

/** Companies sleeper buses are hired from. */
export const SLEEPER_BUS_HIRE_PROVIDERS = ["the_wild_tour", "montoya"] as const satisfies readonly TransportProvider[];

export type SleeperBusCandidate = {
  id: string;
  name: string;
  /** Ascending berth counts the bus can be set up with. */
  layouts: readonly number[];
  /** False when the bus already runs another transport that day. */
  available: boolean;
};

export type PlannedBus =
  | { kind: "fleet"; vehicleId: string; name: string; berths: number }
  | { kind: "hire"; berths: number };

export type SleeperBusPlan = {
  buses: PlannedBus[];
  berths: number;
  /** Berths left empty once everyone is on board. */
  spare: number;
  hired: number;
};

type PlanOptions = {
  hireSizes?: readonly number[];
  /** How many plans to return. */
  limit?: number;
  /** Own buses considered at once; larger fleets keep the biggest. */
  maxFleetBuses?: number;
};

/**
 * Every berth total one layout per bus can give, each with the layouts giving it.
 * A subset-sum over the small berth totals involved.
 */
const layoutTotals = (buses: readonly SleeperBusCandidate[]): Map<number, number[]> => {
  let reachable = new Map<number, number[]>([[0, []]]);
  for (const bus of buses) {
    const next = new Map<number, number[]>();
    for (const [total, picks] of reachable) {
      for (const layout of bus.layouts) {
        const sum = total + layout;
        if (!next.has(sum)) next.set(sum, [...picks, layout]);
      }
    }
    reachable = next;
  }
  return reachable;
};

/** Fewest hired buses (then fewest empty berths) reaching `need`. */
const hiresReaching = (need: number, sizes: readonly number[]): number[] => {
  if (need <= 0 || sizes.length === 0) return [];
  const largest = Math.max(...sizes);
  const count = Math.ceil(need / largest);
  // With `count` buses, the size mix (smallest total first) that still reaches `need`.
  const sorted = [...sizes].sort((a, b) => a - b);
  const combos = (remaining: number, from: number): number[][] =>
    remaining === 0
      ? [[]]
      : sorted.slice(from).flatMap((size, offset) =>
          combos(remaining - 1, from + offset).map((rest) => [size, ...rest]));
  const total = (picks: readonly number[]) => picks.reduce((sum, size) => sum + size, 0);
  const best = combos(count, 0)
    .filter((picks) => total(picks) >= need)
    .sort((a, b) => total(a) - total(b))[0];
  return (best ?? Array.from({ length: count }, () => largest)).sort((a, b) => b - a);
};

const hiredBerths = (plan: SleeperBusPlan) =>
  plan.buses.reduce((sum, bus) => sum + (bus.kind === "hire" ? bus.berths : 0), 0);

/**
 * Own buses first (hiring costs money), then fewer buses, then fewer empty
 * berths, then the smaller hire (more of our own berths used).
 */
const compareSleeperBusPlans = (a: SleeperBusPlan, b: SleeperBusPlan) =>
  a.hired - b.hired || a.buses.length - b.buses.length || a.spare - b.spare || hiredBerths(a) - hiredBerths(b);

const signature = (plan: SleeperBusPlan) =>
  plan.buses.map((bus) => (bus.kind === "fleet" ? `f${bus.berths}` : `h${bus.berths}`)).sort().join("+");

/**
 * Ranked ways to seat `headcount` people: own buses first (hiring costs money),
 * then fewer buses, then fewer empty berths. Buses without configured berths or
 * already busy that day are left out.
 */
export const suggestSleeperBusPlans = (
  headcount: number,
  candidates: readonly SleeperBusCandidate[],
  { hireSizes = SLEEPER_BUS_HIRE_SIZES, limit = 3, maxFleetBuses = 6 }: PlanOptions = {},
): SleeperBusPlan[] => {
  if (!Number.isFinite(headcount) || headcount <= 0) return [];
  const fleet = candidates
    .filter((bus) => bus.available && bus.layouts.length > 0)
    .sort((a, b) => Math.max(...b.layouts) - Math.max(...a.layouts))
    .slice(0, maxFleetBuses);

  const plans: SleeperBusPlan[] = [];
  for (let mask = 0; mask < 1 << fleet.length; mask += 1) {
    const subset = fleet.filter((_, index) => mask & (1 << index));
    const largest = subset.reduce((sum, bus) => sum + Math.max(...bus.layouts), 0);
    // A bus the others can do without only adds cost.
    if (subset.some((bus) => largest - Math.max(...bus.layouts) >= headcount)) continue;
    // Each layout mix of these buses leaves a different gap for hires to fill (a
    // bus set up small can pair with a hire that fits exactly), so keep the best.
    let best: SleeperBusPlan | null = null;
    for (const [fleetBerths, layouts] of layoutTotals(subset)) {
      const hires = hiresReaching(headcount - fleetBerths, hireSizes);
      const berths = fleetBerths + hires.reduce((sum, size) => sum + size, 0);
      if (berths < headcount) continue;
      const buses: PlannedBus[] = [
        ...subset.map((bus, index): PlannedBus => ({ kind: "fleet", vehicleId: bus.id, name: bus.name, berths: layouts[index] })),
        ...hires.map((size): PlannedBus => ({ kind: "hire", berths: size })),
      ];
      const plan: SleeperBusPlan = { buses, berths, spare: berths - headcount, hired: hires.length };
      if (!best || compareSleeperBusPlans(plan, best) < 0) best = plan;
    }
    if (best) plans.push(best);
  }

  const seen = new Set<string>();
  return plans
    .sort(compareSleeperBusPlans)
    .filter((plan) => {
      const key = signature(plan);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

export const plannedBusLabel = (bus: PlannedBus): string =>
  bus.kind === "fleet" ? `${bus.name} (${bus.berths})` : `Alquiler ${bus.berths} literas`;

export type SleeperBusDayContext = {
  candidates: SleeperBusCandidate[];
  /** Berths other sleeper-bus runs of the same job, day and direction already provide. */
  otherBerths: number;
  otherRuns: number;
  /** Buses of those runs with no berth count set. */
  otherRunsWithoutBerths: number;
};

/**
 * What the fleet looks like on `dateKey` for planning a run of `jobId`: every
 * active sleeper bus (busy when another run that day already uses it) and the
 * berths the job's other bus runs that day provide.
 */
export const sleeperBusDayContext = (
  data: Pick<LogisticsMatrixData, "vehicles" | "events" | "assignments">,
  { jobId, dateKey, eventType, excludeEventId }: {
    jobId: string | null;
    dateKey: string;
    eventType: string;
    excludeEventId?: string | null;
  },
): SleeperBusDayContext => {
  const eventsById = new Map(data.events.map((event) => [event.id, event]));
  const busy = new Set(
    data.assignments
      .filter((assignment) =>
        assignment.vehicle_id
        && assignment.status !== "declined"
        && assignment.logistics_event_id !== excludeEventId
        && assignmentDayKeys(assignment, eventsById.get(assignment.logistics_event_id)?.timezone).includes(dateKey))
      .map((assignment) => assignment.vehicle_id as string),
  );
  const candidates = data.vehicles
    .filter((vehicle: FleetVehicle) => vehicle.is_active && vehicle.vehicle_type === "sleeper_bus")
    .map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      layouts: vehicle.berth_layouts,
      available: !busy.has(vehicle.id),
    }));
  const others = jobId
    ? data.events.filter((event) =>
        event.id !== excludeEventId
        && event.job_id === jobId
        && event.transport_type === "sleeper_bus"
        && event.event_date === dateKey
        && event.event_type === eventType)
    : [];
  return {
    candidates,
    otherBerths: others.reduce((sum, event) => sum + (event.berth_count ?? 0), 0),
    otherRuns: others.length,
    otherRunsWithoutBerths: others.filter((event) => event.berth_count === null).length,
  };
};

/** The bus's layout that best fits `need`: the smallest reaching it, else the largest. */
export const bestLayoutFor = (layouts: readonly number[], need: number): number | null => {
  if (layouts.length === 0) return null;
  return [...layouts].sort((a, b) => a - b).find((layout) => layout >= need) ?? Math.max(...layouts);
};

/**
 * Berths a bus run has to provide: its own figure, else the people on a crew
 * transfer, else the whole job crew.
 */
export const berthsNeeded = (
  event: Pick<MatrixTransportEvent, "transport_type" | "berth_count" | "job_crew_count"> &
    Partial<Pick<MatrixTransportEvent, "passenger_count">>,
): number | null =>
  event.transport_type === "sleeper_bus"
    ? event.berth_count ?? event.passenger_count ?? event.job_crew_count ?? null
    : null;

/**
 * When the chosen bus cannot seat what the run needs even in its largest layout:
 * `{ needed, available }`, else null (also when the bus has no berths configured).
 */
export const berthShortfall = (
  vehicle: Pick<FleetVehicle, "vehicle_type" | "berth_layouts"> | null,
  event: Pick<MatrixTransportEvent, "transport_type" | "berth_count" | "job_crew_count"> &
    Partial<Pick<MatrixTransportEvent, "passenger_count">>,
): { needed: number; available: number } | null => {
  const needed = berthsNeeded(event);
  if (!vehicle || vehicle.vehicle_type !== "sleeper_bus" || vehicle.berth_layouts.length === 0 || !needed) return null;
  const available = Math.max(...vehicle.berth_layouts);
  return available < needed ? { needed, available } : null;
};
