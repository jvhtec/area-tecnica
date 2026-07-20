import type { AmplifierResults } from '@/components/sound/amplifier-tool/types';
import type {
  AmpModel,
  RackDesignerAmp,
  RackDesignerBlock,
  RackDesignerLayout,
  RackSide,
} from '@/components/sound/amplifier-tool/rack-designer/types';

export const CANVAS_WIDTH = 1500;
export const CANVAS_HEIGHT = 1100;
export const GRID_SIZE = 10;
export const BLOCK_WIDTH = 180;
export const BLOCK_HEADER_HEIGHT = 28;
export const AMP_CELL_HEIGHT = 48;
export const AMPS_PER_RACK = 3;

export const DEFAULT_IP_BASE = '192.168.1.11';
export const DEFAULT_LAYOUT_TITLE = 'SISTEMA PA';

export function createEmptyRackDesignerLayout(
  title: string = DEFAULT_LAYOUT_TITLE,
): RackDesignerLayout {
  return {
    version: 1,
    title,
    blocks: [],
  };
}

export const RACK_COLOR_PALETTE = [
  { name: 'Rojo', value: '#f87171' },
  { name: 'Azul', value: '#60a5fa' },
  { name: 'Verde', value: '#4ade80' },
  { name: 'Amarillo', value: '#facc15' },
  { name: 'Naranja', value: '#fb923c' },
  { name: 'Morado', value: '#c084fc' },
  { name: 'Turquesa', value: '#2dd4bf' },
  { name: 'Gris', value: '#d1d5db' },
] as const;

const SIDE_COLORS: Record<RackSide, string> = {
  L: '#f87171',
  R: '#60a5fa',
  C: '#4ade80',
};

const SECTION_LABELS: Record<string, string> = {
  mains: 'MAIN',
  outs: 'OUT',
  subs: 'SUB',
  fronts: 'FRONT',
  delays: 'DELAY',
  other: 'AUX',
};

const SECTION_ORDER = ['mains', 'outs', 'subs', 'fronts', 'delays', 'other'];

export function makeDesignerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blockPixelHeight(block: Pick<RackDesignerBlock, 'amps'>): number {
  return BLOCK_HEADER_HEIGHT + block.amps.length * AMP_CELL_HEIGHT;
}

/**
 * Joins the given amps (by id) into a single rack of at most AMPS_PER_RACK.
 * The amps are collected in canvas order (block order, then position within the
 * block), moved out of their source racks into one new rack placed where the
 * first selected amp lived, and any rack left empty is dropped. A partially
 * emptied source rack is nudged aside so it doesn't sit under the new one.
 * Returns the blocks unchanged when fewer than two amps resolve.
 */
export function joinAmpsIntoRack(
  blocks: RackDesignerBlock[],
  ampIds: readonly string[],
): RackDesignerBlock[] {
  const wanted = new Set(ampIds);
  const selected: RackDesignerAmp[] = [];
  let anchor: RackDesignerBlock | null = null;
  for (const block of blocks) {
    for (const amp of block.amps) {
      if (wanted.has(amp.id)) {
        selected.push(amp);
        if (!anchor) anchor = block;
      }
    }
  }
  if (selected.length < 2 || !anchor) return blocks;

  const joinedAmps = selected.slice(0, AMPS_PER_RACK);
  const joinedIds = new Set(joinedAmps.map((amp) => amp.id));
  const newBlock: RackDesignerBlock = {
    id: makeDesignerId(),
    label: anchor.label,
    color: anchor.color,
    x: anchor.x,
    y: anchor.y,
    amps: joinedAmps.map((amp) => ({ ...amp })),
  };

  const result: RackDesignerBlock[] = [];
  for (const block of blocks) {
    const remainingAmps = block.amps.filter((amp) => !joinedIds.has(amp.id));
    if (block.id === anchor.id) {
      result.push(newBlock);
      if (remainingAmps.length > 0) {
        // Leftover amps from the anchor rack shift right when possible, or left
        // when the anchor is too close to the canvas edge.
        const rightX = block.x + BLOCK_WIDTH + 30;
        const maxX = CANVAS_WIDTH - BLOCK_WIDTH;
        result.push({
          ...block,
          x: rightX <= maxX ? rightX : Math.max(0, block.x - BLOCK_WIDTH - 30),
          amps: remainingAmps,
        });
      }
    } else if (remainingAmps.length > 0) {
      result.push({ ...block, amps: remainingAmps });
    }
  }
  return result;
}

/**
 * Drops the source rack's amps into the target rack, keeping the target's
 * identity (label, colour and position). Only as many amps as fit under
 * AMPS_PER_RACK move; any surplus stays in the source rack, which is left where
 * it is. A fully emptied source rack is removed. Returns the blocks unchanged
 * when the merge can't apply (same block, missing block, or a full target).
 */
