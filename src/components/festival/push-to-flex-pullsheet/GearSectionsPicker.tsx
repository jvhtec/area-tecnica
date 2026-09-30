import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GEAR_SECTIONS, type GearSection } from './model';

interface GearSectionsPickerProps {
  sections: Record<GearSection, boolean>;
  onToggle: (key: GearSection) => void;
  disabled: boolean;
}

/** Which parts of the gear setup are pushed. */
export function GearSectionsPicker({ sections, onToggle, disabled }: GearSectionsPickerProps) {
  return (
    <div className="space-y-2">
      <Label>Secciones a incluir</Label>
      <div className="grid grid-cols-2 gap-2">
        {GEAR_SECTIONS.map(({ key, label }) => (
          <div key={key} className="flex items-center space-x-2">
            <Checkbox id={`section-${key}`} checked={sections[key]} onCheckedChange={() => onToggle(key)} disabled={disabled} />
            <Label
              htmlFor={`section-${key}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
