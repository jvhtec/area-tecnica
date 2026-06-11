import { describe, expect, it } from "vitest";
import {
  STAGE_PLOT_BACKSTAGE_ROW,
  STAGE_PLOT_GRID,
  STAGE_PLOT_WING_LEFT_COLUMN,
  STAGE_PLOT_WING_RIGHT_COLUMN,
  buildPowerStagePlot,
} from "@/utils/powerStagePlot";
import { estimatePowerStagePlotHeight } from "@/utils/pdf/powerStagePlotPdf";
import { POWER_POSITION_PRESETS } from "@/utils/powerPositions";

describe("buildPowerStagePlot", () => {
  it("groups tables into preset zones, FOH, wings, custom and unpositioned", () => {
    const plot = buildPowerStagePlot([
      { id: 1, name: "Dimmers", position: "USL", pduType: "CEE63A 3P+N+G" },
      { id: 2, name: "Amps SR", position: "DSR", pduType: "CEE32A 3P+N+G", customPduType: "Custom 63A" },
      { id: 3, name: "Control", position: "FOH", pduType: "Schuko 16A" },
      {
        id: 4,
        name: "Side fills",
        position: "OSL",
        pduType: "CEE32A 3P+N+G",
        includesHoist: true,
      },
      { id: 5, name: "Delays", customPosition: "Torre PA", pduType: "CEE16A 3P+N+G" },
      { name: "Backup", pduType: "Schuko 16A" },
    ]);

    expect(plot.zones.USL).toEqual([
      { id: "1", name: "Dimmers", pduLabel: "CEE63A 3P+N+G" },
    ]);
    // custom PDU type wins over the recommended one
    expect(plot.zones.DSR).toEqual([
      { id: "2", name: "Amps SR", pduLabel: "Custom 63A" },
    ]);
    expect(plot.zones.FOH).toEqual([
      { id: "3", name: "Control", pduLabel: "Schuko 16A" },
    ]);
    expect(plot.zones.OSL).toEqual([
      { id: "4", name: "Side fills", pduLabel: "CEE32A 3P+N+G", includesHoist: true },
    ]);
    expect(plot.custom).toEqual([
      {
        position: "Torre PA",
        entries: [{ id: "5", name: "Delays", pduLabel: "CEE16A 3P+N+G" }],
      },
    ]);
    expect(plot.unpositioned).toEqual([{ name: "Backup", pduLabel: "Schuko 16A" }]);
    expect(plot.hasPositionedEntries).toBe(true);
  });

  it("carries the department through to entries for combined color-coded plots", () => {
    const plot = buildPowerStagePlot([
      { name: "Dimmers", position: "USL", pduType: "CEE63A 3P+N+G", department: "lights" },
    ]);

    expect(plot.zones.USL[0].department).toBe("lights");
  });

  it("reports no positioned entries when only custom/unpositioned tables exist", () => {
    const plot = buildPowerStagePlot([
      { name: "Delays", customPosition: "Torre PA" },
      { name: "Backup" },
    ]);

    expect(plot.hasPositionedEntries).toBe(false);
  });

  it("lays the grid out from the audience perspective (stage right on the left)", () => {
    expect(STAGE_PLOT_GRID[0]).toEqual(["USR", "USC", "USL"]);
    expect(STAGE_PLOT_GRID[2]).toEqual(["DSR", "DSC", "DSL"]);
    expect(STAGE_PLOT_WING_LEFT_COLUMN).toEqual(["UOSR", "OSR", "DOSR"]);
    expect(STAGE_PLOT_WING_RIGHT_COLUMN).toEqual(["UOSL", "OSL", "DOSL"]);
    expect(STAGE_PLOT_BACKSTAGE_ROW).toEqual(["BSR", "BSC", "BSL"]);
    // every preset appears exactly once across grid, wings, backstage and FOH
    const allPlacements = [
      ...STAGE_PLOT_GRID.flat(),
      ...STAGE_PLOT_WING_LEFT_COLUMN,
      ...STAGE_PLOT_WING_RIGHT_COLUMN,
      ...STAGE_PLOT_BACKSTAGE_ROW,
      "FOH",
    ];
    expect([...allPlacements].sort()).toEqual([...POWER_POSITION_PRESETS].sort());
  });

  it("estimates a plot height that grows with entries and the schuko note", () => {
    const smallPlot = buildPowerStagePlot([{ name: "One", position: "CSC" }]);
    const busyPlot = buildPowerStagePlot([
      { name: "One", position: "CSC" },
      { name: "Two", position: "CSC" },
      { name: "Three", position: "CSC" },
      { name: "Four", position: "FOH" },
    ]);

    expect(estimatePowerStagePlotHeight(busyPlot)).toBeGreaterThan(
      estimatePowerStagePlotHeight(smallPlot),
    );
    expect(estimatePowerStagePlotHeight(smallPlot, true)).toBeGreaterThan(
      estimatePowerStagePlotHeight(smallPlot, false),
    );
    // hoist power adds an extra line to the entry, growing the zone
    const hoistPlot = buildPowerStagePlot([
      { name: "One", position: "CSC", includesHoist: true },
      { name: "Two", position: "CSC" },
      { name: "Three", position: "CSC" },
    ]);
    const noHoistPlot = buildPowerStagePlot([
      { name: "One", position: "CSC" },
      { name: "Two", position: "CSC" },
      { name: "Three", position: "CSC" },
    ]);
    expect(estimatePowerStagePlotHeight(hoistPlot)).toBeGreaterThan(
      estimatePowerStagePlotHeight(noHoistPlot),
    );
  });
});
