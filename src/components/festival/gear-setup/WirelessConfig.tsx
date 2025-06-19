
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { WirelessSetup } from "@/types/festival";
import { WirelessConfigProps } from "@/types/festival-gear";
import { EquipmentSelect } from "@/components/festival/form/shared/EquipmentSelect";

// Fallback options in case database is empty
const fallbackWirelessOptions = [
  'Shure AD Series', 'Shure AXT Series', 'Shure UR Series', 'Shure ULX Series', 'Shure QLX Series',
  'Sennheiser 2000 Series', 'Sennheiser EW500 Series', 'Sennheiser EW300 Series', 'Sennheiser EW100 Series',
  'Other'
] as const;

const fallbackIemOptions = [
  'Shure Digital PSM Series', 'Shure PSM1000 Series', 'Shure PSM900 Series', 'Shure PSM300 Series',
  'Sennheiser 2000 series', 'Sennheiser 300 G4 Series', 'Sennheiser 300 G3 Series',
  'Wysicom MTK', 'Other'
] as const;

export const WirelessConfig = ({ 
  systems, 
  onChange, 
  label, 
  includeQuantityTypes = false,
  isIEM = false,
  hideProvidedBy = false 
}: WirelessConfigProps) => {
  const [expandedSystem, setExpandedSystem] = useState<number | null>(null);

  const addSystem = () => {
    const newSystem: WirelessSetup = {
      model: "",
      quantity: 1,
      ...(includeQuantityTypes && {
        handheld_quantity: 0,
        bodypack_quantity: 0,
        lapel_quantity: 0,
        headset_quantity: 0
      })
    };
    onChange([...systems, newSystem]);
    setExpandedSystem(systems.length);
  };

  const updateSystem = (index: number, field: keyof WirelessSetup, value: string | number) => {
    const updated = systems.map((system, i) => 
      i === index ? { ...system, [field]: value } : system
    );
    onChange(updated);
  };

  const removeSystem = (index: number) => {
    const updated = systems.filter((_, i) => i !== index);
    onChange(updated);
    if (expandedSystem === index) {
      setExpandedSystem(null);
    }
  };

  const getCategory = () => {
    return isIEM ? 'iem' : 'wireless';
  };

  const getFallbackOptions = () => {
    return isIEM ? fallbackIemOptions : fallbackWirelessOptions;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-medium">{label}</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSystem}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add System
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {systems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No systems added yet. Click "Add System" to get started.
          </p>
        )}
        
        {systems.map((system, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{label.slice(0, -1)} {index + 1}</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSystem(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>System Model</Label>
                <EquipmentSelect
                  value={system.model}
                  onChange={(value) => updateSystem(index, 'model', value)}
                  category={getCategory()}
                  placeholder="Select system model"
                  fallbackOptions={getFallbackOptions()}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Total Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={system.quantity}
                  onChange={(e) => updateSystem(index, 'quantity', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            {includeQuantityTypes && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Handheld</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.handheld_quantity || 0}
                    onChange={(e) => updateSystem(index, 'handheld_quantity', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Bodypack</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.bodypack_quantity || 0}
                    onChange={(e) => updateSystem(index, 'bodypack_quantity', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lapel</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.lapel_quantity || 0}
                    onChange={(e) => updateSystem(index, 'lapel_quantity', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Headset</Label>
                  <Input
                    type="number"
                    min="0"
                    value={system.headset_quantity || 0}
                    onChange={(e) => updateSystem(index, 'headset_quantity', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
