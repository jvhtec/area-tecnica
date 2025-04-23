
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
  includeQuantityTypes = false 
}: WirelessConfigProps) => {
  const addSystem = () => {
    const newSystem: WirelessSetup = {
      model: '',
      quantity: 0,
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

  const options = label.toLowerCase().includes('iem') ? IEM_SYSTEMS : WIRELESS_SYSTEMS;

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
            {!includeQuantityTypes && (
              <div className="w-24">
                <Input
                  type="number"
                  min="0"
                  value={system.quantity}
                  onChange={(e) => updateSystem(index, 'quantity', parseInt(e.target.value) || 0)}
                  placeholder="Qty"
                />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSystem(index)}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>

          {includeQuantityTypes && (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Handheld</Label>
                <Input
                  type="number"
                  min="0"
                  value={system.quantity_hh}
                  onChange={(e) => updateSystem(index, 'quantity_hh', parseInt(e.target.value) || 0)}
                  placeholder="HH Qty"
                />
              </div>
              <div className="flex-1">
                <Label>Bodypack</Label>
                <Input
                  type="number"
                  min="0"
                  value={system.quantity_bp}
                  onChange={(e) => updateSystem(index, 'quantity_bp', parseInt(e.target.value) || 0)}
                  placeholder="BP Qty"
                />
              </div>
            </div>
          )}

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
