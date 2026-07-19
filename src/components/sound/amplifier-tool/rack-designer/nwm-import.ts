import type {
  AmpModel,
  RackDesignerBlock,
  RackDesignerLayout,
} from '@/components/sound/amplifier-tool/rack-designer/types';
import {
  AMPS_PER_RACK,
  BLOCK_WIDTH,
  blockPixelHeight,
  makeDesignerId,
} from '@/components/sound/amplifier-tool/rack-designer/layout-utils';

/** Normalized amplifier map returned by the `parse-nwm` Edge Function. */
export interface NwmUnit {
  octet: number;
  ip: string;
  presetName: string;
  familyName: string;
  model: string;
  x: number;
  y: number;
}
export interface NwmGroup {
  name: string;
  role: string;
  members: number[];
}
export interface SoundvisionFlysheetEnclosure {
  model: string;
  splayAngleDegrees: number | null;
  siteAngleDegrees: number | null;
  trimHeightMeters: number | null;
}
export interface SoundvisionFlysheetArray {
  groupName: string;
  arrayName: string;
  deployment: 'flown' | 'stacked' | 'unknown';
  azimuthDegrees: number | null;
  topSiteDegrees: number | null;
  bottomSiteDegrees: number | null;
  topHeightMeters: number | null;
  bottomHeightMeters: number | null;
  riggingFrame: string;
  flyingBarSetting: string;
  pickupConfiguration: string;
  totalMassKg: number | null;
  frontLoadKg: number | null;
  rearLoadKg: number | null;
  enclosures: SoundvisionFlysheetEnclosure[];
  warnings: string[];
}
export interface SoundvisionFlysheet {
  projectName: string;
  arrays: SoundvisionFlysheetArray[];
}
export interface NwmMap {
  sessionName: string;
  units: NwmUnit[];
  groups: NwmGroup[];
  flysheet?: SoundvisionFlysheet;
}

const SIDE_COLORS = { L: '#f87171', R: '#60a5fa', C: '#4ade80' } as const;

export function isLaSessionFileName(fileName: string): boolean {
  return /\.(nwm|xmlp)$/i.test(fileName.trim());
}

// Top-level sections in the order they should appear, and the group name NM uses
// for each. A unit is assigned to the first section whose group contains it.
const SECTION_ORDER: Array<{ key: string; group: string }> = [
  { key: 'MAIN', group: 'MAINS' },
  { key: 'SUB', group: 'SUBS' },
  { key: 'FRONT', group: 'FRONTS' },
  { key: 'SIDE', group: 'SIDES' },
  { key: 'DELAY', group: 'DELAYS' },
];

type Side = 'L' | 'R' | 'C';

interface Bucket {
  label: string;
  side: Side;
  units: NwmUnit[];
}

function toAmpModel(model: string): AmpModel {
  const normalized = model.trim().toUpperCase();
  if (normalized === 'LA4' || normalized === 'LA4X' || normalized === 'LA8') {
    return normalized;
  }
  if (normalized === 'LA12X') return 'LA12X';
  if (/PLM|TF/.test(normalized)) return 'PLM20000D';
  return 'OTRO';
}

function sideFromName(name: string): Side {
  const last = name.trim().slice(-1).toUpperCase();
  return last === 'L' ? 'L' : last === 'R' ? 'R' : 'C';
}

/**
 * NM strategy: sessions carry explicit LEFT / RIGHT side groups and top-level
 * section parents (MAINS, SUBS…). Section comes from the parent group, side from
 * LEFT/RIGHT; block label is "MAIN L", "SUB R", etc.
 */
function bucketByLeftRight(map: NwmMap, byName: Map<string, NwmGroup>): Bucket[] {
  const sectionOf = new Map<number, string>();
  for (const { key, group } of SECTION_ORDER) {
    for (const octet of byName.get(group)?.members ?? []) {
      if (!sectionOf.has(octet)) sectionOf.set(octet, key);
    }
  }
  const sideOf = new Map<number, Side>();
  for (const octet of byName.get('LEFT')?.members ?? []) sideOf.set(octet, 'L');
  for (const octet of byName.get('RIGHT')?.members ?? []) sideOf.set(octet, 'R');

  const buckets = new Map<string, Bucket>();
  for (const unit of map.units) {
    const section = sectionOf.get(unit.octet) ?? 'OTROS';
    const side: Side = sideOf.get(unit.octet) ?? 'C';
    const label = section === 'OTROS' ? 'OTROS' : `${section} ${side}`;
    if (!buckets.has(label)) buckets.set(label, { label, side, units: [] });
    buckets.get(label)!.units.push(unit);
  }

  const sideRank: Record<Side, number> = { L: 0, R: 1, C: 2 };
  const sectionRank = (label: string) => {
    const i = SECTION_ORDER.findIndex((entry) => entry.key === label.split(' ')[0]);
    return i === -1 ? SECTION_ORDER.length : i;
  };
  return [...buckets.values()].sort(
    (a, b) =>
      sectionRank(a.label) - sectionRank(b.label) ||
      sideRank[a.side] - sideRank[b.side] ||
      a.label.localeCompare(b.label),
  );
}

