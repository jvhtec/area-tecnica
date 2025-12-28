import React from "react";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCard } from "./TableCard";

export interface PesosToolViewProps {
  handleBackNavigation: () => void;
  handleExportPDF: () => void;
  isTourDefaults: boolean;
  tourName: string;
  isDefaults: boolean;
  isTourDateContext: boolean;
  tourDateInfo: { date: string; location: string } | null;
  isTourContext: boolean;
  isJobOverrideMode: boolean;
  jobTourInfo: { tourName: string; date: string; location: string } | null;
  tables: any[];
  currentSetName: string;
  setCurrentSetName: (value: string) => void;
  jobIdFromUrl: string | null;
  selectedJobId: string;
  handleJobSelect: (jobId: string) => void;
  jobs?: any[];
  tableName: string;
  setTableName: (value: string) => void;
  useDualMotors: boolean;
  setUseDualMotors: (value: boolean) => void;
  mirroredCluster: boolean;
  setMirroredCluster: (value: boolean) => void;
  cablePick: boolean;
  setCablePick: (value: boolean) => void;
  cablePickWeight: string;
  setCablePickWeight: (value: string) => void;
  soundComponentDatabase: Array<{ id: number; name: string; weight: number }>;
  currentTable: any;
  updateInput: (index: number, field: string, value: string) => void;
  removeRow: (index: number) => void;
  addRow: () => void;
  generateTable: () => void;
  resetCurrentTable: () => void;
  defaultSets: any[];
  defaultTables: any[];
  deleteSet: (id: string) => void;
  weightOverrides: any[];
  deleteOverride: (args: { id: string; table: string }) => void;
  saveAsDefaultSet: () => void;
  removeTable: (id: number) => void;
}

