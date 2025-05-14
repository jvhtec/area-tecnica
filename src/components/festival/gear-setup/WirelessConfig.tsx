
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Signal } from "lucide-react";
import { WirelessConfigProps } from "@/types/festival-gear";
import { WirelessSetup } from "@/types/festival";
import { EquipmentSelect } from "../form/shared/EquipmentSelect";
import { WIRELESS_SYSTEMS, IEM_SYSTEMS } from "@/types/festival-equipment";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const WirelessConfig = ({ 
  systems, 
  onChange, 
  label, 
  includeQuantityTypes = false,
  isIEM = false,
  defaultProvidedBy = 'festival'
}: WirelessConfigProps) => {
  const addSystem = () => {
    const newSystem: WirelessSetup = {
      model: '',
      quantity: 0,
      quantity_hh: 0,
      quantity_bp: 0,
      band: '',
      provided_by: defaultProvidedBy
    };
    onChange([...systems, newSystem]);
  };

  const removeSystem = (index: number) => {
    onChange(systems.filter((_, i) => i !== index));
  };

  const updateSystem = (index: number, field: keyof WirelessSetup, value: string | number) => {
    onChange(
      systems.map((system, i) => {
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
          // Ensure provided_by is strictly typed as 'festival' | 'band'
          updatedSystem.provided_by = value as 'festival' | 'band';
        } else {
          // Handle non-numeric fields (model, band)
          updatedSystem[field as 'model' | 'band'] = value as string;
        }
        
        return updatedSystem;
      })
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
                  updateSystem(index, 'quantity_hh', e.target.value);
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
                  updateSystem(index, 'quantity_bp', e.target.value);
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
          
          <div>
            <Label>Provided By</Label>
            <RadioGroup
              value={system.provided_by || defaultProvidedBy}
              onValueChange={(value: 'festival' | 'band') => updateSystem(index, 'provided_by', value)}
              className="flex space-x-4 mt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="festival" id={`${index}-festival`} />
                <Label htmlFor={`${index}-festival`}>Festival</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="band" id={`${index}-band`} />
                <Label htmlFor={`${index}-band`}>Band</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      ))}
    </div>
  );
};
