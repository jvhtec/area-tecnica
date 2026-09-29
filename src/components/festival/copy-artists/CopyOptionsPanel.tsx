import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CopyArtistsOptions } from "@/features/festival-artists/copyArtists";

const OPTION_LABELS: Array<[keyof CopyArtistsOptions, string]> = [
  ["resetTimes", "Restablecer horarios del show"],
  ["resetStages", "Restablecer a Stage 1"],
  ["copyNotes", "Copiar notas"],
  ["copyTechnicalSpecs", "Copiar especificaciones técnicas"],
];

interface CopyOptionsPanelProps {
  options: CopyArtistsOptions;
  onChange: (options: CopyArtistsOptions) => void;
}

/** Shared copy options: they apply to whatever is selected across both tabs. */
export const CopyOptionsPanel = ({ options, onChange }: CopyOptionsPanelProps) => (
  <div className="space-y-3">
    <Label className="text-base font-medium">Opciones de copia</Label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {OPTION_LABELS.map(([key, label]) => (
        <div key={key} className="flex items-start space-x-2">
          <Checkbox
            id={key}
            checked={options[key]}
            onCheckedChange={(checked) => onChange({ ...options, [key]: checked === true })}
            className="mt-1"
          />
          <Label htmlFor={key} className="text-sm leading-normal cursor-pointer">
            {label}
          </Label>
        </div>
      ))}
    </div>
  </div>
);