export function mergeRackIntoRack(
  blocks: RackDesignerBlock[],
  sourceId: string,
  targetId: string,
): RackDesignerBlock[] {
  if (sourceId === targetId) return blocks;
  const source = blocks.find((block) => block.id === sourceId);
  const target = blocks.find((block) => block.id === targetId);
  if (!source || !target) return blocks;
  const capacity = AMPS_PER_RACK - target.amps.length;
  if (capacity <= 0) return blocks;

  const moving = source.amps.slice(0, capacity);
  const movingIds = new Set(moving.map((amp) => amp.id));
  const leftover = source.amps.filter((amp) => !movingIds.has(amp.id));

  const result: RackDesignerBlock[] = [];
  for (const block of blocks) {
    if (block.id === targetId) {
      result.push({ ...block, amps: [...block.amps, ...moving.map((amp) => ({ ...amp }))] });
    } else if (block.id === sourceId) {
      if (leftover.length > 0) result.push({ ...block, amps: leftover });
      // A source rack emptied by the merge is dropped.
    } else {
      result.push(block);
    }
  }
  return result;
}

/**
 * Finds the rack a dragged block would merge into: the block whose bounds
 * contain the dragged block's header centre (the grab point), skipping the
 * dragged block itself and any rack already at AMPS_PER_RACK. When several
 * overlap, the one whose centre is nearest wins. Returns null when none qualify.
 */
export function findMergeTarget(
  blocks: RackDesignerBlock[],
  sourceId: string,
): string | null {
  const source = blocks.find((block) => block.id === sourceId);
  if (!source) return null;
  const probeX = source.x + BLOCK_WIDTH / 2;
  const probeY = source.y + BLOCK_HEADER_HEIGHT / 2;
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const block of blocks) {
    if (block.id === sourceId || block.amps.length >= AMPS_PER_RACK) continue;
    const height = blockPixelHeight(block);
    const inside =
      probeX >= block.x &&
      probeX <= block.x + BLOCK_WIDTH &&
      probeY >= block.y &&
      probeY <= block.y + height;
    if (!inside) continue;
    const dist = Math.hypot(probeX - (block.x + BLOCK_WIDTH / 2), probeY - (block.y + height / 2));
    if (dist < bestDist) {
      bestDist = dist;
      bestId = block.id;
    }
  }
  return bestId;
}

