import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  STAGE_PLOT_FOH,
  STAGE_PLOT_GRID,
  buildPowerStagePlot,
  type StagePlotEntry,
  type StagePlotTable,
} from "@/utils/powerStagePlot";
import type { ConsumosLabels } from "./config";

const ZoneEntries: React.FC<{ entries: StagePlotEntry[] }> = ({ entries }) => (
  <div className="flex flex-col items-center gap-1">
    {entries.map((entry, index) => (
      <div
        key={`${entry.name}-${index}`}
        className="max-w-full rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-center"
        title={entry.pduLabel ? `${entry.name} — ${entry.pduLabel}` : entry.name}
      >
        <p className="truncate text-xs font-medium text-red-900">{entry.name}</p>
        {entry.pduLabel && (
          <p className="truncate text-[10px] text-red-700">{entry.pduLabel}</p>
        )}
      </div>
    ))}
  </div>
);

/**
 * Plan view of the stage (audience at the bottom, stage right on the left of
 * the drawing) showing where each generated table/PDU sits.
 */
export const PowerStagePlot: React.FC<{
  tables: StagePlotTable[];
  labels: ConsumosLabels;
}> = ({ tables, labels }) => {
  const plot = buildPowerStagePlot(tables);
  if (!plot.hasPositionedEntries) return null;

  const fohEntries = plot.zones[STAGE_PLOT_FOH];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{labels.stagePlotTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-3xl">
          <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {labels.stagePlotStage}
          </p>
          <div className="overflow-hidden rounded-lg border-2 border-foreground/30">
            <div className="grid grid-cols-3">
              {STAGE_PLOT_GRID.flat().map((zone) => {
                const entries = plot.zones[zone];
                return (
                  <div
                    key={zone}
                    className={cn(
                      "relative min-h-[72px] border border-foreground/10 p-2 pt-5",
                      entries.length > 0 ? "bg-background" : "bg-muted/40",
                    )}
                  >
                    <span className="absolute left-1.5 top-1 text-[10px] font-semibold text-muted-foreground">
                      {zone}
                    </span>
                    <ZoneEntries entries={entries} />
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "relative mx-auto mt-2 w-2/3 rounded-lg border-2 border-dashed border-foreground/30 p-2 pt-5",
              fohEntries.length > 0 ? "bg-background" : "bg-muted/40",
            )}
          >
            <span className="absolute left-1.5 top-1 text-[10px] font-semibold text-muted-foreground">
              {STAGE_PLOT_FOH}
            </span>
            <ZoneEntries entries={fohEntries} />
          </div>

          <p className="mt-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {labels.stagePlotAudience}
          </p>

          {(plot.custom.length > 0 || plot.unpositioned.length > 0) && (
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              {plot.custom.map((group) => (
                <p key={group.position}>
                  <span className="font-medium text-foreground">{group.position}:</span>{" "}
                  {group.entries
                    .map((entry) =>
                      entry.pduLabel ? `${entry.name} (${entry.pduLabel})` : entry.name,
                    )
                    .join(", ")}
                </p>
              ))}
              {plot.unpositioned.length > 0 && (
                <p>
                  <span className="font-medium text-foreground">
                    {labels.stagePlotUnpositioned}:
                  </span>{" "}
                  {plot.unpositioned
                    .map((entry) =>
                      entry.pduLabel ? `${entry.name} (${entry.pduLabel})` : entry.name,
                    )
                    .join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
