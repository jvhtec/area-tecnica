import {
  POWER_POSITION_PRESETS,
  getResolvedPowerPosition,
  isPowerPositionPreset,
  type PowerPositionPreset,
} from "@/utils/powerPositions";

export type StagePlotTable = {
  name: string;
  position?: string | null;
  customPosition?: string | null;
  pduType?: string;
  customPduType?: string;
};

export type StagePlotEntry = {
  name: string;
  pduLabel: string;
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
 * bottom): stage right appears on the left of the drawing. FOH is rendered as
 * a separate band in front of the stage.
 */
export const STAGE_PLOT_GRID: PowerPositionPreset[][] = [
  ["USR", "USC", "USL"],
  ["CSR", "CSC", "CSL"],
  ["DSR", "DSC", "DSL"],
];

export const STAGE_PLOT_FOH: PowerPositionPreset = "FOH";

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
      name: table.name,
      pduLabel: table.customPduType || table.pduType || "",
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
