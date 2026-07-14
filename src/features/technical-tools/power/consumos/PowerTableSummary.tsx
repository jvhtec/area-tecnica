import type { PowerTable } from "@/features/technical-tools/power/types";
import type { ConsumosDepartmentConfig } from "./config";

export const PowerTableSummary = ({
  table,
  labels,
  phaseMode,
  showPosition = true,
}: {
  table: PowerTable;
  labels: ConsumosDepartmentConfig["labels"];
  phaseMode: "single" | "three";
  showPosition?: boolean;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
    <div>
      {labels.totalWattsLabel} <span className="font-medium">{table.totalWatts?.toFixed(2)} W</span>
    </div>
    <div>
      {labels.apparentPower}{" "}
      <span className="font-medium">
        {table.totalVa !== undefined
          ? `${(table.totalVa / 1000).toFixed(2)} kVA`
          : labels.notAvailable}
      </span>
    </div>
    <div>
      {(table.calculation?.phaseMode ?? phaseMode) === "three"
        ? labels.currentPerPhase
        : labels.current}{" "}
      <span className="font-medium">
        {table.currentPerPhase !== undefined
          ? `${table.currentPerPhase.toFixed(2)} A`
          : labels.notAvailable}
      </span>
    </div>
    <div>
      {labels.pduTypeLabel}{" "}
      <span className="font-medium">
        {table.customPduType || table.pduType || labels.notAvailable}
      </span>
    </div>
    {showPosition && (
      <div>
        {labels.positionLabel}{" "}
        <span className="font-medium">
          {table.customPosition || table.position || labels.notAvailable}
        </span>
      </div>
    )}
    {table.includesHoist && (
      <div className="col-span-1 sm:col-span-2 text-green-700">✓ {labels.hoistNote}</div>
    )}
  </div>
);