/**
 * Soundvision strategy: `.xmlp` sessions have no LEFT/RIGHT groups; the sided
 * arrays are the `role="source"` groups whose names already read "K2 L",
 * "Out R", "KS28 In L". Each amp is assigned to its first source group (document
 * order), the block label is that name, and the side is read off the name.
 */
function bucketBySourceGroups(map: NwmMap): Bucket[] {
  const unitByOctet = new Map(map.units.map((u) => [u.octet, u]));
  const sources = map.groups.filter((g) => g.role === 'source');
  const assigned = new Map<number, string>();
  for (const group of sources) {
    for (const octet of group.members) {
      if (unitByOctet.has(octet) && !assigned.has(octet)) assigned.set(octet, group.name);
    }
  }

  const buckets = new Map<string, Bucket>();
  for (const unit of map.units) {
    const label = assigned.get(unit.octet) ?? 'OTROS';
    const side = label === 'OTROS' ? 'C' : sideFromName(label);
    if (!buckets.has(label)) buckets.set(label, { label, side, units: [] });
    buckets.get(label)!.units.push(unit);
  }

  const orderIndex = new Map(sources.map((group, i) => [group.name, i]));
  return [...buckets.values()].sort((a, b) => {
    const ai = a.label === 'OTROS' ? Infinity : orderIndex.get(a.label) ?? Infinity;
    const bi = b.label === 'OTROS' ? Infinity : orderIndex.get(b.label) ?? Infinity;
    return ai - bi || a.label.localeCompare(b.label);
  });
}

/**
 * Builds a rack-designer layout from an imported NM/Soundvision map. Each unique
 * amplifier becomes one cell (no duplication across the file's overlapping
 * logical groups); cells are IP-sorted within each section+side and packed into
 * physical-rack-sized blocks of AMPS_PER_RACK, colored by PA side, with the real
 * preset name and control IP from the file. The session files don't record which
 * road case each amp lives in, so a group with more than a rack's worth of amps
 * is split into "MAIN L", "MAIN L 2", … which the user can rearrange. Amps in no
 * recognized group fall into "OTROS". Handles both the NM convention (LEFT/RIGHT
 * side groups) and the Soundvision one (sided `role="source"` groups).
 */
export function nwmMapToLayout(
  map: NwmMap,
  resultsFingerprint?: string,
): RackDesignerLayout {
  // LEFT/RIGHT side groups are the NM-format signal; Soundvision sessions have
  // neither and instead carry sided role="source" groups.
  const byName = new Map(map.groups.map((g) => [g.name.toUpperCase(), g]));
  const ordered =
    byName.has('LEFT') || byName.has('RIGHT')
      ? bucketByLeftRight(map, byName)
      : bucketBySourceGroups(map);

  // Each group is packed into physical-rack-sized blocks (3 amps), matching real
  // LA-RAK/PLM-RAK capacity and the calculator-generated layout.
  const blocks: RackDesignerBlock[] = [];
  for (const bucket of ordered) {
    const label = bucket.label;
    const sortedUnits = [...bucket.units].sort((a, b) => a.octet - b.octet);
    const rackCount = Math.ceil(sortedUnits.length / AMPS_PER_RACK);
    for (let i = 0; i < sortedUnits.length; i += AMPS_PER_RACK) {
      const rackNumber = i / AMPS_PER_RACK + 1;
      blocks.push({
        id: makeDesignerId(),
        label: rackCount > 1 ? `${label} ${rackNumber}` : label,
        color: SIDE_COLORS[bucket.side],
        x: 0,
        y: 0,
        amps: sortedUnits.slice(i, i + AMPS_PER_RACK).map((unit) => ({
          id: makeDesignerId(),
          presetName: unit.presetName || unit.familyName || `AMP ${unit.octet}`,
          ip: unit.ip,
          model: toAmpModel(unit.model),
        })),
      });
    }
  }

  // Lay blocks left→right in section order, wrapping to new rows; keep columns
  // aligned to a simple grid so the result is tidy before the user rearranges.
  const columnPitch = BLOCK_WIDTH + 30;
  const perRow = 5;
  let rowY = 40;
  let rowMaxHeight = 0;
  blocks.forEach((block, index) => {
    const col = index % perRow;
    if (col === 0 && index > 0) {
      rowY += rowMaxHeight + 40;
      rowMaxHeight = 0;
    }
    block.x = 40 + col * columnPitch;
    block.y = rowY;
    rowMaxHeight = Math.max(rowMaxHeight, blockPixelHeight(block));
  });

  return {
    version: 1,
    title: map.sessionName?.trim() || 'SISTEMA PA',
    resultsFingerprint,
    blocks,
  };
}
