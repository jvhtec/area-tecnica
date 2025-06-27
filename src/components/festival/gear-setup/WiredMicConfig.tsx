
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus } from "lucide-react";
import { EquipmentSelect } from "../form/shared/EquipmentSelect";
import { ProviderSelector } from "../form/shared/ProviderSelector";

export interface WiredMic {
  model: string;
  quantity: number;
  exclusive_use?: boolean;
  notes?: string;
  provided_by?: 'festival' | 'band';
}

interface WiredMicConfigProps {
  mics: WiredMic[];
  onChange: (mics: WiredMic[]) => void;
  label?: string;
  showProvider?: boolean;
}

export const WiredMicConfig = ({ 
  mics, 
  onChange, 
  label = "Wired Microphones",
  showProvider = false 
}: WiredMicConfigProps) => {
  const addMic = () => {
    onChange([...mics, { 
      model: '', 
      quantity: 1, 
      exclusive_use: false,
      provided_by: 'festival'
    }]);
  };

  const removeMic = (index: number) => {
    onChange(mics.filter((_, i) => i !== index));
  };

  const updateMic = (index: number, field: keyof WiredMic, value: string | number | boolean) => {
    onChange(
      mics.map((mic, i) => 
        i === index ? { ...mic, [field]: value } : mic
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
          onClick={addMic}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Microphone
        </Button>
      </div>

      {mics.map((mic, index) => (
        <div key={index} className="space-y-3 p-4 border rounded-lg">
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <EquipmentSelect
                value={mic.model}
                onChange={(value) => updateMic(index, 'model', value)}
                options={[]}
                fallbackOptions={[]}
                placeholder="Select microphone"
                category="wired_mics"
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                min="1"
                value={mic.quantity}
                onChange={(e) => updateMic(index, 'quantity', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`exclusive-${index}`}
                checked={mic.exclusive_use || false}
                onCheckedChange={(checked) => updateMic(index, 'exclusive_use', !!checked)}
              />
              <Label htmlFor={`exclusive-${index}`} className="text-sm">
                Exclusive
              </Label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeMic(index)}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
          
          {showProvider && (
            <div className="mt-3">
              <ProviderSelector
                value={mic.provided_by || 'festival'}
                onChange={(provider) => updateMic(index, 'provided_by', provider as 'festival' | 'band')}
                label="Provided By"
                id={`mic-provider-${index}`}
                showMixed={false}
              />
            </div>
          )}
        </div>
      ))}

      {mics.length === 0 && (
        <p className="text-sm text-muted-foreground">No wired microphones added yet.</p>
      )}
    </div>
  );
};