export const PesosToolView: React.FC<PesosToolViewProps> = ({
  handleBackNavigation,
  handleExportPDF,
  isTourDefaults,
  tourName,
  isDefaults,
  isTourDateContext,
  tourDateInfo,
  isTourContext,
  isJobOverrideMode,
  jobTourInfo,
  tables,
  currentSetName,
  setCurrentSetName,
  jobIdFromUrl,
  selectedJobId,
  handleJobSelect,
  jobs,
  tableName,
  setTableName,
  useDualMotors,
  setUseDualMotors,
  mirroredCluster,
  setMirroredCluster,
  cablePick,
  setCablePick,
  cablePickWeight,
  setCablePickWeight,
  soundComponentDatabase,
  currentTable,
  updateInput,
  removeRow,
  addRow,
  generateTable,
  resetCurrentTable,
  defaultSets,
  defaultTables,
  deleteSet,
  weightOverrides,
  deleteOverride,
  saveAsDefaultSet,
  removeTable,
}) => {
  return (
    <div className="w-full p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackNavigation} aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Weight Calculator</h1>
              {/* Tour defaults mode indicator */}
              {isTourDefaults && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Tour Defaults Mode
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Creating defaults for: <span className="font-medium">{tourName}</span>
                  </p>
                </div>
              )}
              {isDefaults && !isTourDefaults && (
                <p className="text-sm text-muted-foreground mt-1">
                  Managing defaults for: <span className="font-medium">{tourName}</span>
                </p>
              )}
              {isTourDateContext && tourDateInfo && (
                <div className="text-sm text-muted-foreground mt-1">
                  <p>Creating overrides for tour date</p>
                  <p className="font-medium">
                    {tourDateInfo.date} - {tourDateInfo.location}
                  </p>
                </div>
              )}
              {isTourContext && !isDefaults && !isTourDateContext && !isTourDefaults && (
                <p className="text-sm text-muted-foreground mt-1">
                  Creating weight requirements for tour: <span className="font-medium">{tourName}</span>
                </p>
              )}
              {isJobOverrideMode && jobTourInfo && (
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Badge variant="secondary">Override Mode</Badge>
                  <p>
                    Tour: {jobTourInfo.tourName} • {jobTourInfo.date} - {jobTourInfo.location}
                  </p>
                </div>
              )}
            </div>
          </div>
          {tables.length > 0 && !isDefaults && !isTourContext && !isTourDefaults && (
            <Button onClick={handleExportPDF} variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Export & Upload PDF
            </Button>
          )}
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inputs & Builder */}
        <div className="lg:col-span-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Job-based override notification */}
                {isJobOverrideMode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm font-medium text-blue-900">Job Override Mode Active</p>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      This job is part of a tour. Any tables you create will be saved as overrides for the specific tour
                      date.
                    </p>
                  </div>
                )}

                {/* Tour defaults mode notification */}
                {isTourDefaults && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm font-medium text-green-900">Tour Defaults Mode Active</p>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      Any tables you create will be saved as global defaults for this tour. These defaults will apply to
                      all tour dates unless specifically overridden.
                    </p>
                  </div>
                )}

                {/* Tour date override notification */}
                {isTourDateContext && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm font-medium text-blue-900">Override Mode Active</p>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      Any tables you create will be saved as overrides for this specific tour date.
                    </p>
                  </div>
                )}

                {isDefaults && !isTourDefaults && (
                  <div className="space-y-2">
                    <Label htmlFor="setName">Default Set Name</Label>
                    <Input
                      id="setName"
                      value={currentSetName}
                      onChange={(e) => setCurrentSetName(e.target.value)}
                      placeholder="Enter set name (e.g., 'Main Stage Rigging')"
                    />
                  </div>
                )}

                {/* Hide job selection when coming from card (jobId in URL), or in tour defaults mode */}
                {!isTourContext && !isTourDefaults && !jobIdFromUrl && (
                  <div className="space-y-2">
                    <Label htmlFor="jobSelect">Select Job</Label>
                    <Select value={selectedJobId} onValueChange={handleJobSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs?.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tableName">{isDefaults || isTourDefaults ? "Weight Default Name" : "Table Name"}</Label>
                  <Input
                    id="tableName"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder={isDefaults || isTourDefaults ? "Enter default name (e.g., K2 Array)" : "Enter table name"}
                  />
                  {/* UPDATED: Enable advanced features in tour defaults mode */}
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="dualMotors"
                      checked={useDualMotors}
                      onCheckedChange={(checked) => setUseDualMotors(checked as boolean)}
                    />
                    <Label htmlFor="dualMotors" className="text-sm font-medium">
                      Dual Motors Configuration
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="mirroredCluster"
                      checked={mirroredCluster}
                      onCheckedChange={(checked) => setMirroredCluster(checked as boolean)}
                    />
                    <Label htmlFor="mirroredCluster" className="text-sm font-medium">
                      Mirrored Cluster
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="cablePick"
                      checked={cablePick}
                      onCheckedChange={(checked) => setCablePick(checked as boolean)}
                    />
                    <Label htmlFor="cablePick" className="text-sm font-medium">
                      Cable Pick
                    </Label>
                    {cablePick && (
                      <Select value={cablePickWeight} onValueChange={(value) => setCablePickWeight(value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Select weight" />
                        </SelectTrigger>
                        <SelectContent>
                          {["100", "200", "300", "400", "500"].map((w) => (
                            <SelectItem key={w} value={w}>
                              {w} kg
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Quantity</th>
                        <th className="px-4 py-3 text-left font-medium">Component</th>
                        <th className="px-4 py-3 text-left font-medium">Weight (per unit)</th>
                        <th className="w-12 px-4 py-3 text-left font-medium">&nbsp;</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentTable?.rows ?? []).map((row: any, index: number) => (
                        <tr key={row.id ?? index} className="border-t">
                          <td className="p-4">
                            <Input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => updateInput(index, "quantity", e.target.value)}
                              min="0"
                              className="w-full"
                            />
                          </td>
                          <td className="p-4">
                            <Select value={row.componentId} onValueChange={(value) => updateInput(index, "componentId", value)}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select component" />
                              </SelectTrigger>
                              <SelectContent>
                                {soundComponentDatabase.map((component) => (
                                  <SelectItem key={component.id} value={component.id.toString()}>
                                    {component.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-4">
                            <Input type="number" value={row.weight} readOnly className="w-full bg-muted" />
                          </td>
                          <td className="p-4">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRow(index)}
                              className="text-destructive hover:text-destructive"
                              aria-label="Delete row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2">
                  <Button onClick={addRow}>Add Row</Button>
                  <Button onClick={generateTable} variant="secondary">
                    {isDefaults ? "Save Default" : isTourDefaults ? "Save Tour Default" : "Generate Table"}
                  </Button>
                  <Button onClick={resetCurrentTable} variant="destructive">
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Results Column 1 */}
        <div className="lg:col-span-4">
          <div className="space-y-6">
            {/* Display existing default sets */}
            {isDefaults && defaultSets.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Existing Default Sets</h3>
                {defaultSets.map((set) => {
                  const setTables = defaultTables.filter((dt: any) => dt.set_id === set.id && dt.table_type === "weight");
                  return (
                    <div key={set.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{set.name}</h4>
                        <Button variant="destructive" size="sm" onClick={() => deleteSet(set.id)}>
                          Delete Set
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {set.description} • {setTables.length} tables
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {setTables.map((table: any) => (
                          <div key={table.id} className="text-sm border rounded p-2">
                            <div className="font-medium">{table.table_name}</div>
                            <div className="text-muted-foreground">{table.total_value.toFixed(2)} kg</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Display existing overrides for tour dates */}
            {isTourDateContext && weightOverrides.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Existing Overrides for This Date</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {weightOverrides.map((override: any) => (
                    <div key={override.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{override.item_name}</h4>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteOverride({ id: override.id, table: "weight" })}
                        >
                          Delete
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{((override.weight_kg ?? 0) * (override.quantity ?? 0)).toFixed(2)} kg</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table display with save as default option - First half */}
            {tables.slice(0, Math.ceil(tables.length / 2)).map((table: any) => (
              <TableCard
                key={table.id}
                table={table}
                isTourDefaults={isTourDefaults}
                isDefaults={isDefaults}
                isTourContext={isTourContext}
                saveAsDefaultSet={saveAsDefaultSet}
                removeTable={removeTable}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Results Column 2 */}
        <div className="lg:col-span-4">
          <div className="space-y-6">
            {/* Table display - Second half */}
            {tables.slice(Math.ceil(tables.length / 2)).map((table: any) => (
              <TableCard
                key={table.id}
                table={table}
                isTourDefaults={isTourDefaults}
                isDefaults={isDefaults}
                isTourContext={isTourContext}
                saveAsDefaultSet={saveAsDefaultSet}
                removeTable={removeTable}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
