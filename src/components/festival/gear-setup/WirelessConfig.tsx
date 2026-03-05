import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Signal } from "lucide-react";
import { WirelessConfigProps } from "@/types/festival-gear";
import { WirelessSetup } from "@/types/festival";
import { EquipmentSelect } from "../form/shared/EquipmentSelect";
import { WIRELESS_SYSTEMS, IEM_SYSTEMS } from "@/types/festival-equipment";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo } from "react";
import {
  coerceBandSelection,
  formatBandOptionLabel,
  formatFrequencyBand,
  getBandOptionsEU,
  isFrequencyBandSelection,
  type FrequencyBandSelection,
} from "@/lib/frequencyBands";

const CUSTOM_BAND_VALUE = "__custom__";

const areBandsEqual = (
  currentBand: WirelessSetup["band"],
  nextBand: WirelessSetup["band"],
): boolean => {
  if (currentBand === nextBand) return true;

  if (!currentBand && !nextBand) return true;

  if (typeof currentBand === "string" || typeof nextBand === "string") {
    return (typeof currentBand === "string" ? currentBand.trim() : "") ===
      (typeof nextBand === "string" ? nextBand.trim() : "");
  }

  if (!isFrequencyBandSelection(currentBand) || !isFrequencyBandSelection(nextBand)) {
    return false;
  }

  return (
    currentBand.code === nextBand.code &&
    currentBand.from_mhz === nextBand.from_mhz &&
    currentBand.to_mhz === nextBand.to_mhz
  );
};

