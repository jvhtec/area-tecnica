import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { personnelSchema, type PersonnelInput, type PersonnelOptions } from "./personnelModel";
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (name, args) => (dataLayerClient.rpc as unknown as Rpc).call(dataLayerClient, name, args);
export const PERSONNEL_QUERY_ROOT = "personnel_logistics_plans";
export async function personnelDestinationFromAddress(address: string) {
  const value = address.trim();
  if (!value || value.length > 300) throw new Error("Indica una dirección de destino de hasta 300 caracteres.");
  const existing = await dataLayerClient.from("locations").select("id").eq("formatted_address", value).limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;
  const created = await dataLayerClient.from("locations").insert({ name: value, formatted_address: value }).select("id").single();
  if (created.error) throw created.error;
  return created.data.id;
}
export async function listPersonnelPlans(first: string, last: string) {
  const { data, error } = await rpc("list_personnel_logistics_plans", { p_from: first, p_to: last });
  if (error) throw new Error(error.message);
  return personnelSchema.array().parse(data);
}
export async function savePersonnelPlan(plan: PersonnelInput, updatedAt: string | null) {
  const { error } = await rpc("save_personnel_logistics_plan", { p_plan: plan, p_expected_updated_at: updatedAt });
  if (error) throw new Error(error.message);
}
export function usePersonnelPlans(first: string, last: string) {
  return useQuery({ queryKey: [PERSONNEL_QUERY_ROOT, first, last], queryFn: () => listPersonnelPlans(first, last) });
}
export function usePersonnelOptions() {
  return useQuery({ queryKey: [PERSONNEL_QUERY_ROOT, "options"], queryFn: async (): Promise<PersonnelOptions> => {
    const [jobs, locations] = await Promise.all([dataLayerClient.from("jobs").select("id,title").order("start_time", { ascending: false }).limit(500), dataLayerClient.from("locations").select("id,name,formatted_address").order("name")]);
    if (jobs.error) throw jobs.error;
    if (locations.error) throw locations.error;
    return { jobs: jobs.data ?? [], locations: locations.data ?? [] };
  } });
}
export function useInvalidatePersonnel() {
  const client = useQueryClient();
  return () => Promise.all([PERSONNEL_QUERY_ROOT, "transport_driver_assignments", "logistics-events", "today-logistics", "logistics-operations"].map((key) => client.invalidateQueries({ queryKey: [key] })));
}
