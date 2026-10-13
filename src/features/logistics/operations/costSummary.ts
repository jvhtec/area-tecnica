import { operationTotal, type Operation } from "./operationsModel";
export const COST_CONCEPTS = [{ key: "transport_cost", label: "Transporte" }, { key: "hotel_cost", label: "Hotel" }, { key: "other_cost", label: "Otros" }] as const;
/** All report views use the same rounding and missing-data rules. */
export function costSummary(operations: (Operation | undefined)[]) {
  return {
    hasRecorded: operations.some(operation => COST_CONCEPTS.some(({ key }) => operation?.[key] != null)),
    total: operations.reduce((sum, operation) => sum + Math.round(operationTotal(operation) * 100), 0) / 100,
    concepts: COST_CONCEPTS.map(({ key, label }) => ({ key, label, amount: operations.reduce((sum, operation) => sum + Math.round((operation?.[key] ?? 0) * 100), 0) / 100, recorded: operations.some(operation => operation?.[key] != null), pending: operations.some((operation) => operation?.[key] == null) })),
  };
}
