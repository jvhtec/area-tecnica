import type { Dispatch, ReactNode, SetStateAction } from "react";
import { AlertTriangle, Anchor, Calculator, Copy, Download, FileText, Plug, Trash2, Weight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TourDefaultSet, TourDefaultTable } from "@/hooks/useTourDefaultSets";
import { getResolvedPowerPosition } from "@/utils/powerPositions";
import {
  DEPARTMENT_PACKAGE_LABELS,
  TOUR_PACKAGE_LABELS,
  TOUR_PACKAGE_SIZES,
  getPackageSetLabel,
  isPackageDepartment,
  type TourPackageSize,
} from "@/utils/tourPackages";

import {
  getCurrentPerPhase,
  getPowerValue,
  getTableName,
  getWeightValue,
  isLegacyPowerDefault,
  isLegacyWeightDefault,
  isNewFormatTable,
  type CombinedDefaultType,
  type TourDateWithLocation,
} from "./tourDefaultsManagerSupport";

type DefaultType = "power" | "weight";
type PowerFlag = "includes_hoist" | "foh_schuko";

interface TourDepartmentDefaultsProps {
  defaultSets: TourDefaultSet[];
  defaultTables: TourDefaultTable[];
  department: string;
  getDepartmentDefaults: (
    department: string,
    type: DefaultType,
  ) => CombinedDefaultType[];
  getDuplicatePackageWarnings: (
    department: string,
  ) => Array<{ packageSize: TourPackageSize; message: string }>;
  handleBulkPDFExport: (
    department: string,
    type: DefaultType,
    options?: { setId?: string; packageLabel?: string },
  ) => Promise<void>;
  handleBulkTourDateExport: (
    department: string,
    type: DefaultType,
  ) => Promise<void>;
  handleCreateSet: (department: string) => Promise<void>;
  handleDeleteSet: (setId: string) => Promise<void>;
  handleDeleteTable: (
    table: CombinedDefaultType,
    type: DefaultType,
  ) => Promise<void>;
  handleDuplicateSet: (setId: string) => Promise<void>;
  handleTogglePowerFlag: (
    table: TourDefaultTable,
    key: PowerFlag,
    value: boolean,
  ) => Promise<void>;
  isCreatingSet: boolean;
  isDeletingSet: boolean;
  isDeletingTable: boolean;
  isDuplicatingSet: boolean;
  isUpdatingSet: boolean;
  newSetDescription: string;
  newSetName: string;
  newSetPackageSize: TourPackageSize | null;
  pendingFlagTableId: string | null;
  renderSetMetadata: (set: TourDefaultSet) => ReactNode;
  setNewSetDescription: Dispatch<SetStateAction<string>>;
  setNewSetName: Dispatch<SetStateAction<string>>;
  setNewSetPackageSize: Dispatch<SetStateAction<TourPackageSize | null>>;
  tourDates: TourDateWithLocation[];
}

