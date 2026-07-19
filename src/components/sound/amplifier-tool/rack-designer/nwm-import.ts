import type {
  AmpModel,
  RackDesignerBlock,
  RackDesignerLayout,
} from '@/components/sound/amplifier-tool/rack-designer/types';
import {
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
export interface NwmMap {
  sessionName: string;
  units: NwmUnit[];
  groups: NwmGroup[];
}

const SIDE_COLORS = { L: '#f87171', R: '#60a5fa', C: '#4ade80' } as const;

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

function toAmpModel(model: string): AmpModel {
  // The designer's amp union is LA12X / PLM20000D. NM's LA-family controllers all
  // map to LA12X for labeling; only PLM/TF-driven units would be PLM20000D.
  return /plm|tf/i.test(model) ? 'PLM20000D' : 'LA12X';
}

function buildMembership(groups: NwmGroup[]): {
  sectionOf: Map<number, string>;
  sideOf: Map<number, Side>;
} {
  const byName = new Map(groups.map((g) => [g.name.toUpperCase(), g]));
  const sectionOf = new Map<number, string>();
  for (const { key, group } of SECTION_ORDER) {
    for (const octet of byName.get(group)?.members ?? []) {
      if (!sectionOf.has(octet)) sectionOf.set(octet, key);
    }
  }
  const sideOf = new Map<number, Side>();
  for (const octet of byName.get('LEFT')?.members ?? []) sideOf.set(octet, 'L');
  for (const octet of byName.get('RIGHT')?.members ?? []) sideOf.set(octet, 'R');
  return { sectionOf, sideOf };
}

/**
 * Builds a rack-designer layout from an imported NM map. Each unique amplifier
 * becomes one cell (no duplication across the file's overlapping logical
 * groups); cells are grouped into one block per section+side (MAIN L, MAIN R,
 * SUB L…), IP-sorted and numbered L1…Ln / R1…Rn, colored by PA side, with the
 * real preset name and control IP from the file. Units NM didn't file under a
 * known section fall into an "OTROS" block so nothing is dropped.
 */
export function nwmMapToLayout(map: NwmMap): RackDesignerLayout {
  const { sectionOf, sideOf } = buildMembership(map.groups);

  // Bucket units by "SECTION SIDE" (or a fallback), preserving one entry per amp.
  const buckets = new Map<string, { section: string; side: Side; units: NwmUnit[] }>();
  for (const unit of map.units) {
    const section = sectionOf.get(unit.octet) ?? 'OTROS';
    const side: Side = sideOf.get(unit.octet) ?? 'C';
    const label = section === 'OTROS' ? 'OTROS' : `${section} ${side}`;
    if (!buckets.has(label)) buckets.set(label, { section, side, units: [] });
    buckets.get(label)!.units.push(unit);
  }

  // Stable order: by section order, then L before R before C.
  const sideRank: Record<Side, number> = { L: 0, R: 1, C: 2 };
  const sectionRank = (s: string) => {
    const i = SECTION_ORDER.findIndex((entry) => entry.key === s);
    return i === -1 ? SECTION_ORDER.length : i;
  };
  const ordered = [...buckets.entries()].sort(([la, a], [lb, b]) => {
    const bySection = sectionRank(a.section) - sectionRank(b.section);
    if (bySection !== 0) return bySection;
    const bySide = sideRank[a.side] - sideRank[b.side];
    if (bySide !== 0) return bySide;
    return la.localeCompare(lb);
  });

  const blocks: RackDesignerBlock[] = ordered.map(([label, bucket]) => {
    const sortedUnits = [...bucket.units].sort((a, b) => a.octet - b.octet);
    return {
      id: makeDesignerId(),
      label,
      color: SIDE_COLORS[bucket.side],
      x: 0,
      y: 0,
      amps: sortedUnits.map((unit) => ({
        id: makeDesignerId(),
        presetName: unit.presetName || unit.familyName || `AMP ${unit.octet}`,
        ip: unit.ip,
        model: toAmpModel(unit.model),
      })),
    };
  });

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
    blocks,
  };
}
