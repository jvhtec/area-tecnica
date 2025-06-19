
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { ConsoleSetup } from "@/types/festival";
import { ConsoleConfigProps } from "@/types/festival-gear";
import { EquipmentSelect } from "@/components/festival/form/shared/EquipmentSelect";

// Fallback options in case database is empty
const fallbackConsoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'Yamaha DM7','Yamaha DM3', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Midas HD96', 'Other'
] as const;

export const ConsoleConfig = ({ consoles, onChange, label }: ConsoleConfigProps) => {
  const [expandedConsole, setExpandedConsole] = useState<number | null>(null);

  const addConsole = () => {
    const newConsole: ConsoleSetup = {
      model: "",
      quantity: 1
    };
    onChange([...consoles, newConsole]);
    setExpandedConsole(consoles.length);
  };

  const updateConsole = (index: number, field: keyof ConsoleSetup, value: string | number) => {
    const updated = consoles.map((console, i) => 
      i === index ? { ...console, [field]: value } : console
    );
    onChange(updated);
  };

  const removeConsole = (index: number) => {
    const updated = consoles.filter((_, i) => i !== index);
    onChange(updated);
    if (expandedConsole === index) {
      setExpandedConsole(null);
    }
  };

  // Determine the category based on the label
  const getCategory = () => {
    if (label.toLowerCase().includes('foh')) return 'foh_console';
    if (label.toLowerCase().includes('monitor')) return 'mon_console';
    return 'foh_console'; // default fallback
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-medium">{label}</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addConsole}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Console
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {consoles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No consoles added yet. Click "Add Console" to get started.
          </p>
        )}
        
        {consoles.map((console, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Console {index + 1}</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeConsole(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Console Model</Label>
                <EquipmentSelect
                  value={console.model}
                  onChange={(value) => updateConsole(index, 'model', value)}
                  category={getCategory()}
                  placeholder="Select console model"
                  fallbackOptions={fallbackConsoleOptions}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={console.quantity}
                  onChange={(e) => updateConsole(index, 'quantity', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
