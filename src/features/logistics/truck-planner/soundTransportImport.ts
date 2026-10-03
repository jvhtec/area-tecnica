import { dataLayerClient } from "@/services/dataLayerClient";
import { getPullsheetTransportLines } from "@/services/flexPullsheets";

import {
  normalizeSoundPullsheetTransport,
  type SoundTransportNormalizationResult,
  type SoundTransportProfile,
  type SoundTransportRule,
  type TruckPlannerTransportKind,
} from "./soundTransportNormalizer";

type RpcResult = { data: unknown; error: { message?: string } | null };
type UntypedRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

const rpc: UntypedRpc = (name, args) =>
  (dataLayerClient.rpc as unknown as UntypedRpc).call(dataLayerClient, name, args);

interface SoundTransportRuleRow {
  rule_id: string;
  source_barcode: string | null;
  source_name: string | null;
  equipment_units_per_transport: number | string;
  profile_id: string;
  sku_id: string;
  profile_name: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  weight_kg: number | string;
  transport_kind: TruckPlannerTransportKind;
  blocks_vertical_column: boolean;
  upright_only: boolean;
  tilt_allowed: boolean;
  allowed_yaw: number[];
  can_be_base: boolean;
  top_contact_allowed: boolean;
  max_load_above_kg: number | string;
  min_support_ratio: number | string;
  stack_class: string | null;
  source_kind: string;
  source_url: string | null;
  source_external_key: string | null;
}

function finiteNumber(value: number | string, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} in Sound truck transport profile`);
  }
  return parsed;
}

function rowToRule(row: SoundTransportRuleRow): SoundTransportRule {
  const profile: SoundTransportProfile = {
    id: row.profile_id,
    skuId: row.sku_id,
    name: row.profile_name,
    lengthMm: row.length_mm,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    weightKg: finiteNumber(row.weight_kg, "weight_kg"),
    transportKind: row.transport_kind,
    blocksVerticalColumn: row.blocks_vertical_column,
    uprightOnly: row.upright_only,
    tiltAllowed: row.tilt_allowed,
    allowedYaw: row.allowed_yaw,
    canBeBase: row.can_be_base,
    topContactAllowed: row.top_contact_allowed,
    maxLoadAboveKg: finiteNumber(row.max_load_above_kg, "max_load_above_kg"),
    minSupportRatio: finiteNumber(row.min_support_ratio, "min_support_ratio"),
    stackClass: row.stack_class,
    sourceKind: row.source_kind,
    sourceUrl: row.source_url,
    sourceExternalKey: row.source_external_key,
  };

  return {
    id: row.rule_id,
    sourceBarcode: row.source_barcode,
    sourceName: row.source_name,
    equipmentUnitsPerTransport: finiteNumber(
      row.equipment_units_per_transport,
      "equipment_units_per_transport",
    ),
    profile,
  };
}

export async function getSoundTransportRules(): Promise<SoundTransportRule[]> {
  const { data, error } = await rpc("tp_get_sound_transport_rules");
  if (error) {
    throw new Error(error.message || "No se pudieron cargar las reglas de transporte de sonido");
  }
  if (!Array.isArray(data)) return [];
  return (data as SoundTransportRuleRow[]).map(rowToRule);
}

/**
 * First native Truck Planner import seam:
 *
 * Flex Sound Pull Sheet -> condensed material rows -> explicit transport rules
 * -> loaded transport profiles.
 *
 * The result is intentionally still pre-packing.  The truck-planner core will
 * consume result.transports and decide vehicle/placement; unresolved rows must
 * be shown to the user before a plan can be published.
 */
export async function importSoundPullsheetForTruckPlanner(
  pullsheetElementId: string,
): Promise<SoundTransportNormalizationResult> {
  const [lines, rules] = await Promise.all([
    getPullsheetTransportLines(pullsheetElementId),
    getSoundTransportRules(),
  ]);

  return normalizeSoundPullsheetTransport(lines, rules);
}
