import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PowerTable } from "@/features/technical-tools/power/types";
import {
  CUSTOM_POWER_POSITION_VALUE,
  getPowerPositionCustomValue,
  getPowerPositionSelectValue,
  NO_POWER_POSITION_VALUE,
  POWER_POSITION_PRESETS,
} from "@/utils/powerPositions";

export type PowerTableControlLabels = {
  customPduOption: string;
  customPduPlaceholder: string;
  customPositionOption: string;
  customPositionPlaceholder: string;
  hoistPower: string;
  noPosition: string;
  pduOverride: string;
  pduPlaceholder: string;
  position: string;
  positionPlaceholder: string;
  recommendedPdu: (pduType?: string) => string;
};

export const ENGLISH_POWER_TABLE_CONTROL_LABELS: PowerTableControlLabels = {
  customPduOption: "Custom PDU Type",
  customPduPlaceholder: "Enter custom PDU type",
  customPositionOption: "Custom",
  customPositionPlaceholder: "Enter custom position",
  hoistPower: "Requires additional hoist power (CEE32A 3P+N+G)",
  noPosition: "No position",
  pduOverride: "PDU Type Override:",
  pduPlaceholder: "Use recommended PDU type",
  position: "Position:",
  positionPlaceholder: "No position",
  recommendedPdu: (pduType) => `Use recommended (${pduType || ""})`,
};

export const SPANISH_POWER_TABLE_CONTROL_LABELS: PowerTableControlLabels = {
  customPduOption: "Tipo de PDU personalizado",
  customPduPlaceholder: "Ingrese un tipo de PDU personalizado",
  customPositionOption: "Personalizada",
  customPositionPlaceholder: "Ingrese una posición personalizada",
  hoistPower: "Incluir Potencia para Motor (CEE32A 3P+N+G)",
  noPosition: "Sin posición",
  pduOverride: "Anulación de Tipo de PDU:",
  pduPlaceholder: "Usar PDU sugerido",
  position: "Posición:",
  positionPlaceholder: "Sin posición",
  recommendedPdu: () => "Usar PDU sugerido",
};

type PowerTableControlsProps<Table extends PowerTable> = {
  className?: string;
  customPduSelectValue?: string;
  labels?: PowerTableControlLabels;
  onUpdateSettings: (patch: Partial<Table>) => void;
  pduTypes: string[];
  table: Table;
  tableId?: string | number;
};

export const PowerTableControls = <Table extends PowerTable>({
  className = "",
  customPduSelectValue = "custom",
  labels = ENGLISH_POWER_TABLE_CONTROL_LABELS,
  onUpdateSettings,
  pduTypes,
  table,
  tableId = table.id ?? table.name,
}: PowerTableControlsProps<Table>) => {
  const hasCustomPdu = table.customPduType !== undefined && table.customPduType !== null;
  const pduSelectValue = hasCustomPdu
    ? pduTypes.includes(table.customPduType)
      ? table.customPduType
      : customPduSelectValue
    : "default";

  const positionSelectValue = getPowerPositionSelectValue(table.position, table.customPosition);

  return (
    <div className={`p-4 bg-muted/50 space-y-4 ${className}`.trim()}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`hoist-${tableId}`}
            checked={Boolean(table.includesHoist)}
            onCheckedChange={(checked) => onUpdateSettings({ includesHoist: !!checked } as Partial<Table>)}
          />
          <Label htmlFor={`hoist-${tableId}`} className="text-sm">
            {labels.hoistPower}
          </Label>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <Label className="text-sm whitespace-nowrap">{labels.pduOverride}</Label>
          <Select
            value={pduSelectValue}
            onValueChange={(value) => {
              if (value === "default") {
                onUpdateSettings({ customPduType: undefined } as Partial<Table>);
              } else if (value === customPduSelectValue) {
                onUpdateSettings({ customPduType: "" } as Partial<Table>);
              } else {
                onUpdateSettings({ customPduType: value } as Partial<Table>);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder={labels.pduPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{labels.recommendedPdu(table.pduType)}</SelectItem>
              {pduTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
              <SelectItem value={customPduSelectValue}>{labels.customPduOption}</SelectItem>
            </SelectContent>
          </Select>
          {hasCustomPdu && !pduTypes.includes(table.customPduType || "") && (
            <Input
              placeholder={labels.customPduPlaceholder}
              value={table.customPduType || ""}
              onChange={(event) => onUpdateSettings({ customPduType: event.target.value } as Partial<Table>)}
              className="w-full sm:w-[220px]"
            />
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <Label className="text-sm whitespace-nowrap">{labels.position}</Label>
          <Select
            value={positionSelectValue}
            onValueChange={(value) => {
              if (value === NO_POWER_POSITION_VALUE) {
                onUpdateSettings({ position: undefined, customPosition: undefined } as Partial<Table>);
              } else if (value === CUSTOM_POWER_POSITION_VALUE) {
                onUpdateSettings({ position: undefined, customPosition: "" } as Partial<Table>);
              } else {
                onUpdateSettings({ position: value, customPosition: undefined } as Partial<Table>);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={labels.positionPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_POWER_POSITION_VALUE}>{labels.noPosition}</SelectItem>
              {POWER_POSITION_PRESETS.map((position) => (
                <SelectItem key={position} value={position}>
                  {position}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_POWER_POSITION_VALUE}>{labels.customPositionOption}</SelectItem>
            </SelectContent>
          </Select>
          {positionSelectValue === CUSTOM_POWER_POSITION_VALUE && (
            <Input
              placeholder={labels.customPositionPlaceholder}
              value={getPowerPositionCustomValue(table.position, table.customPosition)}
              onChange={(event) =>
                onUpdateSettings({ position: undefined, customPosition: event.target.value } as Partial<Table>)
              }
              className="w-full sm:w-[180px]"
            />
          )}
        </div>
      </div>
    </div>
  );
};
