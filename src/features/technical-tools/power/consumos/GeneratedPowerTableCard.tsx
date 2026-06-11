import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Save } from "lucide-react";
import { CopyToStageMenu } from "@/features/technical-tools/table-presets/CopyToStageMenu";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import type { PhaseMode, PowerTable } from "@/features/technical-tools/power/types";
import { PowerTableControls } from "@/features/technical-tools/power/PowerTableControls";
import { getResolvedPowerPosition } from "@/utils/powerPositions";
import {
  DEFAULT_FIXTURE_TYPE,
  FIXTURE_PF,
  type ConsumosLabels,
  type FixtureType,
} from "./config";

const formatRowPf = (row: PowerTable["rows"][number]) => {
  const rowPf = Number(row.pf);
  if (Number.isFinite(rowPf) && rowPf > 0) return rowPf.toFixed(2);
  const fixturePf =
    FIXTURE_PF[(row.fixtureType as FixtureType) || DEFAULT_FIXTURE_TYPE]?.pf ??
    FIXTURE_PF[DEFAULT_FIXTURE_TYPE].pf;
  return fixturePf.toFixed(2);
};

export const GeneratedPowerTableCard: React.FC<{
  table: PowerTable;
  labels: ConsumosLabels;
  pduTypes: string[];
  phaseMode: PhaseMode;
  showLineName: boolean;
  showRowPf: boolean;
  showSaveDefault?: boolean;
  isOverrideContext?: boolean;
  /** Stages offered as copy targets; the table's own stage is excluded. */
  copyStages?: TechnicalStage[];
  onCopyToStage?: (stage: TechnicalStage) => void;
  onEdit?: () => void;
  onRemove: () => void;
  onSaveDefault?: () => void;
  onUpdateSettings: (patch: Partial<PowerTable>) => void;
}> = ({
  table,
  labels,
  pduTypes,
  phaseMode,
  showLineName,
  showRowPf,
  showSaveDefault = false,
  isOverrideContext = false,
  copyStages,
  onCopyToStage,
  onEdit,
  onRemove,
  onSaveDefault,
  onUpdateSettings,
}) => {
  const tableId = table.id ?? table.name;
  const safetyMargin = table.snapshotSafetyMargin ?? 0;
  const effectivePhaseMode = table.snapshotPhaseMode ?? phaseMode;

  return (
    <div className="border rounded-lg overflow-hidden mt-6 first:mt-0">
      <div className="bg-muted px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{table.name}</h3>
          {table.stageName && <Badge variant="outline">{table.stageName}</Badge>}
          {isOverrideContext && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700">
              {labels.overrideTableBadge}
            </Badge>
          )}
          {table.isDefault && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              {labels.savedBadge}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCopyToStage && copyStages && copyStages.length > 0 && (
            <CopyToStageMenu
              label={labels.copyTableToStage}
              stages={copyStages}
              excludeStageNumber={table.stageNumber}
              iconOnly
              onCopy={onCopyToStage}
            />
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1">
              <Edit className="h-4 w-4" />
              {labels.edit}
            </Button>
          )}
          {showSaveDefault && onSaveDefault && (
            <Button variant="outline" size="sm" onClick={onSaveDefault} className="gap-1">
              <Save className="h-4 w-4" />
              {labels.saveDefault}
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={onRemove}>
            {labels.removeTable}
          </Button>
        </div>
      </div>

      <PowerTableControls
        table={table}
        tableId={tableId}
        pduTypes={pduTypes}
        labels={labels.controls}
        onUpdateSettings={onUpdateSettings}
      />

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-sm">{labels.colQuantity}</th>
              {showLineName && (
                <th className="px-4 py-3 text-left font-medium text-sm">{labels.colLineName}</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-sm">{labels.colComponent}</th>
              <th className="px-4 py-3 text-left font-medium text-sm">{labels.colWatts}</th>
              {showRowPf && (
                <th className="px-4 py-3 text-left font-medium text-sm">PF</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-sm">{labels.colTotalWatts}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-3 text-sm">{row.quantity}</td>
                {showLineName && (
                  <td className="px-4 py-3 text-sm">{row.lineName || labels.notAvailable}</td>
                )}
                <td className="px-4 py-3 text-sm">{row.componentName}</td>
                <td className="px-4 py-3 text-sm">{row.watts}</td>
                {showRowPf && <td className="px-4 py-3 text-sm">{formatRowPf(row)}</td>}
                <td className="px-4 py-3 text-sm">{row.totalWatts?.toFixed(2)}</td>
              </tr>
            ))}
            {(() => {
              const labelSpan = 1 + (showLineName ? 1 : 0) + 1 + (showRowPf ? 1 : 0) + 1;
              const fullSpan = labelSpan + 1;
              return (
                <>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={labelSpan} className="px-4 py-3 text-right text-sm">
                      {labels.totalWattsLabel}
                    </td>
                    <td className="px-4 py-3 text-sm">{table.totalWatts?.toFixed(2)} W</td>
                  </tr>
                  {safetyMargin > 0 && (
                    <tr className="border-t bg-muted/50 font-medium">
                      <td colSpan={labelSpan} className="px-4 py-3 text-right text-sm">
                        {labels.adjustedWattsLabel(safetyMargin)}
                      </td>
                      <td className="px-4 py-3 text-sm">{table.adjustedWatts?.toFixed(2)} W</td>
                    </tr>
                  )}
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={labelSpan} className="px-4 py-3 text-right text-sm">
                      {labels.apparentPower}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {((table.totalVa || table.totalWatts || 0) / 1000).toFixed(2)} kVA
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={labelSpan} className="px-4 py-3 text-right text-sm">
                      {effectivePhaseMode === "three" ? labels.currentPerPhase : labels.current}
                    </td>
                    <td className="px-4 py-3 text-sm">{table.currentPerPhase?.toFixed(2)} A</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={labelSpan} className="px-4 py-3 text-right text-sm">
                      {labels.pduTypeLabel}
                    </td>
                    <td className="px-4 py-3 text-sm">{table.customPduType || table.pduType}</td>
                  </tr>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={labelSpan} className="px-4 py-3 text-right text-sm">
                      {labels.positionLabel}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getResolvedPowerPosition(table.position, table.customPosition) ||
                        labels.notAvailable}
                    </td>
                  </tr>
                  {table.includesHoist && (
                    <tr className="border-t bg-muted/50 font-medium">
                      <td colSpan={fullSpan} className="px-4 py-3 text-sm">
                        {labels.hoistNote}
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};
