import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Table } from "../types";

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
        <h3 className="font-semibold">{table.name}</h3>
        <Button variant="destructive" size="sm" onClick={onRemove}>
          Remove Table
        </Button>
      </div>

      <div className="p-4 bg-muted/50 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`hoist-${tableId}`}
              checked={table.includesHoist}
              onCheckedChange={(checked) => onUpdateSettings({ includesHoist: !!checked })}
            />
            <Label htmlFor={`hoist-${tableId}`} className="text-sm">
              Requires additional hoist power (CEE32A 3P+N+G)
            </Label>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <Label className="text-sm whitespace-nowrap">PDU Type Override:</Label>
            <Select
              value={
                table.customPduType
                  ? pduTypes.includes(table.customPduType)
                    ? table.customPduType
                    : "custom"
                  : "default"
              }
              onValueChange={(value) => {
                if (value === "default") {
                  onUpdateSettings({ customPduType: undefined });
                } else if (value === "custom") {
                  onUpdateSettings({ customPduType: "" });
                } else {
                  onUpdateSettings({ customPduType: value });
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Use recommended PDU type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use recommended ({table.pduType})</SelectItem>
                {pduTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom PDU Type</SelectItem>
              </SelectContent>
            </Select>
            {table.customPduType !== undefined && !pduTypes.includes(table.customPduType || "") && (
              <Input
                placeholder="Enter custom PDU type"
                value={table.customPduType || ""}
                onChange={(e) => onUpdateSettings({ customPduType: e.target.value })}
                className="w-full sm:w-[220px]"
              />
            )}
          </div>
        </div>
      </div>

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