export function TourDepartmentDefaults({
  defaultSets,
  defaultTables,
  department,
  getDepartmentDefaults,
  getDuplicatePackageWarnings,
  handleBulkPDFExport,
  handleBulkTourDateExport,
  handleCreateSet,
  handleDeleteSet,
  handleDeleteTable,
  handleDuplicateSet,
  handleTogglePowerFlag,
  isCreatingSet,
  isDeletingSet,
  isDeletingTable,
  isDuplicatingSet,
  isUpdatingSet,
  newSetDescription,
  newSetName,
  newSetPackageSize,
  pendingFlagTableId,
  renderSetMetadata,
  setNewSetDescription,
  setNewSetName,
  setNewSetPackageSize,
  tourDates,
}: TourDepartmentDefaultsProps) {
    const powerTables = getDepartmentDefaults(department, 'power');
    const weightTables = getDepartmentDefaults(department, 'weight');
    const duplicateWarnings = getDuplicatePackageWarnings(department);
    // FOH schuko power only applies to sound & lights (matches the Consumos tool).
    const fohSupported = department === 'sound' || department === 'lights';

    // Group new format tables by sets
    const departmentSets = defaultSets.filter(set => set.department === department);
    const powerSets = departmentSets;
    const weightSets = departmentSets;

    return (
      <div className="space-y-6">
        {isPackageDepartment(department) && (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold">Crear conjunto de paquete</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor={`${department}-new-set-name`}>Nombre</Label>
                <Input
                  id={`${department}-new-set-name`}
                  value={newSetName}
                  onChange={(event) => setNewSetName(event.target.value)}
                  placeholder={`${DEPARTMENT_PACKAGE_LABELS[department]} package`}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor={`${department}-new-set-description`}>Descripción</Label>
                <Input
                  id={`${department}-new-set-description`}
                  value={newSetDescription}
                  onChange={(event) => setNewSetDescription(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Package size</Label>
                <Select
                  value={newSetPackageSize || 'unassigned'}
                  onValueChange={(value) =>
                    setNewSetPackageSize(value === 'unassigned' ? null : (value as TourPackageSize))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Package size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {TOUR_PACKAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {TOUR_PACKAGE_LABELS[size]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => handleCreateSet(department)}
                  disabled={isCreatingSet}
                  className="w-full"
                >
                  Crear conjunto
                </Button>
              </div>
            </div>
          </div>
        )}

        {duplicateWarnings.map((warning) => (
          <div
            key={warning.packageSize}
            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{warning.message}</span>
          </div>
        ))}

        {/* Power Defaults */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Valores por Defecto de Potencia ({powerTables.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkPDFExport(department, 'power')}
                disabled={powerTables.length === 0}
              >
                <FileText className="h-4 w-4 mr-1" />
                Exportar PDF de Valores
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkTourDateExport(department, 'power')}
                disabled={powerTables.length === 0 || tourDates.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                PDFs Masivos de Fechas
              </Button>
            </div>
          </div>

          {/* New Format Sets */}
          {powerSets.map((set) => {
            const setTables = defaultTables.filter(table =>
              table.set_id === set.id && table.table_type === 'power'
            );

            return (
              <div key={set.id} className="mb-6 border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  {renderSetMetadata(set)}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleBulkPDFExport(department, 'power', {
                          setId: set.id,
                          packageLabel: isPackageDepartment(department)
                            ? getPackageSetLabel(department, set.package_size || null, set)
                            : set.name,
                        })
                      }
                      disabled={setTables.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateSet(set.id)}
                      disabled={isDuplicatingSet}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSet(set.id)}
                      disabled={isDeletingSet || isUpdatingSet}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  {setTables.length} tabla{setTables.length === 1 ? '' : 's'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {setTables.map((table) => {
                    const position = getResolvedPowerPosition(
                      table.metadata?.position,
                      table.metadata?.custom_position,
                    );
                    const rowPending =
                      pendingFlagTableId === table.id ||
                      pendingFlagTableId === `foh_schuko:${table.set_id}`;
                    return (
                    <div key={table.id} className="border rounded-lg p-4 bg-card transition-colors hover:border-primary/40">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="min-w-0">
                          <h6 className="font-medium leading-tight">{table.table_name}</h6>
                          {(table.metadata?.includes_hoist || table.metadata?.foh_schuko) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {table.metadata?.includes_hoist && (
                                <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5 border-amber-300 text-amber-700">
                                  <Anchor className="h-2.5 w-2.5" />
                                  Hoist
                                </Badge>
                              )}
                              {table.metadata?.foh_schuko && (
                                <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5 border-sky-300 text-sky-700">
                                  <Plug className="h-2.5 w-2.5" />
                                  FOH
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTable(table, 'power')}
                          disabled={isDeletingTable}
                          className="text-destructive hover:text-destructive shrink-0 -mt-1 -mr-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="font-mono">
                          {table.total_value.toFixed(2)} W
                        </Badge>
                        {table.metadata?.current_per_phase && (
                          <Badge variant="secondary" className="font-mono">
                            {table.metadata.current_per_phase.toFixed(2)} A/fase
                          </Badge>
                        )}
                        {position && <Badge variant="outline">{position}</Badge>}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`hoist-${table.id}`}
                            checked={Boolean(table.metadata?.includes_hoist)}
                            disabled={rowPending}
                            onCheckedChange={(checked) =>
                              void handleTogglePowerFlag(table, 'includes_hoist', !!checked)
                            }
                          />
                          <Label
                            htmlFor={`hoist-${table.id}`}
                            className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                          >
                            <Anchor className="h-3 w-3 text-muted-foreground" />
                            Incluye hoist/rigging
                          </Label>
                        </div>
                        {fohSupported && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`foh-${table.id}`}
                              checked={Boolean(table.metadata?.foh_schuko)}
                              disabled={rowPending}
                              onCheckedChange={(checked) =>
                                void handleTogglePowerFlag(table, 'foh_schuko', !!checked)
                              }
                            />
                            <Label
                              htmlFor={`foh-${table.id}`}
                              className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                              title="Se requiere potencia de 16A en formato schuko hembra en posición FoH"
                            >
                              <Plug className="h-3 w-3 text-muted-foreground" />
                              FOH (schuko 16A)
                            </Label>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legacy Format Tables */}
          {powerTables.filter(table => !isNewFormatTable(table)).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {powerTables.filter(table => !isNewFormatTable(table)).map((table) => (
                <div key={table.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium">{getTableName(table)}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTable(table, 'power')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getPowerValue(table).toFixed(2)} W
                  </p>
                  {getCurrentPerPhase(table) && (
                    <p className="text-xs text-muted-foreground">
                      {getCurrentPerPhase(table)!.toFixed(2)} A por fase
                    </p>
                  )}
                  {isLegacyPowerDefault(table) &&
                    getResolvedPowerPosition(table.position, table.custom_position) && (
                      <p className="text-xs text-muted-foreground">
                        Posición: {getResolvedPowerPosition(table.position, table.custom_position)}
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}

          {powerTables.length === 0 && (
            <p className="text-muted-foreground">No hay valores por defecto de potencia configurados</p>
          )}
        </div>

        {/* Weight Defaults */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Weight className="h-5 w-5" />
              Valores por Defecto de Peso ({weightTables.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkPDFExport(department, 'weight')}
                disabled={weightTables.length === 0}
              >
                <FileText className="h-4 w-4 mr-1" />
                Exportar PDF de Valores
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkTourDateExport(department, 'weight')}
                disabled={weightTables.length === 0 || tourDates.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                PDFs Masivos de Fechas
              </Button>
            </div>
          </div>

          {/* New Format Sets */}
          {weightSets.map((set) => {
            const setTables = defaultTables.filter(table =>
              table.set_id === set.id && table.table_type === 'weight'
            );

            return (
              <div key={set.id} className="mb-6 border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  {renderSetMetadata(set)}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleBulkPDFExport(department, 'weight', {
                          setId: set.id,
                          packageLabel: isPackageDepartment(department)
                            ? getPackageSetLabel(department, set.package_size || null, set)
                            : set.name,
                        })
                      }
                      disabled={setTables.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateSet(set.id)}
                      disabled={isDuplicatingSet}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSet(set.id)}
                      disabled={isDeletingSet || isUpdatingSet}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  {setTables.length} tabla{setTables.length === 1 ? '' : 's'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {setTables.map((table) => (
                    <div key={table.id} className="border rounded-lg p-4 bg-card transition-colors hover:border-primary/40">
                      <div className="flex justify-between items-start mb-2">
                        <h6 className="font-medium">{table.table_name}</h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTable(table, 'weight')}
                          disabled={isDeletingTable}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {table.total_value.toFixed(2)} kg
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Legacy Format Tables */}
          {weightTables.filter(table => !isNewFormatTable(table)).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weightTables.filter(table => !isNewFormatTable(table)).map((table) => (
                <div key={table.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium">{getTableName(table)}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTable(table, 'weight')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getWeightValue(table).toFixed(2)} kg
                  </p>
                  {isLegacyWeightDefault(table) && table.quantity && table.weight_kg && (
                    <p className="text-xs text-muted-foreground">
                      {table.quantity} × {table.weight_kg.toFixed(2)} kg
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {weightTables.length === 0 && (
            <p className="text-muted-foreground">No hay valores por defecto de peso configurados</p>
          )}
        </div>
      </div>
    );
}