export function isValidIp(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function incrementIp(ip: string, by: number): string {
  if (!isValidIp(ip)) return ip;
  const parts = ip.trim().split('.').map(Number);
  const base = ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
  const value = Math.max(0, Math.min(0xffffffff, base + by));
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

/** Reassigns IPs sequentially amp by amp, block by block, starting at baseIp. */
export function assignSequentialIps(
  blocks: RackDesignerBlock[],
  baseIp: string,
): RackDesignerBlock[] {
  let offset = 0;
  return blocks.map((block) => ({
    ...block,
    amps: block.amps.map((amp) => ({ ...amp, ip: incrementIp(baseIp, offset++) })),
  }));
}

export function assignBlockIps(block: RackDesignerBlock, baseIp: string): RackDesignerBlock {
  return {
    ...block,
    amps: block.amps.map((amp, index) => ({ ...amp, ip: incrementIp(baseIp, index) })),
  };
}

interface GeneratedAmp {
  presetName: string;
  model: AmpModel;
  side: RackSide;
}

function buildSectionAmps(
  section: string,
  data: AmplifierResults['perSection'][string],
): GeneratedAmp[] {
  const base = SECTION_LABELS[section] ?? section.toUpperCase();
  const typeCounts: Array<[AmpModel, number]> = [
    ['LA12X', data.laAmps ?? 0],
    ['PLM20000D', data.plmAmps ?? 0],
  ];

  const amps: GeneratedAmp[] = [];
  if (data.mirrored) {
    // Alternate sides across the whole section (not per model) so mixed
    // LA12X/PLM sections stay balanced — e.g. 1 LA + 1 PLM lands L + R.
    const leftAmps: GeneratedAmp[] = [];
    const rightAmps: GeneratedAmp[] = [];
    const counters = { L: 0, R: 0 };
    let nextSide: 'L' | 'R' = 'L';
    for (const [model, count] of typeCounts) {
      for (let i = 0; i < count; i++) {
        const side: 'L' | 'R' = nextSide;
        nextSide = side === 'L' ? 'R' : 'L';
        const target = side === 'L' ? leftAmps : rightAmps;
        target.push({ presetName: `${base} ${side}${++counters[side]}`, model, side });
      }
    }
    amps.push(...leftAmps, ...rightAmps);
  } else {
    const total = typeCounts.reduce((sum, [, count]) => sum + count, 0);
    let counter = 0;
    for (const [model, count] of typeCounts) {
      for (let i = 0; i < count; i++) {
        amps.push({
          presetName: total > 1 ? `${base} ${++counter}` : base,
          model,
          side: 'C',
        });
      }
    }
  }
  return amps;
}

/**
 * Stable fingerprint of the calculation a layout was generated from. Stored
 * with the layout so a stale saved design is regenerated instead of silently
 * shown next to a newer calculation.
 */
export function computeResultsFingerprint(results: AmplifierResults): string {
  const parts = SECTION_ORDER.map((section) => {
    const data = results.perSection[section];
    if (!data || data.totalAmps === 0) return `${section}:0`;
    return `${section}:${data.laAmps ?? 0}/${data.plmAmps ?? 0}/${data.mirrored ? 'm' : 's'}`;
  });
  return parts.join('|');
}

/**
 * Builds the initial rack layout from calculator results: amps are grouped by
 * PA side (L / R / center) and amp model, packed into racks of 3, colored by
 * side (L red, R blue, center green — matching the crew's usual IP sheets) and
 * given sequential IPs starting at DEFAULT_IP_BASE.
 */
export function generateLayoutFromResults(
  results: AmplifierResults,
  title: string = DEFAULT_LAYOUT_TITLE,
): RackDesignerLayout {
  const amps: GeneratedAmp[] = [];
  for (const section of SECTION_ORDER) {
    const data = results.perSection[section];
    if (data && data.totalAmps > 0) {
      amps.push(...buildSectionAmps(section, data));
    }
  }

  let ipOffset = 0;
  const buildSideBlocks = (side: RackSide): RackDesignerBlock[] => {
    const sideBlocks: RackDesignerBlock[] = [];
    const sideAmps = amps.filter((amp) => amp.side === side);
    let rackNumber = 0;
    for (const model of ['LA12X', 'PLM20000D'] as AmpModel[]) {
      const modelAmps = sideAmps.filter((amp) => amp.model === model);
      for (let i = 0; i < modelAmps.length; i += AMPS_PER_RACK) {
        const chunk = modelAmps.slice(i, i + AMPS_PER_RACK);
        const rackAmps: RackDesignerAmp[] = chunk.map((amp) => ({
          id: makeDesignerId(),
          presetName: amp.presetName,
          model: amp.model,
          ip: incrementIp(DEFAULT_IP_BASE, ipOffset++),
        }));
        const prefix = model === 'LA12X' ? 'LA-RAK' : 'PLM-RAK';
        const sideTag = side === 'C' ? '' : `${side}`;
        sideBlocks.push({
          id: makeDesignerId(),
          label: `${prefix} ${sideTag}${++rackNumber}`,
          color: SIDE_COLORS[side],
          x: 0,
          y: 0,
          amps: rackAmps,
        });
      }
    }
    return sideBlocks;
  };

  const left = buildSideBlocks('L');
  const right = buildSideBlocks('R');
  const center = buildSideBlocks('C');

  const columnPitch = BLOCK_WIDTH + 30;
  const rowPitch = blockPixelHeight({ amps: new Array(AMPS_PER_RACK) }) + 50;
  const placeGrid = (
    blocks: RackDesignerBlock[],
    originX: number,
    originY: number,
    perRow: number,
  ) => {
    blocks.forEach((block, index) => {
      block.x = originX + (index % perRow) * columnPitch;
      block.y = originY + Math.floor(index / perRow) * rowPitch;
    });
  };

  placeGrid(left, 40, 40, 3);
  placeGrid(right, 40 + 3 * columnPitch + 90, 40, 3);
  const sideRows = Math.max(Math.ceil(left.length / 3), Math.ceil(right.length / 3));
  placeGrid(center, 40, 40 + Math.max(sideRows, 1) * rowPitch, 6);

  return {
    version: 1,
    title,
    resultsFingerprint: computeResultsFingerprint(results),
    blocks: [...left, ...right, ...center],
  };
}

const storageKey = (scope: string) => `amp-rack-designer:${scope}`;

const AMP_MODELS: readonly string[] = [
  'LA4',
  'LA4X',
  'LA8',
  'LA12X',
  'PLM20000D',
  'OTRO',
];

function isStoredAmp(value: unknown): value is RackDesignerAmp {
  const amp = value as RackDesignerAmp;
  return (
    !!amp &&
    typeof amp.id === 'string' &&
    typeof amp.presetName === 'string' &&
    typeof amp.ip === 'string' &&
    AMP_MODELS.includes(amp.model)
  );
}

function isStoredBlock(value: unknown): value is RackDesignerBlock {
  const block = value as RackDesignerBlock;
  return (
    !!block &&
    typeof block.id === 'string' &&
    typeof block.label === 'string' &&
    typeof block.color === 'string' &&
    Number.isFinite(block.x) &&
    Number.isFinite(block.y) &&
    Array.isArray(block.amps) &&
    block.amps.every(isStoredAmp)
  );
}

function isStoredLayout(value: unknown): value is RackDesignerLayout {
  const layout = value as RackDesignerLayout;
  return (
    !!layout &&
    layout.version === 1 &&
    typeof layout.title === 'string' &&
    (layout.resultsFingerprint === undefined || typeof layout.resultsFingerprint === 'string') &&
    Array.isArray(layout.blocks) &&
    layout.blocks.every(isStoredBlock)
  );
}

export function loadStoredLayout(scope: string): RackDesignerLayout | null {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredLayout(scope: string, layout: RackDesignerLayout): void {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(layout));
  } catch {
    // Storage full or unavailable — the designer keeps working in memory.
  }
}
