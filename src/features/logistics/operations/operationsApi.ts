import { useQuery } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { operationSchema, type OperationInput } from "./operationsModel";
import { z } from "zod";
type Rpc = (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
async function call(name: string, args?: Record<string, unknown>) {
  const result = await (dataLayerClient.rpc as unknown as Rpc).call(dataLayerClient, name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export const operationsRoot = "logistics-operations";
export async function listOperations() { return operationSchema.array().parse(await call("list_logistics_operations")); }
export function useOperations() { return useQuery({ queryKey: [operationsRoot], queryFn: listOperations, staleTime: 30000 }); }
export function useLogisticsResponsibles() { return useQuery({ queryKey: [operationsRoot, "responsibles"], queryFn: async () => z.array(z.object({ id: z.string().uuid(), name: z.string() })).parse(await call("list_logistics_responsibles")) }); }
export async function saveOperation(input: OperationInput, expected: string | null) {
  await call("save_logistics_operation", { p_input: input, p_expected_updated_at: expected });
}
const historySchema = z.object({ id: z.string(), changed_at: z.string(), actor_name: z.string().nullable(), action: z.string(), before_data: z.record(z.string(), z.unknown()).nullable(), after_data: z.record(z.string(), z.unknown()).nullable() });
export function useOperationHistory(kind: string, id: string) {
  return useQuery({ queryKey: [operationsRoot, "history", kind, id], queryFn: async () => historySchema.array().parse(await call("list_logistics_operation_history", { p_kind: kind, p_id: id })) });
}
