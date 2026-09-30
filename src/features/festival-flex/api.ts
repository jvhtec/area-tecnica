import { dataLayerClient } from "@/services/dataLayerClient";
import type {
  PaPresetOption,
  PullsheetPresetItemRow,
} from "@/components/festival/push-to-flex-pullsheet/model";

/** Flex resource id by equipment name, for the catalogue entries that are linked to Flex. */
export async function fetchFlexResourceIdsByName(names: readonly string[]): Promise<Map<string, string>> {
  const { data, error } = await dataLayerClient
    .from("equipment")
    .select("name, resource_id")
    .in("name", [...names])
    .not("resource_id", "is", null);
  if (error) throw error;

  const resourceIds = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.resource_id) resourceIds.set(row.name, row.resource_id);
  }
  return resourceIds;
}

/** Sound presets of the job first, then the shared ones. */
export async function fetchSoundPresets(jobId: string): Promise<PaPresetOption[]> {
  const { data, error } = await dataLayerClient
    .from("presets")
    .select("id, name, job_id")
    .eq("department", "sound")
    .or(`job_id.eq.${jobId},job_id.is.null`)
    .order("job_id", { ascending: false })
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** The items of one preset with the equipment they point to. */
export async function fetchPresetItems(presetId: string): Promise<PullsheetPresetItemRow[]> {
  const { data, error } = await dataLayerClient
    .from("preset_items")
    .select("quantity, subsystem, equipment:equipment(id, name, category, resource_id)")
    .eq("preset_id", presetId);
  if (error) throw error;
  // PostgREST types an embedded row as an array or an object depending on the relationship.
  return (data ?? []) as unknown as PullsheetPresetItemRow[];
}
