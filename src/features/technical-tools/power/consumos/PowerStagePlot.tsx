import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  STAGE_PLOT_FOH,
  STAGE_PLOT_GRID,
  STAGE_PLOT_WING_LEFT,
  STAGE_PLOT_WING_RIGHT,
  buildPowerStagePlot,
  type StagePlotEntry,
  type StagePlotTable,
} from "@/utils/powerStagePlot";
import type { PowerPositionPreset } from "@/utils/powerPositions";
import type { ConsumosLabels } from "./config";

const UNPOSITIONED_ZONE = "unpositioned";

type DragGhost = { name: string; x: number; y: number };

const zoneAtPoint = (x: number, y: number) =>
  document
    .elementFromPoint(x, y)
    ?.closest("[data-stage-zone]")
    ?.getAttribute("data-stage-zone") ?? null;

/**
 * Plan view of the stage (audience at the bottom, stage right on the left of
 * the drawing) showing where each generated table/PDU sits. Tables can be
 * repositioned by dragging them between zones (pointer events, so it works
 * with both mouse and touch).
 */
export const PowerStagePlot: React.FC<{
  tables: StagePlotTable[];
  labels: ConsumosLabels;
  /** Show the 16A schuko requirement inside the FOH box. */
  fohSchukoRequired?: boolean;
  /** Ids (stringified) of tables whose position may be changed by dragging. */
  movableIds?: Set<string>;
  onMoveTable?: (tableId: string, position: PowerPositionPreset | null) => void;
}> = ({ tables, labels, fohSchukoRequired = false, movableIds, onMoveTable }) => {
  const dragInfoRef = useRef<{ id: string; from: string } | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const isDragging = ghost !== null;

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: PointerEvent) => {
      setGhost((current) =>
        current ? { ...current, x: event.clientX, y: event.clientY } : current,
      );
      setHoverZone(zoneAtPoint(event.clientX, event.clientY));
    };
    const finishDrag = (event: PointerEvent, commit: boolean) => {
      const dragInfo = dragInfoRef.current;
      dragInfoRef.current = null;
      setGhost(null);
      setHoverZone(null);
      if (!commit || !dragInfo || !onMoveTable) return;
      const zone = zoneAtPoint(event.clientX, event.clientY);
      if (!zone || zone === dragInfo.from) return;
      onMoveTable(
        dragInfo.id,
        zone === UNPOSITIONED_ZONE ? null : (zone as PowerPositionPreset),
      );
    };
    const handleUp = (event: PointerEvent) => finishDrag(event, true);
    const handleCancel = (event: PointerEvent) => finishDrag(event, false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [isDragging, onMoveTable]);

  const plot = buildPowerStagePlot(tables);
  const canDrag = Boolean(onMoveTable) && (movableIds?.size ?? 0) > 0;
  // With dragging enabled the plot is shown as soon as there are tables, so
  // unpositioned ones can be dragged onto the stage.
  if (!plot.hasPositionedEntries && !(canDrag && tables.length > 0)) return null;

  const isMovable = (entry: StagePlotEntry) =>
    canDrag && Boolean(entry.id) && Boolean(movableIds?.has(entry.id!));

  const formatChipText = (entry: StagePlotEntry) => {
    const base = entry.pduLabel ? `${entry.name} (${entry.pduLabel})` : entry.name;
    return entry.includesHoist ? `${base} ${labels.stagePlotHoist}` : base;
  };

  const startDrag = (entry: StagePlotEntry, fromZone: string) =>
    (event: React.PointerEvent) => {
      if (!isMovable(entry)) return;
      event.preventDefault();
      dragInfoRef.current = { id: entry.id!, from: fromZone };
      setGhost({ name: entry.name, x: event.clientX, y: event.clientY });
    };

  const renderEntries = (entries: StagePlotEntry[], zone: string) => (
    <div className="flex flex-col items-center gap-1">
      {entries.map((entry, index) => (
        <div
          key={`${entry.id ?? entry.name}-${index}`}
          onPointerDown={startDrag(entry, zone)}
          className={cn(
            "max-w-full rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-center",
            isMovable(entry) && "cursor-grab touch-none select-none active:cursor-grabbing",
          )}
          title={entry.pduLabel ? `${entry.name} — ${entry.pduLabel}` : entry.name}
        >
          <p className="truncate text-xs font-medium text-red-900">{entry.name}</p>
          {entry.pduLabel && (
            <p className="truncate text-[10px] text-red-700">{entry.pduLabel}</p>
          )}
          {entry.includesHoist && (
            <p className="truncate text-[10px] italic text-amber-700">
              {labels.stagePlotHoist}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  const zoneClasses = (zone: string, hasEntries: boolean, extra?: string) =>
    cn(
      "relative p-2 pt-5",
      hasEntries ? "bg-background" : "bg-muted/40",
      isDragging && hoverZone === zone && "ring-2 ring-inset ring-red-400",
      extra,
    );

  const fohEntries = plot.zones[STAGE_PLOT_FOH];
  const wingLeftEntries = plot.zones[STAGE_PLOT_WING_LEFT];
  const wingRightEntries = plot.zones[STAGE_PLOT_WING_RIGHT];
  const audienceLabel = (
    <p className="py-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {labels.stagePlotAudience}
    </p>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{labels.stagePlotTitle}</CardTitle>
        {canDrag && (
          <p className="text-xs text-muted-foreground">{labels.stagePlotDragHint}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-3xl">
          <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {labels.stagePlotStage}
          </p>

          {/* Offstage wings flanking the stage grid */}
          <div className="flex items-stretch gap-1">
            <div
              data-stage-zone={STAGE_PLOT_WING_LEFT}
              className={zoneClasses(
                STAGE_PLOT_WING_LEFT,
                wingLeftEntries.length > 0,
                "w-16 shrink-0 rounded-l-lg border-2 border-foreground/20 sm:w-20",
              )}
            >
              <span className="absolute left-1.5 top-1 text-[10px] font-semibold text-muted-foreground">
                {STAGE_PLOT_WING_LEFT}
              </span>
              {renderEntries(wingLeftEntries, STAGE_PLOT_WING_LEFT)}
            </div>

            <div className="grid flex-1 grid-cols-3 overflow-hidden rounded-lg border-2 border-foreground/30">
              {STAGE_PLOT_GRID.flat().map((zone) => {
                const entries = plot.zones[zone];
                return (
                  <div
                    key={zone}
                    data-stage-zone={zone}
                    className={zoneClasses(
                      zone,
                      entries.length > 0,
                      "min-h-[72px] border border-foreground/10",
                    )}
                  >
                    <span className="absolute left-1.5 top-1 text-[10px] font-semibold text-muted-foreground">
                      {zone}
                    </span>
                    {renderEntries(entries, zone)}
                  </div>
                );
              })}
            </div>

            <div
              data-stage-zone={STAGE_PLOT_WING_RIGHT}
              className={zoneClasses(
                STAGE_PLOT_WING_RIGHT,
                wingRightEntries.length > 0,
                "w-16 shrink-0 rounded-r-lg border-2 border-foreground/20 sm:w-20",
              )}
            >
              <span className="absolute left-1.5 top-1 text-[10px] font-semibold text-muted-foreground">
                {STAGE_PLOT_WING_RIGHT}
              </span>
              {renderEntries(wingRightEntries, STAGE_PLOT_WING_RIGHT)}
            </div>
          </div>

          {/* Audience area: FOH sits inside it, with audience before and after */}
          <div className="mt-2 rounded-lg bg-muted/30 px-2 pb-1 pt-0.5">
            {audienceLabel}
            <div
              data-stage-zone={STAGE_PLOT_FOH}
              className={zoneClasses(
                STAGE_PLOT_FOH,
                fohEntries.length > 0,
                "mx-auto w-2/3 rounded-lg border-2 border-dashed border-foreground/30",
              )}
            >
              <span className="absolute left-1.5 top-1 text-[10px] font-semibold text-muted-foreground">
                {STAGE_PLOT_FOH}
              </span>
              {renderEntries(fohEntries, STAGE_PLOT_FOH)}
              {fohSchukoRequired && (
                <p className="mt-1 text-center text-[10px] italic text-amber-700">
                  {labels.stagePlotFohSchuko}
                </p>
              )}
            </div>
            {audienceLabel}
          </div>

          {/* Custom positions + unpositioned tray (drop here to clear position) */}
          {(plot.custom.length > 0 || plot.unpositioned.length > 0 || canDrag) && (
            <div className="mt-4 space-y-2">
              {plot.custom.map((group) => (
                <div key={group.position} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{group.position}:</span>
                  {group.entries.map((entry, index) => (
                    <span
                      key={`${entry.id ?? entry.name}-${index}`}
                      onPointerDown={startDrag(entry, `custom:${group.position}`)}
                      className={cn(
                        "rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-900",
                        isMovable(entry) &&
                          "cursor-grab touch-none select-none active:cursor-grabbing",
                      )}
                    >
                      {formatChipText(entry)}
                    </span>
                  ))}
                </div>
              ))}
              <div
                data-stage-zone={UNPOSITIONED_ZONE}
                className={cn(
                  "flex min-h-[36px] flex-wrap items-center gap-2 rounded-lg border border-dashed border-foreground/20 p-2 text-sm",
                  isDragging &&
                    hoverZone === UNPOSITIONED_ZONE &&
                    "ring-2 ring-inset ring-red-400",
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {labels.stagePlotUnpositioned}:
                </span>
                {plot.unpositioned.map((entry, index) => (
                  <span
                    key={`${entry.id ?? entry.name}-${index}`}
                    onPointerDown={startDrag(entry, UNPOSITIONED_ZONE)}
                    className={cn(
                      "rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-900",
                      isMovable(entry) &&
                        "cursor-grab touch-none select-none active:cursor-grabbing",
                    )}
                  >
                    {formatChipText(entry)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drag ghost following the pointer */}
        {ghost && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-900 shadow-md"
            style={{ left: ghost.x, top: ghost.y - 8 }}
          >
            {ghost.name}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
