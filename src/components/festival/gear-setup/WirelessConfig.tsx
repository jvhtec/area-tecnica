
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
  hideProvidedBy = false
}: WirelessConfigProps) => {
  const addSystem = () => {
    const newSystem: WirelessSetup = {
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
    console.log('Updating system:', { index, field, value, currentSystems: systems });
    
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
          console.log('Updated provided_by to:', value);
        } else {
          console.warn('Invalid provided_by value:', value, 'defaulting to festival');
          updatedSystem.provided_by = 'festival';
        }
      } else {
        // Handle non-numeric fields (model, band)
        updatedSystem[field as 'model' | 'band'] = value as string;
      }
      
      console.log('Updated system:', updatedSystem);
      return updatedSystem;
    });
    
    console.log('Calling onChange with updated systems:', updatedSystems);
    onChange(updatedSystems);
  };

  const options = isIEM ? IEM_SYSTEMS : WIRELESS_SYSTEMS;
  const quantityTypeLabels = isIEM ? {
    hh: "Canales",
    bp: "Bodypacks"
  } : {
    hh: "De Mano",
    bp: "Bodypacks"
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
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir Sistema
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
                placeholder="Seleccionar sistema"
                category={getCategory()}
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
            <Label>Banda de Frecuencia</Label>
            <Input
              value={system.band || ''}
              onChange={(e) => updateSystem(index, 'band', e.target.value)}
              placeholder="ej., G50, H50"
            />
          </div>

          {!hideProvidedBy && (
            <div>
              <Label>Proporcionado Por</Label>
              <RadioGroup
                value={system.provided_by || 'festival'}
                onValueChange={(value: 'festival' | 'band') => {
                  console.log('RadioGroup onValueChange called with:', value);
                  updateSystem(index, 'provided_by', value);
                }}
                className="flex space-x-4 mt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="festival" id={`${index}-festival`} />
                  <Label htmlFor={`${index}-festival`}>Festival</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id={`${index}-band`} />
                  <Label htmlFor={`${index}-band`}>Banda</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
