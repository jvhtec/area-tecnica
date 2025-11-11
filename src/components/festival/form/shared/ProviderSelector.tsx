
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ProviderSelectorProps } from "@/types/festival-form";

export const ProviderSelector = ({ value, onChange, label, id, showMixed = false }: ProviderSelectorProps) => {
  return (
    <div className="flex items-center justify-between">
      <h4 className="font-medium">{label}</h4>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="flex space-x-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="festival" id={`${id}-festival`} />
          <Label htmlFor={`${id}-festival`}>Festival</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="band" id={`${id}-band`} />
          <Label htmlFor={`${id}-band`}>Banda</Label>
        </div>
        {showMixed && (
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mixed" id={`${id}-mixed`} />
            <Label htmlFor={`${id}-mixed`}>Mixto</Label>
          </div>
        )}
      </RadioGroup>
    </div>
  );
};
