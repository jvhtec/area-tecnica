import { describe, expect, it } from "vitest";
import {
  STAGE_PLOT_GRID,
  buildPowerStagePlot,
} from "@/utils/powerStagePlot";
import { estimatePowerStagePlotHeight } from "@/utils/pdf/powerStagePlotPdf";
import { POWER_POSITION_PRESETS } from "@/utils/powerPositions";

describe("buildPowerStagePlot", () => {
  it("groups tables into preset zones, FOH, custom and unpositioned", () => {
    const plot = buildPowerStagePlot([
      { name: "Dimmers", position: "USL", pduType: "CEE63A 3P+N+G" },
      { name: "Amps SR", position: "DSR", pduType: "CEE32A 3P+N+G", customPduType: "Custom 63A" },
      { name: "Control", position: "FOH", pduType: "Schuko 16A" },
      { name: "Delays", customPosition: "Torre PA", pduType: "CEE16A 3P+N+G" },
      { name: "Backup", pduType: "Schuko 16A" },
    ]);

    expect(plot.zones.USL).toEqual([{ name: "Dimmers", pduLabel: "CEE63A 3P+N+G" }]);
    // custom PDU type wins over the recommended one
    expect(plot.zones.DSR).toEqual([{ name: "Amps SR", pduLabel: "Custom 63A" }]);
    expect(plot.zones.FOH).toEqual([{ name: "Control", pduLabel: "Schuko 16A" }]);
    expect(plot.custom).toEqual([
      { position: "Torre PA", entries: [{ name: "Delays", pduLabel: "CEE16A 3P+N+G" }] },
    ]);
    expect(plot.unpositioned).toEqual([{ name: "Backup", pduLabel: "Schuko 16A" }]);
    expect(plot.hasPositionedEntries).toBe(true);
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
    // every non-FOH preset appears exactly once in the grid
    const flattened = STAGE_PLOT_GRID.flat();
    const nonFohPresets = POWER_POSITION_PRESETS.filter((preset) => preset !== "FOH");
    expect([...flattened].sort()).toEqual([...nonFohPresets].sort());
  });

  it("estimates a plot height that grows with the number of entries", () => {
    const emptyPlot = buildPowerStagePlot([{ name: "One", position: "CSC" }]);
    const busyPlot = buildPowerStagePlot([
      { name: "One", position: "CSC" },
      { name: "Two", position: "CSC" },
      { name: "Three", position: "CSC" },
      { name: "Four", position: "FOH" },
    ]);

    expect(estimatePowerStagePlotHeight(busyPlot)).toBeGreaterThan(
      estimatePowerStagePlotHeight(emptyPlot),
    );
  });
});
