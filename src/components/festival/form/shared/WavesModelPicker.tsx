
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { WAVES_MODEL_OPTIONS, getWavesModelQuantity, type WavesModel, type WavesModelSelection } from "@/constants/wavesModels";
import { ProviderSelector } from "./ProviderSelector";

interface WavesModelPickerProps {
  idPrefix: string;
  waveModelsLabel: string;
  outboardLabel: string;
  outboardPlaceholder: string;
  selectedModels: WavesModelSelection[];
  outboard: string;
  onModelsChange: (models: WavesModelSelection[]) => void;
  onOutboardChange: (outboard: string) => void;
  providedBy?: string;
  onProvidedByChange?: (providedBy: string) => void;
  providedByLabel?: string;
  disabled?: boolean;
  language?: "es" | "en";
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
  language = "es",
}: WavesModelPickerProps) => {
  const setQuantity = (model: WavesModel, quantity: number) => {
    if (quantity <= 0) {
      onModelsChange(selectedModels.filter((selection) => selection.model !== model));
      return;
    }

    const exists = selectedModels.some((selection) => selection.model === model);
    onModelsChange(
      exists
        ? selectedModels.map((selection) => (selection.model === model ? { ...selection, quantity } : selection))
        : [...selectedModels, { model, quantity }]
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{waveModelsLabel}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WAVES_MODEL_OPTIONS.map((option) => {
            const quantity = getWavesModelQuantity(selectedModels, option.value);
            return (
              <div
                key={option.value}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span className="text-sm">{option.label}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setQuantity(option.value, quantity - 1)}
                    disabled={disabled || quantity === 0}
                    aria-label={`Quitar ${option.label}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center text-sm font-medium tabular-nums">{quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setQuantity(option.value, quantity + 1)}
                    disabled={disabled}
                    aria-label={`Añadir ${option.label}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
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
          language={language}
        />
      )}
    </div>
  );
};
