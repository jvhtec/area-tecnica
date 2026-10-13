import { dataLayerClient } from "@/services/dataLayerClient";

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;

export async function setDriverLeave(driverId: string, first: string, last: string, status: "day_off" | "clear") {
  const result = await (dataLayerClient.rpc as unknown as Rpc).call(dataLayerClient, "set_logistics_driver_leave", {
    p_driver: driverId, p_start: first, p_end: last, p_status: status,
  });
  if (result.error) throw new Error(result.error.message);
}
