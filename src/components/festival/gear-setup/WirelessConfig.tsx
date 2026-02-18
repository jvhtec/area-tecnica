
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Signal } from "lucide-react";
import { WirelessConfigProps } from "@/types/festival-gear";
import { WirelessSetup } from "@/types/festival";
import { EquipmentSelect } from "../form/shared/EquipmentSelect";
import { WIRELESS_SYSTEMS, IEM_SYSTEMS } from "@/types/festival-equipment";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEffect, useMemo } from "react";

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
    [festivalAvailableModels]
  );

  useEffect(() => {
    if (systems.length === 0) return;

    const hasMissingIds = systems.some((system) => !system._id);
    if (!hasMissingIds) return;

    onChange(
      systems.map((system) =>
        system._id ? system : { ...system, _id: crypto.randomUUID() }
      )
    );
  }, [onChange, systems]);

  useEffect(() => {
    if (festivalModelOptions.length === 0 || systems.length === 0) return;

    const needsNormalization = systems.some((system) => {
      const isFestivalProvider = (system.provided_by || "festival") === "festival";
      return isFestivalProvider && !!system.model && !festivalModelOptions.includes(system.model);
    });

    if (!needsNormalization) return;

    onChange(
      systems.map((system) => {
        const isFestivalProvider = (system.provided_by || "festival") === "festival";
        if (!isFestivalProvider || !system.model || festivalModelOptions.includes(system.model)) {
          return system;
        }
        return { ...system, model: "" };
      })
    );
  }, [festivalModelOptions, onChange, systems]);

  const addSystem = () => {
    const newSystem: WirelessSetup = {
      _id: crypto.randomUUID(),
      model: '',
      quantity: 0,
      quantity_hh: 0,
      quantity_bp: 0,
      band: '',
      provided_by: 'festival'
    };
    onChange([...systems, newSystem]);
  };

  const removeSystem = (index: number) => {
    onChange(systems.filter((_, i) => i !== index));
  };

  const updateSystem = (index: number, field: keyof WirelessSetup, value: string | number) => {
    const updatedSystems = systems.map((system, i) => {
      if (i !== index) return system;
      
      const updatedSystem = { ...system };
      
      // Handle numeric fields
      if (field === 'quantity_hh' || field === 'quantity_bp') {
        const numericValue = typeof value === 'string' ? parseInt(value) || 0 : value;
        updatedSystem[field as 'quantity_hh' | 'quantity_bp'] = numericValue;
        
        if (isIEM) {
          // For IEM systems, quantity equals channels (quantity_hh)
          if (field === 'quantity_hh') {
            updatedSystem.quantity = numericValue;
          }
        } else {
          // For wireless systems, quantity is the sum of handhelds and bodypacks
          updatedSystem.quantity = (updatedSystem.quantity_hh || 0) + (updatedSystem.quantity_bp || 0);
        }
      } else if (field === 'provided_by') {
        // Ensure provided_by is properly validated and typed
        if (value === 'festival' || value === 'band') {
          updatedSystem.provided_by = value;
          if (
            value === "festival" &&
            festivalModelOptions.length > 0 &&
            updatedSystem.model &&
            !festivalModelOptions.includes(updatedSystem.model)
          ) {
            updatedSystem.model = "";
          }
        } else {
          updatedSystem.provided_by = 'festival';
        }
      } else {
        // Handle non-numeric fields (model, band)
        updatedSystem[field as 'model' | 'band'] = value as string;
      }
      
      return updatedSystem;
    });
    
    onChange(updatedSystems);
  };

  const options = isIEM ? IEM_SYSTEMS : WIRELESS_SYSTEMS;
  const quantityTypeLabels = isIEM ? {
    hh: tx("Canales", "Channels"),
    bp: tx("Petacas", "Bodypacks")
  } : {
    hh: tx("De Mano", "Handheld"),
    bp: tx("Petacas", "Bodypacks")
  };

  const getCategory = () => {
    return isIEM ? 'iem' : 'wireless';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Signal className="h-4 w-4" />
          <Label>{label}</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSystem}
          disabled={readOnly}
        >
          <Plus className="h-4 w-4 mr-2" />
          {tx("Añadir Sistema", "Add System")}
        </Button>
      </div>

      {systems.map((system, index) => {
        const systemKey = system._id || `system-${index}`;
        return (
        <div key={systemKey} className="space-y-4 p-4 border rounded-lg">
          <div className="flex gap-4 items-start">
          <div className="flex-1">
              {(() => {
                const isFestivalProvider = (system.provided_by || "festival") === "festival";
                const modelOptions = isFestivalProvider ? festivalModelOptions : [];
                const fallbackOptions = isFestivalProvider ? [] : options;
                const category = isFestivalProvider ? undefined : getCategory();

                return (
                  <EquipmentSelect
                    value={system.model}
                    onChange={(value) => updateSystem(index, 'model', value)}
                    options={modelOptions}
                    fallbackOptions={fallbackOptions}
                    placeholder={tx("Seleccionar sistema", "Select system")}
                    category={category}
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
                "No models available in festival gear setup for this system type."
              )}
            </p>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <Label>{quantityTypeLabels.hh}</Label>
              <Input
                type="number"
                min="0"
                value={system.quantity_hh || 0}
                onChange={(e) => {
                  updateSystem(index, 'quantity_hh', e.target.value);
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
                  updateSystem(index, 'quantity_bp', e.target.value);
                }}
                placeholder={`${quantityTypeLabels.bp} Qty`}
                disabled={readOnly}
              />
            </div>
          </div>

          <div>
            <Label>{tx("Banda de Frecuencia", "Frequency Band")}</Label>
            <Input
              value={system.band || ''}
              onChange={(e) => updateSystem(index, 'band', e.target.value)}
              placeholder={tx("ej., G50, H50", "e.g., G50, H50")}
              disabled={readOnly}
            />
          </div>

          {!hideProvidedBy && (
            <div>
              <Label>{tx("Proporcionado por", "Provided by")}</Label>
              <RadioGroup
                value={system.provided_by || 'festival'}
                onValueChange={(value: 'festival' | 'band') => {
                  updateSystem(index, 'provided_by', value);
                }}
                className="flex space-x-4 mt-1"
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
      )})}
    </div>
  );
};
