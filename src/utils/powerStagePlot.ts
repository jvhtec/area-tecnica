import {
  POWER_POSITION_PRESETS,
  getResolvedPowerPosition,
  isPowerPositionPreset,
  type PowerPositionPreset,
} from "@/utils/powerPositions";

export type StagePlotTable = {
  id?: number | string;
  name: string;
  position?: string | null;
  customPosition?: string | null;
  pduType?: string;
  customPduType?: string;
  includesHoist?: boolean;
  /** Owning department, used by combined plots to color-code entries. */
  department?: string;
};

export type StagePlotEntry = {
  /** Stringified table id, used to identify the table when dragging. */
  id?: string;
  name: string;
  pduLabel: string;
  /** Additional hoist/motor power (CEE32A 3P+N+G) required at this position. */
  includesHoist?: boolean;
  /** Owning department, used by combined plots to color-code entries. */
  department?: string;
};

export type PowerStagePlotData = {
  zones: Record<PowerPositionPreset, StagePlotEntry[]>;
  custom: Array<{ position: string; entries: StagePlotEntry[] }>;
  unpositioned: StagePlotEntry[];
  /** True when at least one table sits on a preset stage zone (incl. FOH). */
  hasPositionedEntries: boolean;
};

/**
 * Stage zones laid out as seen from the audience (plan view, downstage at the
 * bottom): stage right appears on the left of the drawing. The offstage wings
 * flank the grid (split up/center/down), the backstage band sits behind the
 * stage, and FOH is rendered inside the audience area.
 */
export const STAGE_PLOT_GRID: PowerPositionPreset[][] = [
  ["USR", "USC", "USL"],
  ["CSR", "CSC", "CSL"],
  ["DSR", "DSC", "DSL"],
];

export const STAGE_PLOT_FOH: PowerPositionPreset = "FOH";
/** Offstage wing on the left of the drawing (stage right), top to bottom. */
export const STAGE_PLOT_WING_LEFT_COLUMN: PowerPositionPreset[] = [
  "UOSR",
  "OSR",
  "DOSR",
];
/** Offstage wing on the right of the drawing (stage left), top to bottom. */
export const STAGE_PLOT_WING_RIGHT_COLUMN: PowerPositionPreset[] = [
  "UOSL",
  "OSL",
  "DOSL",
];
/** Backstage band behind the stage, left to right as seen from the audience. */
export const STAGE_PLOT_BACKSTAGE_ROW: PowerPositionPreset[] = [
  "BSR",
  "BSC",
  "BSL",
];

const makeEmptyZones = (): PowerStagePlotData["zones"] =>
  POWER_POSITION_PRESETS.reduce(
    (zones, preset) => {
      zones[preset] = [];
      return zones;
    },
    {} as PowerStagePlotData["zones"],
  );

export const buildPowerStagePlot = (
  tables: StagePlotTable[],
): PowerStagePlotData => {
  const zones = makeEmptyZones();
  const customByPosition = new Map<string, StagePlotEntry[]>();
  const unpositioned: StagePlotEntry[] = [];

  tables.forEach((table) => {
    const entry: StagePlotEntry = {
      ...(table.id !== undefined ? { id: String(table.id) } : {}),
      name: table.name,
      pduLabel: table.customPduType || table.pduType || "",
      ...(table.includesHoist ? { includesHoist: true } : {}),
      ...(table.department ? { department: table.department } : {}),
    };
    const resolved = getResolvedPowerPosition(table.position, table.customPosition);

    if (!resolved) {
      unpositioned.push(entry);
      return;
    }
    if (isPowerPositionPreset(resolved)) {
      zones[resolved].push(entry);
      return;
    }
    const group = customByPosition.get(resolved) || [];
    group.push(entry);
    customByPosition.set(resolved, group);
  });

  return {
    zones,
    custom: [...customByPosition.entries()].map(([position, entries]) => ({
      position,
      entries,
    })),
    unpositioned,
    hasPositionedEntries: POWER_POSITION_PRESETS.some(
      (preset) => zones[preset].length > 0,
    ),
  };
};
