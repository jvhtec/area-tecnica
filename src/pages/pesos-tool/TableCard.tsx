import React from "react";
import { Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WeightTable {
    id: number;
    name: string;
    dualMotors?: boolean;
    clusterId?: string;
    cablePick?: boolean;
    cablePickWeight?: string;
    rows: Array<{
        quantity: number;
        componentName: string;
        weight: number;
        totalWeight?: number;
    }>;
    totalWeight?: number;
    riggingPoints?: string;
}

interface TableCardProps {
    table: WeightTable;
    isTourDefaults: boolean;
    isDefaults: boolean;
    isTourContext: boolean;
    saveAsDefaultSet: () => void;
    removeTable: (id: number) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
    table,
    isTourDefaults,
    isDefaults,
    isTourContext,
    saveAsDefaultSet,
    removeTable,
}) => {
    return (
        <div className="border rounded-lg overflow-x-auto">
            <div className="bg-muted px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{table.name}</h3>
                    {isTourDefaults && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Default
                        </Badge>
                    )}
                </div>
                <div className="flex gap-2">
                    {!isDefaults && isTourContext && (
                        <Button variant="outline" size="sm" onClick={() => saveAsDefaultSet()}>
                            <Save className="h-4 w-4 mr-1" />
                            Save as Default
                        </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => table.id && removeTable(table.id)}>
                        Remove Table
                    </Button>
                </div>
            </div>

            {/* Advanced Options Display */}
            {(table.dualMotors || table.clusterId || table.cablePick) && (
                <div className="p-4 bg-muted/50 space-y-2">
                    <h4 className="font-medium text-sm">Configuration:</h4>
                    <div className="flex flex-wrap gap-4 text-sm">
                        {table.dualMotors && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Dual Motors</span>}
                        {table.clusterId && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Mirrored Cluster</span>
                        )}
                        {table.cablePick && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                Cable Pick ({table.cablePickWeight} kg)
                            </span>
                        )}
                    </div>
                </div>
            )}

            <table className="w-full">
                <thead className="bg-muted/50">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">Quantity</th>
                        <th className="px-4 py-3 text-left font-medium">Component</th>
                        <th className="px-4 py-3 text-left font-medium">Weight (per unit)</th>
                        <th className="px-4 py-3 text-left font-medium">Total Weight</th>
                    </tr>
                </thead>
                <tbody>
                    {table.rows.map((row: any, index: number) => (
                        <tr key={index} className="border-t">
                            <td className="px-4 py-3">{row.quantity}</td>
                            <td className="px-4 py-3">{row.componentName}</td>
                            <td className="px-4 py-3">{row.weight} kg</td>
                            <td className="px-4 py-3">{row.totalWeight?.toFixed(2)} kg</td>
                        </tr>
                    ))}
                    <tr className="border-t bg-muted/50 font-medium">
                        <td colSpan={3} className="px-4 py-3 text-right">
                            Total Weight:
                        </td>
                        <td className="px-4 py-3">{table.totalWeight?.toFixed(2)} kg</td>
                    </tr>
                </tbody>
            </table>
            {table.dualMotors && (
                <div className="px-4 py-2 text-sm text-gray-500 bg-muted/30 italic">
                    *This configuration uses dual motors. Load is distributed between two motors for safety and redundancy.
                </div>
            )}
            {table.riggingPoints && (
                <div className="px-4 py-2 text-sm text-blue-600 bg-blue-50 border-t">
                    <strong>Rigging Points:</strong> {table.riggingPoints}
                </div>
            )}
        </div>
    );
};
