import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Edit, FileText, Trash2 } from "lucide-react";
import { TourOverrideModeHeader } from "@/components/tours/TourOverrideModeHeader";
import { TechnicalStageSelector } from "@/features/technical-tools/stage/stageAllocation";
import {
  CUSTOM_POWER_POSITION_VALUE,
  NO_POWER_POSITION_VALUE,
  POWER_POSITION_PRESETS,
} from "@/utils/powerPositions";
import type { PowerTable } from "@/features/technical-tools/power/types";
import { FIXTURE_PF, type ConsumosDepartmentConfig, type FixtureType } from "./config";
import { useConsumosTool } from "./useConsumosTool";
import { CustomComponentDialog } from "./CustomComponentDialog";
import { PowerStagePlot } from "@/features/technical-tools/power/consumos/PowerStagePlot";
import { CopyToStageMenu } from "@/features/technical-tools/table-presets/CopyToStageMenu";
import { QuickPresetsMenu } from "@/features/technical-tools/table-presets/QuickPresetsMenu";
import { GeneratedPowerTableCard } from "./GeneratedPowerTableCard";
import {
  TOUR_PACKAGE_LABELS,
  TOUR_PACKAGE_SIZES,
  type TourPackageSize,
} from "@/utils/tourPackages";

const PowerTableSummary: React.FC<{
  table: PowerTable;
  labels: ConsumosDepartmentConfig["labels"];
  phaseMode: "single" | "three";
  showPosition?: boolean;
}> = ({ table, labels, phaseMode, showPosition = true }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
    <div>
      {labels.totalWattsLabel} <span className="font-medium">{table.totalWatts?.toFixed(2)} W</span>
    </div>
    <div>
      {labels.apparentPower}{" "}
      <span className="font-medium">
        {((table.totalVa || table.totalWatts || 0) / 1000).toFixed(2)} kVA
      </span>
    </div>
    <div>
      {phaseMode === "three" ? labels.currentPerPhase : labels.current}{" "}
      <span className="font-medium">{table.currentPerPhase?.toFixed(2)} A</span>
    </div>
    <div>
      {labels.pduTypeLabel}{" "}
      <span className="font-medium">{table.customPduType || table.pduType}</span>
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

export const ConsumosToolPage: React.FC<{ config: ConsumosDepartmentConfig }> = ({
  config,
}) => {
  const state = useConsumosTool(config);
  const { labels, features } = config;
  const {
    navigate,
    jobs,
    jobIdFromUrl,
    selectedJobId,
    handleJobSelect,
    isTourDefaults,
    isOverrideMode,
    isUrlOverrideMode,
    isNormalMode,
    overrideLoading,
    overrideData,
    isCreatingOverride,
    defaultSets,
    selectedDefaultSetId,
    setSelectedDefaultSetId,
    selectedDefaultPackageSize,
    setSelectedDefaultPackageSize,
    newDefaultSetName,
    setNewDefaultSetName,
    tourName,
    tourInfo,
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    jobStages,
    safetyMargin,
    setSafetyMargin,
    phaseMode,
    setPhaseMode,
    voltage,
    setVoltage,
    pf,
    setPf,
    fohSchukoRequired,
    setFohSchukoRequired,
    pduOptions,
    tableName,
    setTableName,
    currentRows,
    components,
    addRow,
    removeRow,
    updateInput,
    addComponentToRow,
    selectedPosition,
    setSelectedPosition,
    customPosition,
    setCustomPosition,
    editing,
    tables,
    activeTables,
    loadedSavedCount,
    generateTable,
    resetCurrentTable,
    removeTable,
    updateTableSettings,
    startEditingTable,
    startEditingOverride,
    saveTourDefault,
    saveDefaultTables,
    handleDeleteOverride,
    tourDefaultDisplayTables,
    readOnlyDefaultTables,
    overrideDisplayTables,
    handleExportPDF,
    exportDisplayTables,
    exportTablesCount,
    movablePlotTableIds,
    moveTableToPosition,
    quickPresets,
    isSavingPreset,
    copyTableToStage,
    copyActiveSetToStage,
    saveActiveSetAsPreset,
    applyQuickPreset,
    removeQuickPreset,
  } = state;

  if (overrideLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto my-6">
        <CardContent className="pt-6">
          <p>{labels.loadingOverrideData}</p>
        </CardContent>
      </Card>
    );
  }

  const generateButtonLabel =
    editing?.kind === "override"
      ? labels.updateOverride
      : editing?.kind === "table"
        ? labels.updateTable
        : isOverrideMode && !isTourDefaults
          ? labels.createOverride
          : labels.generateTable;

  const firstColumnTables = activeTables.slice(0, Math.ceil(activeTables.length / 2));
  const secondColumnTables = activeTables.slice(Math.ceil(activeTables.length / 2));

  const renderGeneratedTable = (table: PowerTable) => (
    <GeneratedPowerTableCard
      key={table.id}
      table={table}
      labels={labels}
      pduTypes={pduOptions}
      phaseMode={phaseMode}
      showLineName={features.lineName}
      showRowPf={features.perRowPf}
      showSaveDefault={isTourDefaults && !table.isDefault}
      isOverrideContext={isOverrideMode && !isTourDefaults}
      copyStages={isNormalMode ? jobStages : undefined}
      onCopyToStage={
        isNormalMode
          ? (stage) => copyTableToStage(table.id as number | string, stage)
          : undefined
      }
      onEdit={() => startEditingTable(table)}
      onRemove={() => removeTable(table.id as number | string)}
      onSaveDefault={() => saveTourDefault(table)}
      onUpdateSettings={(patch) => updateTableSettings(table.id as number | string, patch)}
    />
  );

  return (
    <div className="w-full p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(config.backPath)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{labels.title}</h1>
              {isTourDefaults && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {labels.tourDefaultsBadge}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {labels.creatingDefaultsFor} <span className="font-medium">{tourName}</span>
                  </p>
                </div>
              )}
              {isOverrideMode && !isTourDefaults && tourInfo && (
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Badge variant="secondary">{labels.overrideBadge}</Badge>
                  <p>
                    {tourInfo.tourName} • {tourInfo.tourDate} - {tourInfo.locationName}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isNormalMode && jobStages.length > 1 && activeTables.length > 0 && (
              <CopyToStageMenu
                label={labels.copySetToStage}
                stages={jobStages}
                excludeStageNumber={selectedStage?.number ?? null}
                onCopy={copyActiveSetToStage}
              />
            )}
            {isNormalMode && (
              <QuickPresetsMenu
                labels={labels.quickPresets}
                presets={quickPresets}
                canSaveCurrent={activeTables.length > 0}
                isSaving={isSavingPreset}
                onApply={applyQuickPreset}
                onDelete={removeQuickPreset}
                onSaveCurrent={saveActiveSetAsPreset}
              />
            )}
            {exportTablesCount > 0 && (
              <Button onClick={handleExportPDF} variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                {isTourDefaults || isUrlOverrideMode ? labels.exportPdf : labels.exportUploadPdf}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stage plot with the chosen PDU positions; tables can be dragged
          between zones to reposition them */}
      <PowerStagePlot
        tables={exportDisplayTables}
        labels={labels}
        fohSchukoRequired={features.fohSchuko && fohSchukoRequired}
        movableIds={movablePlotTableIds}
        onMoveTable={moveTableToPosition}
      />

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inputs & Builder */}
        <div className="lg:col-span-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {isUrlOverrideMode && overrideData && (
                  <TourOverrideModeHeader
                    tourName={overrideData.tourName}
                    tourDate={overrideData.tourDate}
                    locationName={overrideData.locationName}
                    defaultsCount={readOnlyDefaultTables.length}
                    overridesCount={overrideDisplayTables.length}
                    department={config.department}
                  />
                )}

                {isOverrideMode && !isTourDefaults && !isUrlOverrideMode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm font-medium text-blue-900">
                        {labels.overrideNoticeTitle}
                      </p>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">{labels.overrideNoticeBody}</p>
                  </div>
                )}

                {isTourDefaults && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm font-medium text-green-900">
                        {labels.tourDefaultsNoticeTitle}
                      </p>
                    </div>
                    <p className="text-sm text-green-700 mt-1">{labels.tourDefaultsNoticeBody}</p>
                  </div>
                )}

                {isNormalMode && loadedSavedCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      {labels.savedSetLoaded(loadedSavedCount)}
                    </p>
                  </div>
                )}

                {features.fohSchuko && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="foh-schuko"
                      checked={fohSchukoRequired}
                      onCheckedChange={(checked) => setFohSchukoRequired(!!checked)}
                    />
                    <Label htmlFor="foh-schuko">{labels.fohSchuko}</Label>
                  </div>
                )}

                {isTourDefaults && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <h3 className="text-sm font-semibold">Conjunto por defecto</h3>
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
                          <SelectItem value="new">Crear conjunto</SelectItem>
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
                  </div>
                )}

                {/* Supply / Voltage / PF controls */}
                <div
                  className={`grid grid-cols-1 ${features.perRowPf ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4`}
                >
                  <div className="space-y-2">
                    <Label>{labels.supply}</Label>
                    <Select
                      value={phaseMode}
                      onValueChange={(value) => setPhaseMode(value as "single" | "three")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={labels.supplyPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">{labels.singlePhase}</SelectItem>
                        <SelectItem value="three">{labels.threePhase}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{labels.voltage}</Label>
                    <Input
                      type="number"
                      value={voltage}
                      onChange={(event) => setVoltage(Number(event.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">{labels.voltageHint}</p>
                  </div>
                  {!features.perRowPf && (
                    <div className="space-y-2">
                      <Label>{labels.powerFactor}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="1"
                        value={pf}
                        onChange={(event) =>
                          setPf(
                            Math.max(0.1, Math.min(1, Number(event.target.value) || 0.9)),
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">{labels.powerFactorHint}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="safetyMargin">{labels.safetyMargin}</Label>
                  <Select
                    value={safetyMargin.toString()}
                    onValueChange={(value) => setSafetyMargin(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={labels.safetyMarginPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 10, 20, 30, 40, 50].map((percentage) => (
                        <SelectItem key={percentage} value={percentage.toString()}>
                          {percentage}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {features.perRowPf && (
                  <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-3 text-sm">
                    <p className="font-medium text-foreground">{labels.pfInfoTitle}</p>
                    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-muted-foreground">
                      {Object.entries(FIXTURE_PF).map(([key, data]) => (
                        <li key={key}>
                          {data.label}: {data.pf.toFixed(2)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted-foreground">{labels.pfInfoFootnote}</p>
                  </div>
                )}

                {/* Hide job selection when coming from card (jobId in URL), or in tour modes */}
                {isNormalMode && !jobIdFromUrl && (
                  <div className="space-y-2">
                    <Label htmlFor="jobSelect">{labels.selectJob}</Label>
                    <Select value={selectedJobId} onValueChange={handleJobSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder={labels.selectJobPlaceholder} />
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

                {isNormalMode && (
                  <TechnicalStageSelector
                    label={labels.stage}
                    selectedStageNumber={selectedStageNumber}
                    stages={jobStages}
                    onChange={setSelectedStageNumber}
                  />
                )}

                {/* Existing tour defaults */}
                {isTourDefaults && tourDefaultDisplayTables.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-900">
                      {labels.existingDefaultsHeading}
                    </h3>
                    {tourDefaultDisplayTables.map((table) => (
                      <div
                        key={table.id}
                        className="border rounded-lg overflow-hidden bg-blue-50/30"
                      >
                        <div className="bg-blue-100 px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-blue-900">{table.name}</h4>
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              {labels.defaultBadge}
                            </Badge>
                          </div>
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
                                  includes_hoist: table.includesHoist,
                                  override_data: { rows: table.rows },
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

                <div className="space-y-2">
                  <Label htmlFor="tableName">
                    {isTourDefaults ? labels.defaultName : labels.tableName}{" "}
                    {editing && (
                      <span className="text-orange-600">
                        {editing.kind === "override"
                          ? labels.editingOverrideSuffix
                          : labels.editingTableSuffix}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="tableName"
                    value={tableName}
                    onChange={(event) => setTableName(event.target.value)}
                    placeholder={
                      isTourDefaults ? labels.defaultNamePlaceholder : labels.tableNamePlaceholder
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{labels.position}</Label>
                    <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                      <SelectTrigger>
                        <SelectValue placeholder={labels.noPosition} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_POWER_POSITION_VALUE}>{labels.noPosition}</SelectItem>
                        {POWER_POSITION_PRESETS.map((position) => (
                          <SelectItem key={position} value={position}>
                            {position}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_POWER_POSITION_VALUE}>
                          {labels.customOption}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedPosition === CUSTOM_POWER_POSITION_VALUE && (
                    <div className="space-y-2">
                      <Label>{labels.customPosition}</Label>
                      <Input
                        value={customPosition}
                        onChange={(event) => setCustomPosition(event.target.value)}
                        placeholder={labels.customPositionPlaceholder}
                      />
                    </div>
                  )}
                </div>

                {/* Builder rows */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-sm">
                            {labels.colQuantity}
                          </th>
                          {features.lineName && (
                            <th className="px-4 py-3 text-left font-medium text-sm">
                              {labels.colLineName}
                            </th>
                          )}
                          <th className="px-4 py-3 text-left font-medium text-sm">
                            {labels.colComponent}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-sm">
                            {labels.colWatts}
                          </th>
                          {features.perRowPf && (
                            <th className="px-4 py-3 text-left font-medium text-sm">
                              {labels.colPf}
                            </th>
                          )}
                          <th className="w-12 px-4 py-3 text-left font-medium text-sm">&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentRows.map((row, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-4">
                              <Input
                                type="number"
                                value={row.quantity}
                                onChange={(event) =>
                                  updateInput(index, "quantity", event.target.value)
                                }
                                min="0"
                                className="w-full min-w-[100px]"
                              />
                            </td>
                            {features.lineName && (
                              <td className="p-4">
                                <Input
                                  value={row.lineName || ""}
                                  onChange={(event) =>
                                    updateInput(index, "lineName", event.target.value)
                                  }
                                  placeholder={labels.lineNamePlaceholder}
                                  className="w-full min-w-[120px]"
                                />
                              </td>
                            )}
                            <td className="p-4">
                              <div className="flex min-w-[220px] items-center gap-2">
                                <CustomComponentDialog
                                  labels={labels}
                                  showFixtureType={features.perRowPf}
                                  onCreate={(input) => addComponentToRow(index, input)}
                                />
                                <Select
                                  value={row.componentId || undefined}
                                  onValueChange={(componentId) =>
                                    updateInput(index, "componentId", componentId)
                                  }
                                >
                                  <SelectTrigger className="min-w-0 flex-1">
                                    <SelectValue placeholder={labels.componentPlaceholder} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {components.map((component) => (
                                      <SelectItem
                                        key={component.id}
                                        value={component.id.toString()}
                                      >
                                        {component.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </td>
                            <td className="p-4">
                              <Input
                                type="number"
                                value={row.watts}
                                readOnly
                                className="w-full min-w-[100px] bg-muted"
                              />
                            </td>
                            {features.perRowPf && (
                              <td className="p-4">
                                <div className="space-y-2">
                                  <Select
                                    value={row.fixtureType || "led"}
                                    onValueChange={(value) =>
                                      updateInput(index, "fixtureType", value)
                                    }
                                  >
                                    <SelectTrigger className="w-full min-w-[160px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(
                                        Object.entries(FIXTURE_PF) as [
                                          FixtureType,
                                          { label: string; pf: number },
                                        ][]
                                      ).map(([key, data]) => (
                                        <SelectItem key={key} value={key}>
                                          {data.label} ({data.pf.toFixed(2)})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                    max="1"
                                    value={row.pf || ""}
                                    onChange={(event) =>
                                      updateInput(index, "pf", event.target.value)
                                    }
                                    placeholder="PF"
                                  />
                                </div>
                              </td>
                            )}
                            <td className="p-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRow(index)}
                                className="text-destructive hover:text-destructive"
                                aria-label={labels.deleteRowAria}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={addRow}>{labels.addRow}</Button>
                  <Button
                    onClick={generateTable}
                    variant="secondary"
                    disabled={isOverrideMode && !isTourDefaults && isCreatingOverride}
                  >
                    {generateButtonLabel}
                  </Button>
                  <Button onClick={resetCurrentTable} variant="destructive">
                    {editing ? labels.cancelEdit : labels.reset}
                  </Button>
                  {isTourDefaults &&
                    tables.some((table) => !table.isDefault && !table.defaultTableId) && (
                      <Button
                        onClick={saveDefaultTables}
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {labels.saveDefaultTables}
                      </Button>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Results Column 1 */}
        <div className="lg:col-span-4">
          <div className="space-y-6">{firstColumnTables.map(renderGeneratedTable)}</div>
        </div>

        {/* Right Column: Results Column 2 */}
        <div className="lg:col-span-4">
          <div className="space-y-6">{secondColumnTables.map(renderGeneratedTable)}</div>
        </div>
      </div>
    </div>
  );
};
