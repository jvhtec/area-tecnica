
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { WAVES_MODEL_OPTIONS } from "@/constants/wavesModels";
import { ProviderSelector } from "./ProviderSelector";

interface WavesModelPickerProps {
  idPrefix: string;
  waveModelsLabel: string;
  outboardLabel: string;
  outboardPlaceholder: string;
  selectedModels: string[];
  outboard: string;
  onModelsChange: (models: string[]) => void;
  onOutboardChange: (outboard: string) => void;
  providedBy?: string;
  onProvidedByChange?: (providedBy: string) => void;
  providedByLabel?: string;
  disabled?: boolean;
}

export const WavesModelPicker = ({
  idPrefix,
  waveModelsLabel,
  outboardLabel,
  outboardPlaceholder,
  selectedModels,
  outboard,
  onModelsChange,
  onOutboardChange,
  providedBy,
  onProvidedByChange,
  providedByLabel = "Waves/Outboard proporcionado por",
  disabled = false,
}: WavesModelPickerProps) => {
  const toggleModel = (value: string, checked: boolean) => {
    if (checked) {
      onModelsChange([...selectedModels, value]);
    } else {
      onModelsChange(selectedModels.filter((model) => model !== value));
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{waveModelsLabel}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {WAVES_MODEL_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${idPrefix}-${option.value}`}
                checked={selectedModels.includes(option.value)}
                onCheckedChange={(checked) => toggleModel(option.value, checked === true)}
                disabled={disabled}
              />
              <Label htmlFor={`${idPrefix}-${option.value}`} className="font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-outboard`}>{outboardLabel}</Label>
        <Input
          id={`${idPrefix}-outboard`}
          value={outboard || ""}
          onChange={(event) => onOutboardChange(event.target.value)}
          placeholder={outboardPlaceholder}
          disabled={disabled}
        />
      </div>
      {onProvidedByChange && (
        <ProviderSelector
          id={`${idPrefix}-provided-by`}
          label={providedByLabel}
          value={providedBy || "festival"}
          onChange={onProvidedByChange}
          disabled={disabled}
        />
      )}
    </div>
  );
};