export const WirelessConfig = ({
  systems,
  onChange,
  label,
  includeQuantityTypes = false,
  isIEM = false,
  hideProvidedBy = false,
  festivalAvailableModels = [],
  readOnly = false,
  language = "es",
}: WirelessConfigProps) => {
  const tx = (es: string, en: string) => (language === "en" ? en : es);
  const festivalModelOptions = useMemo(
    () => Array.from(new Set(festivalAvailableModels.map((model) => model.trim()).filter(Boolean))),
    [festivalAvailableModels],
  );
  const category = isIEM ? "iem" : "wireless";

  useEffect(() => {
    if (systems.length === 0) return;

    let hasChanges = false;

    const normalizedSystems = systems.map((system) => {
      let nextSystem = system;

      if (!system._id) {
        nextSystem = { ...nextSystem, _id: crypto.randomUUID() };
        hasChanges = true;
      }

      if (!isIEM && !Number.isFinite(Number(nextSystem.quantity_ch))) {
        nextSystem = { ...nextSystem, quantity_ch: 0 };
        hasChanges = true;
      }

      const coercedBand = coerceBandSelection(category, nextSystem.model || "", nextSystem.band);
      const normalizedBand = coercedBand === undefined ? undefined : coercedBand;

      if (!areBandsEqual(nextSystem.band, normalizedBand)) {
        nextSystem = { ...nextSystem, band: normalizedBand };
        hasChanges = true;
      }

      return nextSystem;
    });

    if (hasChanges) {
      onChange(normalizedSystems);
    }
  }, [category, isIEM, onChange, systems]);

  const addSystem = () => {
    const newSystem: WirelessSetup = {
      _id: crypto.randomUUID(),
      model: "",
      quantity: 0,
      quantity_hh: 0,
      quantity_bp: 0,
      quantity_ch: 0,
      band: undefined,
      provided_by: "festival",
    };
    onChange([...systems, newSystem]);
  };

  const removeSystem = (index: number) => {
    onChange(systems.filter((_, i) => i !== index));
  };

  const updateSystem = (
    index: number,
    field: keyof WirelessSetup,
    value: string | number | FrequencyBandSelection | undefined,
  ) => {
    const updatedSystems = systems.map((system, i) => {
      if (i !== index) return system;

      const updatedSystem = { ...system };

      if (field === "quantity_hh" || field === "quantity_bp" || field === "quantity_ch") {
        const numericValue = typeof value === "string" ? parseInt(value, 10) || 0 : Number(value) || 0;

        if (field === "quantity_ch") {
          updatedSystem.quantity_ch = numericValue;
        } else {
          updatedSystem[field] = numericValue;
        }

        if (isIEM) {
          if (field === "quantity_hh") {
            updatedSystem.quantity = numericValue;
          }
        } else {
          updatedSystem.quantity = (updatedSystem.quantity_hh || 0) + (updatedSystem.quantity_bp || 0);
        }
      } else if (field === "provided_by") {
        if (value === "festival" || value === "band") {
          updatedSystem.provided_by = value;
        } else {
          updatedSystem.provided_by = "festival";
        }
      } else if (field === "model") {
        updatedSystem.model = typeof value === "string" ? value : "";
        updatedSystem.band = coerceBandSelection(category, updatedSystem.model, updatedSystem.band);
      } else if (field === "band") {
        updatedSystem.band = value as WirelessSetup["band"];
      } else {
        updatedSystem[field as "model" | "notes"] = value as string;
      }

      return updatedSystem;
    });

    onChange(updatedSystems);
  };

  const options = isIEM ? IEM_SYSTEMS : WIRELESS_SYSTEMS;
  const quantityTypeLabels = isIEM
    ? {
        hh: tx("Canales", "Channels"),
        bp: tx("Petacas", "Bodypacks"),
      }
    : {
        hh: tx("De Mano", "Handheld"),
        bp: tx("Petacas", "Bodypacks"),
        ch: tx("Canales", "Channels"),
      };

  const getCategory = () => {
    return isIEM ? "iem" : "wireless";
  };

  const getBandSelectValue = (system: WirelessSetup): string | undefined => {
    const modelOptions = getBandOptionsEU(category, system.model || "");

    if (!system.band) {
      return undefined;
    }

    if (isFrequencyBandSelection(system.band)) {
      const isModelOption = modelOptions.some((option) => option.code === system.band?.code);
      return isModelOption ? system.band.code : CUSTOM_BAND_VALUE;
    }

    const bandValue = system.band.trim();
    if (bandValue.length === 0) {
      return CUSTOM_BAND_VALUE;
    }

    const matchingOption = modelOptions.find(
      (option) => option.code.toLowerCase() === bandValue.toLowerCase(),
    );

    return matchingOption ? matchingOption.code : CUSTOM_BAND_VALUE;
  };

  const getCustomBandInputValue = (system: WirelessSetup): string => {
    if (!system.band) return "";
    if (typeof system.band === "string") return system.band;
    return formatFrequencyBand(system.band);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Signal className="h-4 w-4" />
          <Label>{label}</Label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addSystem} disabled={readOnly}>
          <Plus className="h-4 w-4 mr-2" />
          {tx("Añadir Sistema", "Add System")}
        </Button>
      </div>

      {systems.map((system, index) => {
        const systemKey = system._id || `system-${index}`;
        const bandOptions = getBandOptionsEU(category, system.model || "");
        const bandSelectValue = getBandSelectValue(system);
        const showCustomBandInput = bandSelectValue === CUSTOM_BAND_VALUE;

        return (
          <div key={systemKey} className="space-y-3 p-3 md:p-4 border rounded-lg">
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                {(() => {
                  const isFestivalProvider = (system.provided_by || "festival") === "festival";
                  const modelOptions = isFestivalProvider ? festivalModelOptions : [];
                  const fallbackOptions = options;
                  const equipmentCategory = getCategory();

                  return (
                    <EquipmentSelect
                      value={system.model}
                      onChange={(value) => updateSystem(index, "model", value)}
                      options={modelOptions}
                      fallbackOptions={fallbackOptions}
                      placeholder={tx("Seleccionar sistema", "Select system")}
                      category={equipmentCategory}
                      disabled={readOnly}
                    />
                  );
                })()}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSystem(index)}
                disabled={readOnly}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>

            {(system.provided_by || "festival") === "festival" && festivalModelOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {tx(
                  "No hay modelos disponibles en el gear setup del festival para este tipo de sistema.",
                  "No models available in festival gear setup for this system type.",
                )}
              </p>
            )}

            {includeQuantityTypes && (
              <div className={`grid gap-4 ${isIEM ? "grid-cols-2" : "grid-cols-3"}`}>
                {!isIEM && (
                  <div className="flex-1">
                    <Label>{quantityTypeLabels.ch}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={system.quantity_ch || 0}
                      onChange={(e) => {
                        updateSystem(index, "quantity_ch", e.target.value);
                      }}
                      placeholder={`${quantityTypeLabels.ch} Qty`}
                      disabled={readOnly}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Label>{quantityTypeLabels.hh}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.quantity_hh || 0}
                    onChange={(e) => {
                      updateSystem(index, "quantity_hh", e.target.value);
                    }}
                    placeholder={`${quantityTypeLabels.hh} Qty`}
                    disabled={readOnly}
                  />
                </div>
                <div className="flex-1">
                  <Label>{quantityTypeLabels.bp}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.quantity_bp || 0}
                    onChange={(e) => {
                      updateSystem(index, "quantity_bp", e.target.value);
                    }}
                    placeholder={`${quantityTypeLabels.bp} Qty`}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{tx("Banda de Frecuencia", "Frequency Band")}</Label>
              <Select
                value={bandSelectValue}
                onValueChange={(value) => {
                  if (value === CUSTOM_BAND_VALUE) {
                    updateSystem(index, "band", "");
                    return;
                  }

                  const selectedOption = bandOptions.find((option) => option.code === value);
                  updateSystem(index, "band", selectedOption);
                }}
                disabled={readOnly || !system.model}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !system.model
                        ? tx("Selecciona un modelo primero", "Select a model first")
                        : tx("Seleccionar banda", "Select band")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {bandOptions.map((bandOption) => (
                    <SelectItem key={bandOption.code} value={bandOption.code}>
                      {formatBandOptionLabel(bandOption)}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_BAND_VALUE}>{tx("Custom...", "Custom...")}</SelectItem>
                </SelectContent>
              </Select>

              {showCustomBandInput && (
                <Input
                  value={getCustomBandInputValue(system)}
                  onChange={(e) => updateSystem(index, "band", e.target.value)}
                  placeholder={tx("ej., G50, H50", "e.g., G50, H50")}
                  disabled={readOnly}
                />
              )}

              {system.model && bandOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {tx(
                    "No hay bandas predefinidas para este modelo. Usa Custom para ingresar texto libre.",
                    "No predefined bands for this model. Use Custom to enter free text.",
                  )}
                </p>
              )}
            </div>

            {!hideProvidedBy && (
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-sm">{tx("Proporcionado por", "Provided by")}</Label>
                <RadioGroup
                  value={system.provided_by || "festival"}
                  onValueChange={(value: "festival" | "band") => {
                    updateSystem(index, "provided_by", value);
                  }}
                  className="flex space-x-4"
                  disabled={readOnly}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="festival" id={`${systemKey}-festival`} disabled={readOnly} />
                    <Label htmlFor={`${systemKey}-festival`}>{tx("Festival", "Festival")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="band" id={`${systemKey}-band`} disabled={readOnly} />
                    <Label htmlFor={`${systemKey}-band`}>{tx("Banda", "Band")}</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
