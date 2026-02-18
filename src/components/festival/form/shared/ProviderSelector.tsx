
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ProviderSelectorProps } from "@/types/festival-form";

export const ProviderSelector = ({
  value,
  onChange,
  label,
  id,
  showMixed = false,
  disabled = false,
  language = "es",
}: ProviderSelectorProps) => {
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  return (
    <div className="flex items-center justify-between">
      <h4 className="font-medium">{label}</h4>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="flex space-x-4"
        disabled={disabled}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="festival" id={`${id}-festival`} disabled={disabled} />
          <Label htmlFor={`${id}-festival`}>Festival</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="band" id={`${id}-band`} disabled={disabled} />
          <Label htmlFor={`${id}-band`}>{tx("Banda", "Band")}</Label>
        </div>
        {showMixed && (
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mixed" id={`${id}-mixed`} disabled={disabled} />
            <Label htmlFor={`${id}-mixed`}>{tx("Mixto", "Mixed")}</Label>
          </div>
        )}
      </RadioGroup>
    </div>
  );
};
