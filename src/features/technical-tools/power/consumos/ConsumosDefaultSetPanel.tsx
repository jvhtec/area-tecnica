import { Copy, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConsumosDepartmentConfig } from "@/features/technical-tools/power/consumos/config";
import type { ConsumosToolState } from "@/features/technical-tools/power/consumos/useConsumosTool";
import { TOUR_PACKAGE_LABELS, TOUR_PACKAGE_SIZES, type TourPackageSize } from "@/utils/tourPackages";

type Props = { config: ConsumosDepartmentConfig; state: ConsumosToolState };

export const ConsumosDefaultSetPanel = ({ config, state }: Props) => {
  const { labels } = config;
  const {
    allCopySourceTablesSelected,
    copySelectedDefaultTables,
    copySourceSetId,
    copySourceTables,
    createEmptyDefaultSet,
    defaultSets,
    isTourDefaults,
    newDefaultSetName,
    selectedCopyTableCount,
    selectedCopyTableIds,
    selectedDefaultPackageSize,
    selectedDefaultSet,
    selectedDefaultSetId,
    setCopySourceSetId,
    setNewDefaultSetName,
    setSelectedDefaultPackageSize,
    setSelectedDefaultSetId,
    toggleAllCopySourceTables,
    toggleCopyTableSelection,
    tourName,
  } = state;
  const copyButtonLabel = selectedDefaultSetId
    ? copySourceSetId === selectedDefaultSetId
      ? "Duplicar seleccionadas en este conjunto"
      : "Copiar seleccionadas al conjunto en edición"
    : "Crear conjunto y copiar seleccionadas";
  const canCreateOrCopyDefaultSet = Boolean(selectedDefaultSetId) || newDefaultSetName.trim().length > 0;

  return (
    <>
                {isTourDefaults && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <h3 className="text-sm font-semibold">Conjunto por defecto</h3>
                    {selectedDefaultSet ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Editando:{" "}
                          <span className="font-medium text-foreground">
                            {selectedDefaultSet.name}
                            {selectedDefaultSet.package_size
                              ? ` (${TOUR_PACKAGE_LABELS[selectedDefaultSet.package_size]})`
                              : " (Sin asignar)"}
                          </span>
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 sm:w-auto"
                          onClick={() => {
                            setSelectedDefaultSetId("");
                            setNewDefaultSetName("");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Crear otro conjunto
                        </Button>
                      </div>
                    ) : defaultSets.length > 1 ? (
                      <p className="text-sm text-amber-700">
                        Selecciona un conjunto para ver, editar o añadir tablas a ese paquete.
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Conjunto existente</Label>
                      <Select
                        value={selectedDefaultSetId || "new"}
                        onValueChange={(value) => setSelectedDefaultSetId(value === "new" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un conjunto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Crear nuevo conjunto</SelectItem>
                          {defaultSets.map((set) => (
                            <SelectItem key={set.id} value={set.id}>
                              {set.name}
                              {set.package_size ? ` (${TOUR_PACKAGE_LABELS[set.package_size]})` : " (Sin asignar)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!selectedDefaultSetId && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="newDefaultSetName">Nombre del nuevo conjunto</Label>
                          <Input
                            id="newDefaultSetName"
                            value={newDefaultSetName}
                            onChange={(event) => setNewDefaultSetName(event.target.value)}
                            placeholder={`${tourName || "Tour"} ${labels.defaultBadge}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tamaño de paquete</Label>
                          <Select
                            value={selectedDefaultPackageSize}
                            onValueChange={(value) =>
                              setSelectedDefaultPackageSize(value as TourPackageSize | "unassigned")
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Tamaño de paquete" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Sin asignar</SelectItem>
                              {TOUR_PACKAGE_SIZES.map((size) => (
                                <SelectItem key={size} value={size}>
                                  {TOUR_PACKAGE_LABELS[size]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {!selectedDefaultSetId && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={createEmptyDefaultSet}
                        disabled={!newDefaultSetName.trim()}
                      >
                        <Plus className="h-4 w-4" />
                        Crear conjunto vacío
                      </Button>
                    )}
                    {defaultSets.length > 0 && (
                      <div className="space-y-3 rounded-md border border-dashed p-3">
                        <div>
                          <h4 className="text-sm font-medium">Reutilizar tablas existentes</h4>
                          <p className="text-xs text-muted-foreground">
                            Elige un conjunto origen y copia solo las tablas que quieras al conjunto en edición.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Copiar tablas desde</Label>
                          <Select
                            value={copySourceSetId}
                            onValueChange={setCopySourceSetId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona conjunto origen" />
                            </SelectTrigger>
                            <SelectContent>
                              {defaultSets.map((set) => (
                                <SelectItem key={set.id} value={set.id}>
                                  {set.name}
                                  {set.package_size
                                    ? ` (${TOUR_PACKAGE_LABELS[set.package_size]})`
                                    : " (Sin asignar)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {copySourceTables.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <label className="flex items-center gap-2">
                                <Checkbox
                                  checked={allCopySourceTablesSelected}
                                  onCheckedChange={(checked) =>
                                    toggleAllCopySourceTables(checked === true)
                                  }
                                />
                                Seleccionar todas
                              </label>
                              <span className="text-xs text-muted-foreground">
                                {selectedCopyTableCount}/{copySourceTables.length}
                              </span>
                            </div>
                            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                              {copySourceTables.map((table) => (
                                <label
                                  key={table.defaultTableId || table.id}
                                  className="flex items-start gap-2 rounded-md border bg-background p-2 text-sm"
                                >
                                  <Checkbox
                                    checked={
                                      Boolean(table.defaultTableId) &&
                                      selectedCopyTableIds.includes(table.defaultTableId!)
                                    }
                                    onCheckedChange={(checked) =>
                                      table.defaultTableId &&
                                      toggleCopyTableSelection(
                                        table.defaultTableId,
                                        checked === true,
                                      )
                                    }
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">
                                      {table.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {table.totalVa !== undefined
                                        ? `${(table.totalVa / 1000).toFixed(2)} kVA`
                                        : labels.notAvailable}
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full gap-2"
                              onClick={copySelectedDefaultTables}
                              disabled={
                                selectedCopyTableCount === 0 || !canCreateOrCopyDefaultSet
                              }
                            >
                              <Copy className="h-4 w-4" />
                              {copyButtonLabel}
                            </Button>
                            {!canCreateOrCopyDefaultSet && (
                              <p className="text-xs text-amber-700">
                                Selecciona un conjunto destino o escribe un nombre para crear uno nuevo.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            El conjunto origen seleccionado no tiene tablas de potencia guardadas.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
    </>
  );
};
