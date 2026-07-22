import { Edit, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConsumosDepartmentConfig } from "@/features/technical-tools/power/consumos/config";
import { PowerTableSummary } from "@/features/technical-tools/power/consumos/PowerTableSummary";
import type { ConsumosToolState } from "@/features/technical-tools/power/consumos/useConsumosTool";

type Props = { config: ConsumosDepartmentConfig; state: ConsumosToolState };

export const ConsumosSavedTables = ({ config, state }: Props) => {
  const { labels } = config;
  const {
    defaultSets,
    handleDeleteDefaultTable,
    handleDeleteOverride,
    isOverrideMode,
    isTourDefaults,
    isUrlOverrideMode,
    overrideDisplayTables,
    phaseMode,
    readOnlyDefaultTables,
    selectedDefaultSet,
    selectedDefaultSetId,
    startEditingDefaultTable,
    startEditingOverride,
    tourDefaultDisplayTables,
  } = state;
  return (
    <>
                {/* Existing tour defaults */}
                {isTourDefaults && !selectedDefaultSetId && defaultSets.length > 1 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Selecciona un conjunto por defecto para ver sus tablas. No se mezclan tablas de paquetes distintos.
                  </div>
                )}
                {isTourDefaults && tourDefaultDisplayTables.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-900">
                      {selectedDefaultSet
                        ? `${labels.existingDefaultsHeading}: ${selectedDefaultSet.name}`
                        : labels.existingDefaultsHeading}
                    </h3>
                    {tourDefaultDisplayTables.map((table) => (
                      <div
                        key={table.id}
                        className="border rounded-lg overflow-hidden bg-blue-50/30"
                      >
                        <div className="bg-blue-100 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-blue-900">{table.name}</h4>
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              {labels.defaultBadge}
                            </Badge>
                          </div>
                          {table.defaultTableId && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditingDefaultTable(table)}
                                className="gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                {labels.edit}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  table.defaultTableId &&
                                  handleDeleteDefaultTable(table.defaultTableId)
                                }
                                className="gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                {labels.deleteAction}
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <PowerTableSummary
                            table={table}
                            labels={labels}
                            phaseMode={phaseMode}
                            showPosition={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Read-only defaults in URL override mode */}
                {isUrlOverrideMode && readOnlyDefaultTables.length > 0 && (
                  <div className="border rounded-lg p-4 bg-green-50 space-y-4">
                    <h3 className="font-semibold text-green-800">
                      {labels.readOnlyDefaultsHeading}
                    </h3>
                    {readOnlyDefaultTables.map((table) => (
                      <div key={table.id} className="border rounded-lg overflow-hidden bg-white">
                        <div className="bg-green-100 px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{table.name}</h4>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {labels.defaultBadge}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <PowerTableSummary table={table} labels={labels} phaseMode={phaseMode} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing overrides */}
                {isOverrideMode && !isTourDefaults && overrideDisplayTables.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-orange-900">
                      {labels.existingOverridesHeading}
                    </h3>
                    {overrideDisplayTables.map((table) => (
                      <div
                        key={table.id}
                        className="border rounded-lg overflow-hidden bg-orange-50/30"
                      >
                        <div className="bg-orange-100 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-orange-900">{table.name}</h4>
                            <Badge
                              variant="outline"
                              className="bg-orange-50 text-orange-700 border-orange-200"
                            >
                              {labels.overrideTableBadge}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                table.overrideId &&
                                startEditingOverride({
                                  id: table.overrideId,
                                  table_name: table.name,
                                  total_watts: table.totalWatts || 0,
                                  position: table.position,
                                  custom_position: table.customPosition,
                                  custom_pdu_type: table.customPduType,
                                  pdu_type: table.pduType,
                                  includes_hoist: table.includesHoist,
                                  override_data: {
                                    rows: table.rows,
                                    calculation: table.calculation,
                                  },
                                })
                              }
                              className="gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              {labels.edit}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                table.overrideId && handleDeleteOverride(table.overrideId)
                              }
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              {labels.deleteAction}
                            </Button>
                          </div>
                        </div>
                        <div className="p-4">
                          <PowerTableSummary table={table} labels={labels} phaseMode={phaseMode} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
    </>
  );
};
