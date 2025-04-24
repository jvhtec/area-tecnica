
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Signal } from "lucide-react";
import { WirelessConfigProps } from "@/types/festival-gear";
import { WirelessSetup } from "@/types/festival";
import { EquipmentSelect } from "../form/shared/EquipmentSelect";
import { WIRELESS_SYSTEMS, IEM_SYSTEMS } from "@/types/festival-equipment";

export const WirelessConfig = ({ 
  systems, 
  onChange, 
  label, 
  includeQuantityTypes = false,
  isIEM = false
}: WirelessConfigProps) => {
  const addSystem = () => {
    const newSystem: WirelessSetup = {
      model: '',
      quantity: 0, // Keep the quantity field for backward compatibility
      quantity_hh: 0,
      quantity_bp: 0,
      band: ''
    };
    onChange([...systems, newSystem]);
  };

  const removeSystem = (index: number) => {
    onChange(systems.filter((_, i) => i !== index));
  };

  const updateSystem = (index: number, field: keyof WirelessSetup, value: string | number) => {
    onChange(
      systems.map((system, i) => 
        i === index ? { ...system, [field]: value } : system
      )
    );
  };

  const options = isIEM ? IEM_SYSTEMS : WIRELESS_SYSTEMS;
  const quantityTypeLabels = isIEM ? {
    hh: "Channels",
    bp: "Bodypacks"
  } : {
    hh: "Handheld",
    bp: "Bodypacks"
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
        >
          <Plus className="h-4 w-4 mr-2" />
          Add System
        </Button>
      </div>

      {systems.map((system, index) => (
        <div key={index} className="space-y-4 p-4 border rounded-lg">
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <EquipmentSelect
                value={system.model}
                onChange={(value) => updateSystem(index, 'model', value)}
                options={[]}
                fallbackOptions={options}
                placeholder="Select system"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSystem(index)}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label>{quantityTypeLabels.hh}</Label>
              <Input
                type="number"
                min="0"
                value={system.quantity_hh || 0}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  updateSystem(index, 'quantity_hh', value);
                  // Also update the legacy quantity field for backward compatibility
                  if (isIEM) {
                    updateSystem(index, 'quantity', value);
                  }
                }}
                placeholder={`${quantityTypeLabels.hh} Qty`}
              />
            </div>
            <div className="flex-1">
              <Label>{quantityTypeLabels.bp}</Label>
              <Input
                type="number"
                min="0"
                value={system.quantity_bp || 0}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  updateSystem(index, 'quantity_bp', value);
                  // For wireless systems, update quantity with the sum
                  if (!isIEM) {
                    const totalQuantity = (system.quantity_hh || 0) + value;
                    updateSystem(index, 'quantity', totalQuantity);
                  }
                }}
                placeholder={`${quantityTypeLabels.bp} Qty`}
              />
            </div>
          </div>

          <div>
            <Label>Frequency Band</Label>
            <Input
              value={system.band || ''}
              onChange={(e) => updateSystem(index, 'band', e.target.value)}
              placeholder="e.g., G50, H50"
            />
          </div>
        </div>
      ))}
    </div>
  );
};
