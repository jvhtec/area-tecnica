import type { FlexPullsheetTransportLine } from "@/services/flexPullsheets";

export type TruckPlannerTransportKind =
  | "case"
  | "cart"
  | "rack"
  | "dolly"
  | "wheelboard"
  | "pallet"
  | "crate"
  | "other";

export interface SoundTransportProfile {
  id: string;
  skuId: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  transportKind: TruckPlannerTransportKind;
  blocksVerticalColumn: boolean;
  uprightOnly: boolean;
  tiltAllowed: boolean;
  allowedYaw: number[];
  canBeBase: boolean;
  topContactAllowed: boolean;
  maxLoadAboveKg: number;
  minSupportRatio: number;
  stackClass: string | null;
  sourceKind: string;
  sourceUrl: string | null;
  sourceExternalKey: string | null;
}

export interface SoundTransportRule {
  id: string;
  sourceBarcode: string | null;
  sourceName: string | null;
  equipmentUnitsPerTransport: number;
  profile: SoundTransportProfile;
}

export interface NormalizedSoundTransport {
  profile: SoundTransportProfile;
  quantity: number;
  sourceQuantity: number;
  equipmentUnitsPerTransport: number;
  spareCapacity: number;
  origin: "generated" | "direct";
  sourceLines: FlexPullsheetTransportLine[];
  matchedBy: "barcode" | "name";
}

export interface UnresolvedSoundTransportLine {
  line: FlexPullsheetTransportLine;
  reason: "no_transport_rule";
}

export interface SoundTransportNormalizationResult {
  transports: NormalizedSoundTransport[];
  unresolved: UnresolvedSoundTransportLine[];
  sourceLineCount: number;
  resolvedSourceLineCount: number;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function normalizeBarcode(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

type MatchedRule = {
  rule: SoundTransportRule;
  matchedBy: "barcode" | "name";
};

function buildRuleIndexes(rules: SoundTransportRule[]): {
  byBarcode: Map<string, SoundTransportRule>;
  byName: Map<string, SoundTransportRule>;
} {
  const byBarcode = new Map<string, SoundTransportRule>();
  const byName = new Map<string, SoundTransportRule>();

  for (const rule of rules) {
    if (!Number.isFinite(rule.equipmentUnitsPerTransport) || rule.equipmentUnitsPerTransport <= 0) {
      throw new Error(`Invalid equipmentUnitsPerTransport for transport rule ${rule.id}`);
    }

    const barcode = normalizeBarcode(rule.sourceBarcode);
    if (barcode) {
      const existing = byBarcode.get(barcode);
      if (existing && existing.id !== rule.id) {
        throw new Error(`Ambiguous sound transport barcode rule: ${barcode}`);
      }
      byBarcode.set(barcode, rule);
    }

    if (rule.sourceName?.trim()) {
      const key = normalizeName(rule.sourceName);
      const existing = byName.get(key);
      if (existing && existing.id !== rule.id) {
        throw new Error(`Ambiguous sound transport name rule: ${rule.sourceName}`);
      }
      byName.set(key, rule);
    }
  }

  return { byBarcode, byName };
}

function matchRule(
  line: FlexPullsheetTransportLine,
  indexes: ReturnType<typeof buildRuleIndexes>,
): MatchedRule | null {
  const barcode = normalizeBarcode(line.itemBarcode);
  if (barcode) {
    const rule = indexes.byBarcode.get(barcode);
    if (rule) return { rule, matchedBy: "barcode" };
  }

  const byName = indexes.byName.get(normalizeName(line.description));
  return byName ? { rule: byName, matchedBy: "name" } : null;
}

/**
 * Convert Sound Pull Sheet equipment models into the physical loaded transport
 * units consumed by the truck-planner engine.
 *
 * Rules are intentionally exact. Barcode wins over exact normalized name and
 * there is no fuzzy/substring fallback: unresolved equipment must remain
 * visible rather than silently becoming the wrong road case.
 *
 * Quantities are aggregated before ceil() so split Pull Sheet lines do not
 * manufacture extra carts.  Example: 12 K2 + 12 K2 still becomes 6 four-high
 * chariots, not two independent groups of 3 by accident.
 */
export function normalizeSoundPullsheetTransport(
  lines: FlexPullsheetTransportLine[],
  rules: SoundTransportRule[],
): SoundTransportNormalizationResult {
  const indexes = buildRuleIndexes(rules);
  const unresolved: UnresolvedSoundTransportLine[] = [];

  type Bucket = {
    rule: SoundTransportRule;
    matchedBy: "barcode" | "name";
    sourceQuantity: number;
    sourceLines: FlexPullsheetTransportLine[];
  };

  const buckets = new Map<string, Bucket>();

  for (const line of lines) {
    if (line.isVirtual || !Number.isFinite(line.quantity) || line.quantity <= 0) continue;

    const match = matchRule(line, indexes);
    if (!match) {
      unresolved.push({ line, reason: "no_transport_rule" });
      continue;
    }

    const key = match.rule.id;
    const existing = buckets.get(key);
    if (existing) {
      existing.sourceQuantity += line.quantity;
      existing.sourceLines.push(line);
      if (match.matchedBy === "barcode") existing.matchedBy = "barcode";
      continue;
    }

    buckets.set(key, {
      rule: match.rule,
      matchedBy: match.matchedBy,
      sourceQuantity: line.quantity,
      sourceLines: [line],
    });
  }

  const transports = Array.from(buckets.values())
    .map(({ rule, matchedBy, sourceQuantity, sourceLines }): NormalizedSoundTransport => {
      const quantity = Math.ceil(sourceQuantity / rule.equipmentUnitsPerTransport);
      return {
        profile: rule.profile,
        quantity,
        sourceQuantity,
        equipmentUnitsPerTransport: rule.equipmentUnitsPerTransport,
        spareCapacity: quantity * rule.equipmentUnitsPerTransport - sourceQuantity,
        origin: rule.equipmentUnitsPerTransport === 1 ? "direct" : "generated",
        sourceLines,
        matchedBy,
      };
    })
    .sort((a, b) => a.profile.name.localeCompare(b.profile.name));

  return {
    transports,
    unresolved,
    sourceLineCount: lines.filter((line) => !line.isVirtual && line.quantity > 0).length,
    resolvedSourceLineCount: transports.reduce((sum, transport) => sum + transport.sourceLines.length, 0),
  };
}
