import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus } from "lucide-react";
import { ConsoleConfigProps } from "@/types/festival-gear";
import { ConsoleSetup } from "@/types/festival";
import { EquipmentSelect } from "../form/shared/EquipmentSelect";

const consoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'Yamaha DM7','Yamaha DM3', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Midas HD96',
  'Midas PRO2', 'Midas M32','Behringer X32','Behringer Wing', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Other'
];

export const ConsoleConfig = ({ consoles, onChange, label }: ConsoleConfigProps) => {
  const addConsole = () => {
    onChange([...consoles, { model: '', quantity: 1 }]);
  };

  const removeConsole = (index: number) => {
    onChange(consoles.filter((_, i) => i !== index));
  };

  const updateConsole = (index: number, field: keyof ConsoleSetup, value: string | number) => {
    onChange(
      consoles.map((console, i) => 
        i === index ? { ...console, [field]: value } : console
      )
    );
  };

  // Determine category based on label
  const getCategory = () => {
    if (label.toLowerCase().includes('foh')) return 'foh_console';
    if (label.toLowerCase().includes('monitor')) return 'mon_console';
    return undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addConsole}
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir Console
        </Button>
      </div>

      {consoles.map((console, index) => (
        <div key={index} className="flex gap-4 items-start">
          <div className="flex-1">
            <EquipmentSelect
              value={console.model}
              onChange={(value) => updateConsole(index, 'model', value)}
              options={[]}
              fallbackOptions={consoleOptions}
              placeholder="Seleccionar console"
              category={getCategory()}
            />
          </div>
          <div className="w-24">
            <Input
              type="number"
              min="1"
              value={console.quantity}
              onChange={(e) => updateConsole(index, 'quantity', parseInt(e.target.value) || 0)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeConsole(index)}
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};
