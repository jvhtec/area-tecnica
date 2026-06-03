import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Table } from "../types";
import { PowerTableControls } from "@/features/technical-tools/power/PowerTableControls";
import {
  getResolvedPowerPosition,
} from "@/utils/powerPositions";

export const PowerTableCard: React.FC<{
  table: Table;
  pduTypes: string[];
  safetyMargin: number;
  phaseMode: "single" | "three";
  onRemove: () => void;
  onUpdateSettings: (patch: Partial<Table>) => void;
}> = ({ table, pduTypes, safetyMargin, phaseMode, onRemove, onUpdateSettings }) => {
  const tableId = table.id ?? table.name;

  return (
    <div className="border rounded-lg overflow-hidden mt-6">
      <div className="bg-muted px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{table.name}</h3>
          {table.stageName && <Badge variant="outline">{table.stageName}</Badge>}
        </div>
        <Button variant="destructive" size="sm" onClick={onRemove}>
          Remove Table
        </Button>
      </div>

      <PowerTableControls
        table={table}
        tableId={tableId}
        pduTypes={pduTypes}
        onUpdateSettings={onUpdateSettings}
      />

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-sm">Quantity</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Component</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Watts (per unit)</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Total Watts</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-3 text-sm">{row.quantity}</td>
                <td className="px-4 py-3 text-sm">{row.componentName}</td>
                <td className="px-4 py-3 text-sm">{row.watts}</td>
                <td className="px-4 py-3 text-sm">{row.totalWatts?.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="border-t bg-muted/50 font-medium">
              <td colSpan={3} className="px-4 py-3 text-right text-sm">
                Total Watts:
              </td>
              <td className="px-4 py-3 text-sm">{table.totalWatts?.toFixed(2)} W</td>
            </tr>
            {safetyMargin > 0 && (
              <tr className="border-t bg-muted/50 font-medium">
                <td colSpan={3} className="px-4 py-3 text-right text-sm">
                  Adjusted Watts ({safetyMargin}% safety margin):
                </td>
                <td className="px-4 py-3 text-sm">{table.adjustedWatts?.toFixed(2)} W</td>
              </tr>
            )}
            <tr className="border-t bg-muted/50 font-medium">
              <td colSpan={3} className="px-4 py-3 text-right text-sm">
                Potencia Aparente:
              </td>
              <td className="px-4 py-3 text-sm">{((table.totalVa || table.totalWatts || 0) / 1000).toFixed(2)} kVA</td>
            </tr>
            <tr className="border-t bg-muted/50 font-medium">
              <td colSpan={3} className="px-4 py-3 text-right text-sm">
                {phaseMode === "three" ? "Current per Phase:" : "Current:"}
              </td>
              <td className="px-4 py-3 text-sm">{table.currentPerPhase?.toFixed(2)} A</td>
            </tr>
            <tr className="border-t bg-muted/50 font-medium">
              <td colSpan={3} className="px-4 py-3 text-right text-sm">
                PDU Type:
              </td>
              <td className="px-4 py-3 text-sm">{table.customPduType || table.pduType}</td>
            </tr>
            <tr className="border-t bg-muted/50 font-medium">
              <td colSpan={3} className="px-4 py-3 text-right text-sm">
                Position:
              </td>
              <td className="px-4 py-3 text-sm">{getResolvedPowerPosition(table.position, table.customPosition) || "N/A"}</td>
            </tr>
            {table.includesHoist && (
              <tr className="border-t bg-muted/50 font-medium">
                <td colSpan={4} className="px-4 py-3 text-sm">
                  Additional Hoist Power Required: CEE32A 3P+N+G
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
