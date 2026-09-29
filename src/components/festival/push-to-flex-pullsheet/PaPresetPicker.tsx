import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PaPresetOption } from './model';

interface PaPresetPickerProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  presets: PaPresetOption[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  jobId: string;
  disabled: boolean;
}

/** Optionally adds the speakers and amplification of a sound preset to the push. */
export function PaPresetPicker({
  enabled,
  onEnabledChange,
  presets,
  isLoading,
  selectedId,
  onSelect,
  jobId,
  disabled,
}: PaPresetPickerProps) {
  const placeholder = isLoading
    ? 'Cargando presets...'
    : presets.length === 0
      ? 'No hay presets'
      : 'Selecciona un preset...';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="include-pa-preset">Incluir preset de PA</Label>
          <p className="text-xs text-muted-foreground">Añade los altavoces y la amplificación de un preset.</p>
        </div>
        <Switch
          id="include-pa-preset"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled || isLoading}
        />
      </div>

      {enabled && (
        <div className="space-y-2">
          <Label htmlFor="pa-preset-select">Preset de PA</Label>
          <Select value={selectedId || ''} onValueChange={onSelect} disabled={disabled || isLoading || presets.length === 0}>
            <SelectTrigger id="pa-preset-select">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                  {preset.job_id === jobId ? ' (trabajo)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
