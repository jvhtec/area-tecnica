
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus } from "lucide-react";
import { ConsoleConfigProps } from "@/types/festival-gear";
import { ConsoleSetup } from "@/types/festival";

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
          Add Console
        </Button>
      </div>

      {consoles.map((console, index) => (
        <div key={index} className="flex gap-4 items-start">
          <div className="flex-1">
            <Input
              placeholder="Console model"
              value={console.model}
              onChange={(e) => updateConsole(index, 'model', e.target.value)}
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
