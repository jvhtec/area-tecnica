
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { WirelessConfigProps } from "@/types/festival-gear";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";
import { WIRELESS_SYSTEMS, IEM_SYSTEMS } from "@/types/festival-equipment";

export const WirelessConfig = ({ 
  systems, 
  onChange, 
  label, 
  includeQuantityTypes = false,
  isIEM = false,
  hideProvidedBy = false
}: WirelessConfigProps) => {
  const { models } = useEquipmentModels();

  const addSystem = () => {
    const newSystem = {
      model: '',
      quantity_hh: 0,
      quantity_bp: 0,
      band: '',
      notes: '',
      provided_by: 'festival' as const
    };
    onChange([...systems, newSystem]);
  };

  const removeSystem = (index: number) => {
    onChange(systems.filter((_, i) => i !== index));
  };

  const updateSystem = (index: number, field: string, value: string | number) => {
    const updatedSystems = systems.map((system, i) => 
      i === index ? { ...system, [field]: value } : system
    );
    onChange(updatedSystems);
  };

  // Get system options from database with fallback
  const systemOptions = models
    .filter(model => model.category === (isIEM ? 'iem' : 'wireless'))
    .map(model => model.name);
  
  const fallbackOptions = isIEM ? IEM_SYSTEMS : WIRELESS_SYSTEMS;
  const options = systemOptions.length > 0 ? systemOptions : fallbackOptions;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
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
        <div key={index} className="space-y-3 p-4 border rounded-lg">
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-4">
              <Label className="text-xs">Model</Label>
              <Select
                value={system.model}
                onValueChange={(value) => updateSystem(index, 'model', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select system" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {includeQuantityTypes && (
              <>
                <div className="col-span-2">
                  <Label className="text-xs">{isIEM ? 'Channels' : 'HH'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.quantity_hh || 0}
                    onChange={(e) => updateSystem(index, 'quantity_hh', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{isIEM ? 'Bodypacks' : 'BP'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.quantity_bp || 0}
                    onChange={(e) => updateSystem(index, 'quantity_bp', parseInt(e.target.value) || 0)}
                  />
                </div>
              </>
            )}

            <div className="col-span-2">
              <Label className="text-xs">Band</Label>
              <Input
                value={system.band || ''}
                onChange={(e) => updateSystem(index, 'band', e.target.value)}
                placeholder="Band"
              />
            </div>

            {!hideProvidedBy && (
              <div className="col-span-2">
                <Label className="text-xs">Provider</Label>
                <Select
                  value={system.provided_by || 'festival'}
                  onValueChange={(value) => updateSystem(index, 'provided_by', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="festival">Festival</SelectItem>
                    <SelectItem value="band">Band</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-1 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSystem(index)}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Input
              value={system.notes || ''}
              onChange={(e) => updateSystem(index, 'notes', e.target.value)}
              placeholder="Additional notes"
            />
          </div>
        </div>
      ))}

      {systems.length === 0 && (
        <p className="text-sm text-muted-foreground">No systems added yet.</p>
      )}
    </div>
  );
};
