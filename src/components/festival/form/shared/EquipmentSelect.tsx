
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WirelessSystem, IEMSystem } from "@/types/festival-equipment";

interface EquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  provider: 'festival' | 'band';
  festivalOptions?: Array<{ model: string; quantity?: number }>;
  bandOptions: readonly string[];
  placeholder?: string;
}

export const EquipmentSelect = ({
  value,
  onChange,
  provider,
  festivalOptions = [],
  bandOptions,
  placeholder = "Select equipment"
}: EquipmentSelectProps) => {
  const options = provider === 'festival' ? festivalOptions : bandOptions;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {provider === 'festival'
          ? festivalOptions.map((option) => (
              <SelectItem key={option.model} value={option.model}>
                {option.model}{option.quantity ? ` (${option.quantity} available)` : ''}
              </SelectItem>
            ))
          : bandOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))
        }
      </SelectContent>
    </Select>
  );
};
