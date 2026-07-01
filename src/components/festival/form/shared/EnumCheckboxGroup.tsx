
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface EnumCheckboxGroupProps<T extends string> {
  idPrefix: string;
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: T[];
  onChange: (selected: T[]) => void;
  disabled?: boolean;
}

export function EnumCheckboxGroup<T extends string>({
  idPrefix,
  label,
  options,
  selected,
  onChange,
  disabled = false,
}: EnumCheckboxGroupProps<T>) {
  const toggle = (value: T, checked: boolean) => {
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <Checkbox
              id={`${idPrefix}-${option.value}`}
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
              disabled={disabled}
            />
            <Label htmlFor={`${idPrefix}-${option.value}`} className="font-normal">
              {option.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
